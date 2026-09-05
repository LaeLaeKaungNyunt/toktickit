import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  setStorageService,
  resetStorageService,
  MockStorageService,
} from "../../src/services/storage.js";

describe("Attachment Management API (Issue #15)", () => {
  let mockStorage: MockStorageService;
  let requesterAId: string;
  let requesterBId: string;
  let ticketAId: string;
  let ticketBId: string;
  let categoryId: number;
  let activeRelatedSystemId: string;

  beforeEach(async () => {
    mockStorage = new MockStorageService();
    setStorageService(mockStorage);

    const prisma = getPrisma();

    const requesterA = await prisma.developmentRequester.upsert({
      where: { email: "attachment.test.a@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "Attachment Test Requester A",
        email: "attachment.test.a@university.edu",
        isActive: true,
      },
    });

    const requesterB = await prisma.developmentRequester.upsert({
      where: { email: "attachment.test.b@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "Attachment Test Requester B",
        email: "attachment.test.b@university.edu",
        isActive: true,
      },
    });

    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst({
      where: { isActive: true },
    });

    expect(requesterA).not.toBeNull();
    expect(requesterB).not.toBeNull();
    expect(category).not.toBeNull();
    expect(system).not.toBeNull();

    requesterAId = requesterA.id;
    requesterBId = requesterB.id;
    categoryId = category!.id;
    activeRelatedSystemId = system!.id;

    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        requesterId: requesterAId,
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Attachment Test Ticket A",
        description: "Testing attachment upload, download, and soft removal for Requester A.",
        requestedPriority: "Medium",
        currentStatus: "New",
      },
    });

    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        requesterId: requesterBId,
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Attachment Test Ticket B",
        description: "Testing attachment isolation for Requester B.",
        requestedPriority: "Low",
        currentStatus: "New",
      },
    });

    ticketAId = ticketA.id;
    ticketBId = ticketB.id;
  });

  afterEach(() => {
    resetStorageService();
    vi.restoreAllMocks();
  });

  describe("AC-22: Attachment Upload & Persistence", () => {
    it.each([
      { filename: "error-screenshot.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpg-content") },
      { filename: "log-image.png", mimeType: "image/png", buffer: Buffer.from("fake-png-content") },
      { filename: "browser-view.webp", mimeType: "image/webp", buffer: Buffer.from("fake-webp-content") },
      { filename: "incident-report.pdf", mimeType: "application/pdf", buffer: Buffer.from("fake-pdf-content") },
    ])("uploads permitted file type %s successfully with 201 Created and ATTACHMENT_ADDED event", async ({ filename, mimeType, buffer }) => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketAId}/attachments`)
        .set("X-Dev-Requester-Id", requesterAId)
        .attach("file", buffer, { filename, contentType: mimeType });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.originalFilename).toBe(filename);
      expect(res.body.mimeType).toBe(mimeType);
      expect(res.body.sizeBytes).toBe(buffer.length);
      expect(res.body).toHaveProperty("uploadedAt");

      // Verify metadata persisted in PostgreSQL
      const prisma = getPrisma();
      const attachmentInDb = await (prisma as any).attachment.findUnique({
        where: { id: res.body.id },
      });

      expect(attachmentInDb).not.toBeNull();
      expect(attachmentInDb.originalFilename).toBe(filename);
      expect(attachmentInDb.storedObjectKey).not.toBe(filename);
      expect(attachmentInDb.storedObjectKey).toMatch(/^attachments\//);

      // Verify binary stored in storage service under safe key
      expect(mockStorage.has(attachmentInDb.storedObjectKey)).toBe(true);

      // Verify ATTACHMENT_ADDED TicketEvent created transactionally
      const events = await prisma.ticketEvent.findMany({
        where: { ticketId: ticketAId, eventType: "ATTACHMENT_ADDED" },
      });

      expect(events.length).toBeGreaterThanOrEqual(1);
      const addedEvent = events.find((e) => (e.payloadJson as any)?.attachmentId === res.body.id);
      expect(addedEvent).toBeDefined();
      expect(addedEvent!.actorId).toBe(requesterAId);
    });

    it("cleans up uploaded binary from storage if database transaction fails after storage upload", async () => {
      const prisma = getPrisma();
      const sampleBuffer = Buffer.from("cleanup-test-content");

      // Force a database transaction failure by mocking prisma.$transaction to throw
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
        new Error("Database transaction connection failed")
      );

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketAId}/attachments`)
        .set("X-Dev-Requester-Id", requesterAId)
        .attach("file", sampleBuffer, { filename: "fail-cleanup.png", contentType: "image/png" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();

      // Verify orphaned binary object was deleted from storage
      // Storage store should be empty because cleanup ran
      const storedKeys = Array.from((mockStorage as any).store.keys());
      expect(storedKeys.length).toBe(0);
    });
  });

  describe("AC-23: Attachment Upload Validation", () => {
    it("rejects unsupported MIME type with 415 Unsupported Media Type", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketAId}/attachments`)
        .set("X-Dev-Requester-Id", requesterAId)
        .attach("file", Buffer.from("plain text content"), {
          filename: "script.sh",
          contentType: "text/plain",
        });

      expect(res.status).toBe(415);
      expect(res.body.error).toBeDefined();
    });

    it("rejects file exceeding 5 MB limit with 413 Payload Too Large", async () => {
      const OVER_5MB_BYTES = 5 * 1024 * 1024 + 1;
      const largeBuffer = Buffer.alloc(OVER_5MB_BYTES);

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketAId}/attachments`)
        .set("X-Dev-Requester-Id", requesterAId)
        .attach("file", largeBuffer, {
          filename: "huge-file.pdf",
          contentType: "application/pdf",
        });

      expect(res.status).toBe(413);
      expect(res.body.error).toBeDefined();
    });

    it("rejects 6th active attachment with 409 Conflict when 5 active attachments exist", async () => {
      const prisma = getPrisma();

      // Seed 5 active attachments for ticketA
      for (let i = 1; i <= 5; i++) {
        await (prisma as any).attachment.create({
          data: {
            ticketId: ticketAId,
            originalFilename: `seeded-${i}.png`,
            storedObjectKey: `attachments/seeded-key-${i}`,
            mimeType: "image/png",
            sizeBytes: 1000,
          },
        });
      }

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketAId}/attachments`)
        .set("X-Dev-Requester-Id", requesterAId)
        .attach("file", Buffer.from("6th-file-content"), {
          filename: "overflow.png",
          contentType: "image/png",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("AC-24: Attachment Retrieval & Download", () => {
    it("downloads active binary content successfully for an owned ticket attachment", async () => {
      const prisma = getPrisma();
      const testBuffer = Buffer.from("active-download-binary-data");
      const objectKey = "attachments/active-download-key";

      await mockStorage.uploadFile(objectKey, testBuffer, "image/png");

      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "download-me.png",
          storedObjectKey: objectKey,
          mimeType: "image/png",
          sizeBytes: testBuffer.length,
        },
      });

      // Get metadata
      const metaRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(metaRes.status).toBe(200);
      expect(metaRes.body.id).toBe(attachment.id);
      expect(metaRes.body.originalFilename).toBe("download-me.png");

      // Binary download
      const downloadRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}/download`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.header["content-type"]).toContain("image/png");
      expect(downloadRes.header["content-disposition"]).toContain("download-me.png");
      expect(downloadRes.body.toString()).toBe("active-download-binary-data");
    });
  });

  describe("AC-25 & AC-26: Soft Removal & Failure Semantics", () => {
    it("rejects removal when removal reason is missing or whitespace-only", async () => {
      const prisma = getPrisma();
      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "to-remove.png",
          storedObjectKey: "attachments/to-remove-key",
          mimeType: "image/png",
          sizeBytes: 1000,
        },
      });

      const resEmpty = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "   " });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toBeDefined();
    });

    it("soft-removes active attachment, records metadata + ATTACHMENT_REMOVED event, and deletes storage binary", async () => {
      const prisma = getPrisma();
      const objectKey = "attachments/soft-remove-binary-key";
      await mockStorage.uploadFile(objectKey, Buffer.from("content-to-be-deleted"), "image/png");

      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "wrong-screenshot.png",
          storedObjectKey: objectKey,
          mimeType: "image/png",
          sizeBytes: 1000,
        },
      });

      const res = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "  Uploaded wrong file version  " });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(attachment.id);
      expect(res.body.removalReason).toBe("Uploaded wrong file version");
      expect(res.body.removedByRequesterId).toBe(requesterAId);
      expect(res.body).toHaveProperty("removedAt");

      // Verify binary deleted from storage
      expect(mockStorage.has(objectKey)).toBe(false);

      // Verify DB metadata retained
      const updatedAttachment = await (prisma as any).attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(updatedAttachment.removedAt).not.toBeNull();
      expect(updatedAttachment.removalReason).toBe("Uploaded wrong file version");
      expect(updatedAttachment.removedByRequesterId).toBe(requesterAId);

      // Verify ATTACHMENT_REMOVED TicketEvent created transactionally
      const events = await prisma.ticketEvent.findMany({
        where: { ticketId: ticketAId, eventType: "ATTACHMENT_REMOVED" },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it("AC-26: rejects download/metadata/re-removal of soft-removed attachment with safe 404", async () => {
      const prisma = getPrisma();
      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "already-removed.png",
          storedObjectKey: "attachments/already-removed-key",
          mimeType: "image/png",
          sizeBytes: 1000,
          removedAt: new Date(),
          removalReason: "Previously removed",
          removedByRequesterId: requesterAId,
        },
      });

      // Metadata fetch
      const metaRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId);
      expect(metaRes.status).toBe(404);

      // Binary download
      const downloadRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}/download`)
        .set("X-Dev-Requester-Id", requesterAId);
      expect(downloadRes.status).toBe(404);

      // Second soft-removal
      const removeRes = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "Attempting duplicate removal" });
      expect(removeRes.status).toBe(404);
    });

    it("aborts removal and leaves attachment active if storage binary deletion fails", async () => {
      const prisma = getPrisma();
      const objectKey = "attachments/storage-fail-key";
      await mockStorage.uploadFile(objectKey, Buffer.from("storage-fail-data"), "image/png");

      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "storage-fail.png",
          storedObjectKey: objectKey,
          mimeType: "image/png",
          sizeBytes: 1000,
        },
      });

      // Force storage deletion failure
      vi.spyOn(mockStorage, "deleteFile").mockRejectedValueOnce(
        new Error("Storage connection lost during delete")
      );

      const res = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "Valid reason text" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();

      // Attachment remains active in DB
      const dbAttachment = await (prisma as any).attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(dbAttachment.removedAt).toBeNull();
    });

    it("handles DB failure after storage deletion safely and permits successful idempotent retry", async () => {
      const prisma = getPrisma();
      const objectKey = "attachments/db-fail-key";
      await mockStorage.uploadFile(objectKey, Buffer.from("db-fail-data"), "image/png");

      const attachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "db-fail.png",
          storedObjectKey: objectKey,
          mimeType: "image/png",
          sizeBytes: 1000,
        },
      });

      // 1. Force DB transaction failure after storage deletion
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
        new Error("Database transaction rolled back")
      );

      const failRes = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "Initial removal attempt" });

      expect(failRes.status).toBe(500);
      expect(failRes.body.error).toBeDefined();
      expect(failRes.status).not.toBe(200);

      // Verify attachment remained active in DB (rolled back)
      const rolledBackAttachment = await (prisma as any).attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(rolledBackAttachment.removedAt).toBeNull();

      // Verify no ATTACHMENT_REMOVED event committed
      const failEvents = await prisma.ticketEvent.findMany({
        where: { ticketId: ticketAId, eventType: "ATTACHMENT_REMOVED" },
      });
      expect(failEvents.length).toBe(0);

      // Storage binary was deleted on first attempt
      expect(mockStorage.has(objectKey)).toBe(false);

      // 2. Subsequent retry (storage deletion is idempotent when binary is already absent)
      const retryRes = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachment.id}`)
        .set("X-Dev-Requester-Id", requesterAId)
        .send({ reason: "Retry removal after DB failure" });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.id).toBe(attachment.id);
      expect(retryRes.body.removalReason).toBe("Retry removal after DB failure");
      expect(retryRes.body.removedByRequesterId).toBe(requesterAId);

      // Verify DB metadata now updated
      const finalAttachment = await (prisma as any).attachment.findUnique({
        where: { id: attachment.id },
      });
      expect(finalAttachment.removedAt).not.toBeNull();
      expect(finalAttachment.removalReason).toBe("Retry removal after DB failure");

      // Verify exactly one ATTACHMENT_REMOVED event committed
      const finalEvents = await prisma.ticketEvent.findMany({
        where: { ticketId: ticketAId, eventType: "ATTACHMENT_REMOVED" },
      });
      expect(finalEvents.length).toBe(1);
    });
  });

  describe("AC-27 & BR-10: Cross-Requester Attachment Isolation", () => {
    it("returns safe 404 Not Found when Requester B attempts to access, download, or remove Requester A's attachment", async () => {
      const prisma = getPrisma();
      const objectKey = "attachments/requester-a-key";
      await mockStorage.uploadFile(objectKey, Buffer.from("requester-a-data"), "image/png");

      const attachmentA = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "private-a.png",
          storedObjectKey: objectKey,
          mimeType: "image/png",
          sizeBytes: 1000,
        },
      });

      // Metadata fetch by Requester B
      const metaRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachmentA.id}`)
        .set("X-Dev-Requester-Id", requesterBId);
      expect(metaRes.status).toBe(404);

      // Download by Requester B
      const downloadRes = await request(app)
        .get(`/api/v1/tickets/${ticketAId}/attachments/${attachmentA.id}/download`)
        .set("X-Dev-Requester-Id", requesterBId);
      expect(downloadRes.status).toBe(404);

      // Soft removal by Requester B
      const removeRes = await request(app)
        .delete(`/api/v1/tickets/${ticketAId}/attachments/${attachmentA.id}`)
        .set("X-Dev-Requester-Id", requesterBId)
        .send({ reason: "Malicious removal attempt" });
      expect(removeRes.status).toBe(404);
    });
  });
});
