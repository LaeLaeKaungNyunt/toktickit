import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("My Tickets API (GET /api/v1/tickets)", () => {
  let requesterAId: string;
  let requesterBId: string;
  let categoryId: number;
  let relatedSystemId: string;

  beforeEach(async () => {
    const prisma = getPrisma();

    // Create isolated test requesters for my-tickets test suite
    const reqA = await prisma.developmentRequester.upsert({
      where: { email: "my.tickets.test.a@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "MyTickets Test Requester A",
        email: "my.tickets.test.a@university.edu",
        isActive: true,
      },
    });

    const reqB = await prisma.developmentRequester.upsert({
      where: { email: "my.tickets.test.b@university.edu" },
      update: { isActive: true },
      create: {
        displayName: "MyTickets Test Requester B",
        email: "my.tickets.test.b@university.edu",
        isActive: true,
      },
    });

    requesterAId = reqA.id;
    requesterBId = reqB.id;

    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(category).not.toBeNull();
    expect(system).not.toBeNull();
    categoryId = category!.id;
    relatedSystemId = system!.id;

    // Clean up any tickets belonging to test requesters
    await prisma.ticketEvent.deleteMany({
      where: { ticket: { requesterId: { in: [requesterAId, requesterBId] } } },
    });
    await prisma.ticket.deleteMany({
      where: { requesterId: { in: [requesterAId, requesterBId] } },
    });
  });

  describe("AC-11: Ticket List & Ownership", () => {
    it("returns only tickets owned by current requester (X-Dev-Requester-Id)", async () => {
      const prisma = getPrisma();
      // Create ticket for Requester A
      const ticketA = await prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2026-90001",
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Requester A Ticket Summary",
          description: "Description for Requester A ticket.",
          requestedPriority: "Low",
          currentStatus: "New",
        },
      });

      // Create ticket for Requester B
      await prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2026-90002",
          requesterId: requesterBId,
          categoryId,
          relatedSystemId,
          summary: "Requester B Ticket Summary",
          description: "Description for Requester B ticket.",
          requestedPriority: "High",
          currentStatus: "New",
        },
      });

      // Requester A lists tickets
      const resA = await request(app)
        .get("/api/v1/tickets")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resA.status).toBe(200);
      expect(resA.body.items.length).toBe(1);
      expect(resA.body.items[0].id).toBe(ticketA.id);
      expect(resA.body.items[0].summary).toBe("Requester A Ticket Summary");
      expect(resA.body.pagination.totalItems).toBe(1);
      expect(resA.body.pagination.totalPages).toBe(1);

      // Requester B lists tickets
      const resB = await request(app)
        .get("/api/v1/tickets")
        .set("X-Dev-Requester-Id", requesterBId);

      expect(resB.status).toBe(200);
      expect(resB.body.items.length).toBe(1);
      expect(resB.body.items[0].summary).toBe("Requester B Ticket Summary");
      expect(resB.body.pagination.totalItems).toBe(1);
      expect(resB.body.pagination.totalPages).toBe(1);
    });
  });

  describe("AC-12: Requester Context & Security Isolation", () => {
    it("does not allow supplying requesterId in query parameters to view another requester's tickets", async () => {
      const prisma = getPrisma();
      await prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2026-90002",
          requesterId: requesterBId,
          categoryId,
          relatedSystemId,
          summary: "Requester B Ticket Summary",
          description: "Description for Requester B ticket.",
          requestedPriority: "High",
          currentStatus: "New",
        },
      });

      // Requester A attempts to pass requesterId=requesterBId in query string
      const res = await request(app)
        .get(`/api/v1/tickets?requesterId=${requesterBId}`)
        .set("X-Dev-Requester-Id", requesterAId);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(0);
      expect(res.body.pagination.totalItems).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });
  });

  describe("AC-13: Case-Insensitive Search", () => {
    it("searches across ticketNumber, summary, and description case-insensitively", async () => {
      const prisma = getPrisma();
      await prisma.ticket.createMany({
        data: [
          {
            ticketNumber: "TKT-2026-90101",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Portal Password Reset Issue",
            description: "Cannot connect to campus Wi-Fi network.",
            requestedPriority: "Medium",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90102",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Hardware printer failure",
            description: "Printer displays ERROR code 404 in library.",
            requestedPriority: "Low",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90103",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Software license expired",
            description: "Matlab license requires renewal.",
            requestedPriority: "High",
            currentStatus: "New",
          },
        ],
      });

      // Search by partial summary ("pOrTaL")
      const resSummary = await request(app)
        .get("/api/v1/tickets?search=pOrTaL")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resSummary.status).toBe(200);
      expect(resSummary.body.items.length).toBe(1);
      expect(resSummary.body.items[0].ticketNumber).toBe("TKT-2026-90101");

      // Search by partial description ("eRrOr")
      const resDesc = await request(app)
        .get("/api/v1/tickets?search=eRrOr")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resDesc.status).toBe(200);
      expect(resDesc.body.items.length).toBe(1);
      expect(resDesc.body.items[0].ticketNumber).toBe("TKT-2026-90102");

      // Search by ticketNumber ("90103")
      const resNumber = await request(app)
        .get("/api/v1/tickets?search=90103")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resNumber.status).toBe(200);
      expect(resNumber.body.items.length).toBe(1);
      expect(resNumber.body.items[0].ticketNumber).toBe("TKT-2026-90103");
    });
  });

  describe("AC-14: Filtering", () => {
    it("filters by categoryId, relatedSystemId, requestedPriority, status, and combines with AND", async () => {
      const prisma = getPrisma();
      await prisma.ticket.createMany({
        data: [
          {
            ticketNumber: "TKT-2026-90201",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Ticket One",
            description: "Description one.",
            requestedPriority: "High",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90202",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Ticket Two",
            description: "Description two.",
            requestedPriority: "Low",
            currentStatus: "New",
          },
        ],
      });

      // Filter by requestedPriority=High
      const resHigh = await request(app)
        .get("/api/v1/tickets?requestedPriority=High")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resHigh.status).toBe(200);
      expect(resHigh.body.items.length).toBe(1);
      expect(resHigh.body.items[0].requestedPriority).toBe("High");

      // Filter by status=New & categoryId & requestedPriority=Low
      const resCombined = await request(app)
        .get(`/api/v1/tickets?status=New&categoryId=${categoryId}&requestedPriority=Low`)
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resCombined.status).toBe(200);
      expect(resCombined.body.items.length).toBe(1);
      expect(resCombined.body.items[0].requestedPriority).toBe("Low");
    });
  });

  describe("AC-15: Sorting", () => {
    it("sorts by requestedPriority using Low < Medium < High < Urgent (asc/desc) with secondary id desc", async () => {
      const prisma = getPrisma();
      await prisma.ticket.createMany({
        data: [
          {
            ticketNumber: "TKT-2026-90301",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Priority High Ticket",
            description: "Description text.",
            requestedPriority: "High",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90302",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Priority Low Ticket",
            description: "Description text.",
            requestedPriority: "Low",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90303",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Priority Urgent Ticket",
            description: "Description text.",
            requestedPriority: "Urgent",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90304",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Priority Medium Ticket",
            description: "Description text.",
            requestedPriority: "Medium",
            currentStatus: "New",
          },
        ],
      });

      // Sort by requestedPriority asc -> Low, Medium, High, Urgent
      const resAsc = await request(app)
        .get("/api/v1/tickets?sortBy=requestedPriority&sortOrder=asc")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resAsc.status).toBe(200);
      const prioritiesAsc = resAsc.body.items.map((i: { requestedPriority: string }) => i.requestedPriority);
      expect(prioritiesAsc).toEqual(["Low", "Medium", "High", "Urgent"]);

      // Sort by requestedPriority desc -> Urgent, High, Medium, Low
      const resDesc = await request(app)
        .get("/api/v1/tickets?sortBy=requestedPriority&sortOrder=desc")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resDesc.status).toBe(200);
      const prioritiesDesc = resDesc.body.items.map((i: { requestedPriority: string }) => i.requestedPriority);
      expect(prioritiesDesc).toEqual(["Urgent", "High", "Medium", "Low"]);
    });

    it("proves requestedPriority sorting occurs in PostgreSQL before pagination across multiple pages", async () => {
      const prisma = getPrisma();
      // Create 6 tickets with mixed priorities
      await prisma.ticket.createMany({
        data: [
          { ticketNumber: "TKT-2026-90401", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T1 Low", description: "Desc", requestedPriority: "Low", currentStatus: "New" },
          { ticketNumber: "TKT-2026-90402", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T2 Urgent", description: "Desc", requestedPriority: "Urgent", currentStatus: "New" },
          { ticketNumber: "TKT-2026-90403", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T3 Medium", description: "Desc", requestedPriority: "Medium", currentStatus: "New" },
          { ticketNumber: "TKT-2026-90404", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T4 High", description: "Desc", requestedPriority: "High", currentStatus: "New" },
          { ticketNumber: "TKT-2026-90405", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T5 Low", description: "Desc", requestedPriority: "Low", currentStatus: "New" },
          { ticketNumber: "TKT-2026-90406", requesterId: requesterAId, categoryId, relatedSystemId, summary: "T6 Urgent", description: "Desc", requestedPriority: "Urgent", currentStatus: "New" },
        ],
      });

      // Query Page 1 with pageSize=3, sortBy=requestedPriority, sortOrder=desc
      // Expected DB order desc: Urgent, Urgent, High, Medium, Low, Low
      // Page 1 (items 1..3): Urgent, Urgent, High
      const resPage1 = await request(app)
        .get("/api/v1/tickets?sortBy=requestedPriority&sortOrder=desc&page=1&pageSize=3")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.pagination.totalItems).toBe(6);
      expect(resPage1.body.pagination.totalPages).toBe(2);
      const page1Priorities = resPage1.body.items.map((i: { requestedPriority: string }) => i.requestedPriority);
      expect(page1Priorities).toEqual(["Urgent", "Urgent", "High"]);

      // Page 2 (items 4..6): Medium, Low, Low
      const resPage2 = await request(app)
        .get("/api/v1/tickets?sortBy=requestedPriority&sortOrder=desc&page=2&pageSize=3")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.pagination.totalItems).toBe(6);
      expect(resPage2.body.pagination.totalPages).toBe(2);
      const page2Priorities = resPage2.body.items.map((i: { requestedPriority: string }) => i.requestedPriority);
      expect(page2Priorities).toEqual(["Medium", "Low", "Low"]);
    });

    it("sorts by ticketNumber with deterministic secondary sort id desc", async () => {
      const prisma = getPrisma();
      await prisma.ticket.createMany({
        data: [
          {
            ticketNumber: "TKT-2026-90003",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Ticket Three",
            description: "Description text.",
            requestedPriority: "Low",
            currentStatus: "New",
          },
          {
            ticketNumber: "TKT-2026-90001",
            requesterId: requesterAId,
            categoryId,
            relatedSystemId,
            summary: "Ticket One",
            description: "Description text.",
            requestedPriority: "Low",
            currentStatus: "New",
          },
        ],
      });

      const res = await request(app)
        .get("/api/v1/tickets?sortBy=ticketNumber&sortOrder=asc")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(res.status).toBe(200);
      expect(res.body.items[0].ticketNumber).toBe("TKT-2026-90001");
      expect(res.body.items[1].ticketNumber).toBe("TKT-2026-90003");
    });
  });

  describe("AC-16: Pagination & Metadata", () => {
    it("paginates results and returns accurate pagination metadata", async () => {
      const prisma = getPrisma();
      const ticketsData = Array.from({ length: 15 }).map((_, idx) => ({
        ticketNumber: `TKT-2026-${String(91000 + idx + 1)}`,
        requesterId: requesterAId,
        categoryId,
        relatedSystemId,
        summary: `Paginated Ticket ${idx + 1}`,
        description: `Description for ticket ${idx + 1}.`,
        requestedPriority: "Medium",
        currentStatus: "New",
      }));

      await prisma.ticket.createMany({ data: ticketsData });

      // Default page 1, pageSize 10
      const resPage1 = await request(app)
        .get("/api/v1/tickets")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.items.length).toBe(10);
      expect(resPage1.body.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 15,
        totalPages: 2,
      });

      // Page 2, pageSize 10
      const resPage2 = await request(app)
        .get("/api/v1/tickets?page=2&pageSize=10")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.items.length).toBe(5);
      expect(resPage2.body.pagination).toEqual({
        page: 2,
        pageSize: 10,
        totalItems: 15,
        totalPages: 2,
      });
    });

    it("returns totalPages = 0 when totalItems = 0", async () => {
      const res = await request(app)
        .get("/api/v1/tickets?search=nonexistentsearchterm123")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it("returns items: [] with valid metadata when page exceeds totalPages", async () => {
      const prisma = getPrisma();
      await prisma.ticket.create({
        data: {
          ticketNumber: "TKT-2026-90099",
          requesterId: requesterAId,
          categoryId,
          relatedSystemId,
          summary: "Single Ticket",
          description: "Description text.",
          requestedPriority: "Low",
          currentStatus: "New",
        },
      });

      const res = await request(app)
        .get("/api/v1/tickets?page=999")
        .set("X-Dev-Requester-Id", requesterAId);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pagination).toEqual({
        page: 999,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });
  });

  describe("AC-19: Invalid Query Parameter Validation", () => {
    it("returns 400 Bad Request for missing or invalid X-Dev-Requester-Id", async () => {
      const resMissing = await request(app).get("/api/v1/tickets");
      expect(resMissing.status).toBe(400);

      const resInvalid = await request(app)
        .get("/api/v1/tickets")
        .set("X-Dev-Requester-Id", "not-a-valid-uuid");
      expect(resInvalid.status).toBe(400);
    });

    it("returns 400 Bad Request for invalid page or pageSize values", async () => {
      const resPage = await request(app)
        .get("/api/v1/tickets?page=0")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resPage.status).toBe(400);

      const resPageSize = await request(app)
        .get("/api/v1/tickets?pageSize=100")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resPageSize.status).toBe(400);
    });

    it("returns 400 Bad Request for invalid requestedPriority, sortBy, or status", async () => {
      const resPriority = await request(app)
        .get("/api/v1/tickets?requestedPriority=InvalidPriority")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resPriority.status).toBe(400);

      const resSortBy = await request(app)
        .get("/api/v1/tickets?sortBy=unknownField")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resSortBy.status).toBe(400);

      const resStatus = await request(app)
        .get("/api/v1/tickets?status=Resolved")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resStatus.status).toBe(400);
    });

    it("strictly validates categoryId as a positive integer format", async () => {
      const invalidValues = ["0", "-1", "1.5", "1abc", ""];
      for (const val of invalidValues) {
        const res = await request(app)
          .get(`/api/v1/tickets?categoryId=${encodeURIComponent(val)}`)
          .set("X-Dev-Requester-Id", requesterAId);
        expect(res.status).toBe(400);
      }

      // Valid positive integer categoryId (e.g. 1)
      const resValid = await request(app)
        .get(`/api/v1/tickets?categoryId=${categoryId}`)
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resValid.status).toBe(200);
    });

    it("returns 400 Bad Request for malformed relatedSystemId", async () => {
      const resSys = await request(app)
        .get("/api/v1/tickets?relatedSystemId=not-a-uuid")
        .set("X-Dev-Requester-Id", requesterAId);
      expect(resSys.status).toBe(400);
    });
  });
});
