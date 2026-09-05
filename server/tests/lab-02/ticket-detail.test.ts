import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail Feature (GET /api/v1/tickets/:ticketId)", () => {
  let requesterAId: string;
  let requesterBId: string;
  let categoryId: number;
  let activeRelatedSystemId: string;
  let ticketAId: string;

  beforeEach(async () => {
    const prisma = getPrisma();

    // Setup Requester A and Requester B
    const requesterA = await prisma.developmentRequester.upsert({
      where: { email: "detail.test.a@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "Detail Test Requester A",
        email: "detail.test.a@university.edu",
        isActive: true,
      },
    });

    const requesterB = await prisma.developmentRequester.upsert({
      where: { email: "detail.test.b@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "Detail Test Requester B",
        email: "detail.test.b@university.edu",
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

    // Create a Ticket owned by Requester A
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        requesterId: requesterAId,
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Detailed Login Portal Failure",
        description: "The authentication portal returns error 500 when logging in.",
        requestedPriority: "High",
        currentStatus: "New",
      },
    });

    ticketAId = ticketA.id;
  });

  describe("AC-20: Owned Ticket Detail Retrieval", () => {
    it("returns read-only ticket detail with active attachments for owned ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id", ticketAId);
      expect(res.body).toHaveProperty("ticketNumber");
      expect(res.body.requester.id).toBe(requesterAId);
      expect(res.body.category.id).toBe(categoryId);
      expect(res.body.relatedSystem.id).toBe(activeRelatedSystemId);
      expect(res.body.summary).toBe("Detailed Login Portal Failure");
      expect(res.body.requestedPriority).toBe("High");
      expect(res.body.description).toBe("The authentication portal returns error 500 when logging in.");
      expect(res.body.currentStatus).toBe("New");
      expect(res.body).toHaveProperty("createdAt");
      expect(res.body).toHaveProperty("updatedAt");
      expect(Array.isArray(res.body.attachments)).toBe(true);
    });

    it("includes active attachment metadata and excludes soft-removed attachment metadata", async () => {
      const prisma = getPrisma();

      // Create active attachment
      const activeAttachment = await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "active-screenshot.png",
          storedObjectKey: "attachments/active-uuid-1",
          mimeType: "image/png",
          sizeBytes: 150000,
        },
      });

      // Create soft-removed attachment
      await (prisma as any).attachment.create({
        data: {
          ticketId: ticketAId,
          originalFilename: "removed-screenshot.png",
          storedObjectKey: "attachments/removed-uuid-2",
          mimeType: "image/png",
          sizeBytes: 200000,
          removedAt: new Date(),
          removalReason: "Uploaded old version",
          removedByRequesterId: requesterAId,
        },
      });

      const res = await request(app)
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(res.status).toBe(200);
      expect(res.body.attachments.length).toBe(1);
      expect(res.body.attachments[0].id).toBe(activeAttachment.id);
      expect(res.body.attachments[0].originalFilename).toBe("active-screenshot.png");
      expect(res.body.attachments[0]).not.toHaveProperty("storedObjectKey");
    });
  });

  describe("AC-21 & BR-10: Ownership Isolation & Nonexistent Behavior", () => {
    it("returns safe 404 Not Found when attempting to access another requester's ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("X-Dev-Requester-Id", requesterBId);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns identical safe 404 Not Found response for a non-existent ticket", async () => {
      const nonExistentUuid = "00000000-0000-0000-0000-000000000000";

      const resOther = await request(app)
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("X-Dev-Requester-Id", requesterBId);

      const resNonExistent = await request(app)
        .get(`/api/v1/tickets/${nonExistentUuid}`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resOther.status).toBe(404);
      expect(resNonExistent.status).toBe(404);
      expect(resOther.body).toEqual(resNonExistent.body);
    });

    it("returns safe 400 Bad Request when X-Dev-Requester-Id is missing or invalid", async () => {
      const resMissing = await request(app).get(`/api/v1/tickets/${ticketAId}`);
      expect(resMissing.status).toBe(400);

      const resInvalid = await request(app)
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("X-Dev-Requester-Id", "invalid-uuid");
      expect(resInvalid.status).toBe(400);
    });
  });
});
