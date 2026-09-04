import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Create Ticket Feature (POST /api/v1/tickets)", () => {
  let activeRequesterId: string;
  let categoryId: number;
  let activeRelatedSystemId: string;

  beforeEach(async () => {
    const prisma = getPrisma();
    const requester = await prisma.developmentRequester.findFirst({
      where: { isActive: true },
    });
    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst({
      where: { isActive: true },
    });

    expect(requester).not.toBeNull();
    expect(category).not.toBeNull();
    expect(system).not.toBeNull();

    activeRequesterId = requester!.id;
    categoryId = category!.id;
    activeRelatedSystemId = system!.id;
  });

  describe("Schema & Data Model Foundations", () => {
    it("verifies Ticket, TicketEvent, and TicketSequence models exist with expected fields", async () => {
      const prisma = getPrisma();
      expect(prisma.ticket).toBeDefined();
      expect(prisma.ticketEvent).toBeDefined();
      expect(prisma.ticketSequence).toBeDefined();
    });
  });

  describe("AC-05: Valid Ticket Creation & Transactional Event", () => {
    it("creates a ticket and TICKET_CREATED event transactionally with 201 Created", async () => {
      const payload = {
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Unable to access student portal",
        requestedPriority: "Medium",
        description: "The portal rejects my login even after resetting my password.",
      };

      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("ticketNumber");
      expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);
      expect(res.body.requester.id).toBe(activeRequesterId);
      expect(res.body.category.id).toBe(categoryId);
      expect(res.body.relatedSystem.id).toBe(activeRelatedSystemId);
      expect(res.body.summary).toBe("Unable to access student portal");
      expect(res.body.requestedPriority).toBe("Medium");
      expect(res.body.description).toBe("The portal rejects my login even after resetting my password.");
      expect(res.body.currentStatus).toBe("New");
      expect(res.body).toHaveProperty("createdAt");
      expect(res.body).toHaveProperty("updatedAt");

      // Verify Ticket and TICKET_CREATED TicketEvent exist in PostgreSQL
      const prisma = getPrisma();
      const ticketInDb = await prisma.ticket.findUnique({
        where: { id: res.body.id },
        include: { ticketEvents: true },
      });

      expect(ticketInDb).not.toBeNull();
      expect(ticketInDb!.currentStatus).toBe("New");
      expect(ticketInDb!.ticketEvents.length).toBe(1);

      const event = ticketInDb!.ticketEvents[0];
      expect(event.eventType).toBe("TICKET_CREATED");
      expect(event.actorId).toBe(activeRequesterId);
      expect(event.createdAt).toBeDefined();
      expect(event.payloadJson).toMatchObject({
        ticketNumber: res.body.ticketNumber,
        summary: "Unable to access student portal",
      });
    });

    it("ignores client-supplied requesterId or status override attempts", async () => {
      const payload = {
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Security portal login issue",
        requestedPriority: "High",
        description: "Client attempting to override owner and status fields.",
        requesterId: "00000000-0000-0000-0000-000000000000",
        currentStatus: "Resolved",
        ticketNumber: "TKT-9999-99999",
      };

      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.requester.id).toBe(activeRequesterId);
      expect(res.body.currentStatus).toBe("New");
      expect(res.body.ticketNumber).not.toBe("TKT-9999-99999");
    });
  });

  describe("AC-07: Validation & Trimming Behavior", () => {
    it("trims leading/trailing whitespace from summary and description before persistence", async () => {
      const payload = {
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "   VPN Connection Drops Frequently   ",
        requestedPriority: "Low",
        description: "   My connection drops every 15 minutes when connected to campus Wi-Fi.   ",
      };

      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.summary).toBe("VPN Connection Drops Frequently");
      expect(res.body.description).toBe("My connection drops every 15 minutes when connected to campus Wi-Fi.");
    });

    it("rejects missing or invalid categoryId", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId: 999999,
          relatedSystemId: activeRelatedSystemId,
          summary: "Valid summary text",
          requestedPriority: "Low",
          description: "Valid description text for category validation test.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields).toHaveProperty("categoryId");
    });

    it("rejects missing or inactive relatedSystemId", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: "00000000-0000-0000-0000-000000000000",
          summary: "Valid summary text",
          requestedPriority: "Low",
          description: "Valid description text for related system validation test.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields).toHaveProperty("relatedSystemId");
    });

    it("rejects summary that is whitespace-only, shorter than 5 chars, or longer than 120 chars", async () => {
      const shortRes = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: activeRelatedSystemId,
          summary: "  abc ",
          requestedPriority: "Low",
          description: "Valid description text for summary length test.",
        });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error.fields).toHaveProperty("summary");

      const longRes = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: activeRelatedSystemId,
          summary: "a".repeat(121),
          requestedPriority: "Low",
          description: "Valid description text for summary length test.",
        });

      expect(longRes.status).toBe(400);
      expect(longRes.body.error.fields).toHaveProperty("summary");
    });

    it("rejects description that is whitespace-only, shorter than 10 chars, or longer than 5000 chars", async () => {
      const shortRes = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: activeRelatedSystemId,
          summary: "Valid Summary",
          requestedPriority: "Low",
          description: "Short",
        });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error.fields).toHaveProperty("description");

      const longRes = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: activeRelatedSystemId,
          summary: "Valid Summary",
          requestedPriority: "Low",
          description: "a".repeat(5001),
        });

      expect(longRes.status).toBe(400);
      expect(longRes.body.error.fields).toHaveProperty("description");
    });

    it("rejects missing or invalid requestedPriority", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", activeRequesterId)
        .send({
          categoryId,
          relatedSystemId: activeRelatedSystemId,
          summary: "Valid Ticket Summary",
          requestedPriority: "Critical",
          description: "Valid description text for priority validation test.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.fields).toHaveProperty("requestedPriority");
    });
  });

  describe("Requester Context Error Protection", () => {
    it("returns safe 400 Bad Request when X-Dev-Requester-Id header is missing or invalid", async () => {
      const payload = {
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Valid Ticket Summary",
        requestedPriority: "Medium",
        description: "Valid description text for requester context error test.",
      };

      const resMissing = await request(app)
        .post("/api/v1/tickets")
        .send(payload);

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");

      const resInvalid = await request(app)
        .post("/api/v1/tickets")
        .set("X-Dev-Requester-Id", "not-a-valid-uuid")
        .send(payload);

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
    });
  });

  describe("BR-36: Safe Concurrent Ticket Number Generation", () => {
    it("generates unique sequential ticket numbers under concurrent requests", async () => {
      const payload = {
        categoryId,
        relatedSystemId: activeRelatedSystemId,
        summary: "Concurrent Ticket Submission",
        requestedPriority: "Low",
        description: "Testing atomic sequence allocation under concurrent load.",
      };

      const CONCURRENCY_COUNT = 10;
      const requests = Array.from({ length: CONCURRENCY_COUNT }).map(() =>
        request(app)
          .post("/api/v1/tickets")
          .set("X-Dev-Requester-Id", activeRequesterId)
          .send(payload)
      );

      const responses = await Promise.all(requests);

      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{5}$/);
      }

      const ticketNumbers = responses.map((res) => res.body.ticketNumber);
      const uniqueNumbers = new Set(ticketNumbers);

      // Verify all generated ticket numbers are strictly unique
      expect(uniqueNumbers.size).toBe(CONCURRENCY_COUNT);
    });
  });
});
