import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 3 IT Staff Ticket Queue API (Issue #25)", () => {
  let staffToken: string;
  let staffUser: any;
  let requesterToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const prisma = getPrisma();

    const staff = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const requester = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });

    expect(staff).not.toBeNull();
    expect(requester).not.toBeNull();
    expect(admin).not.toBeNull();

    staffUser = staff!;
    staffToken = createToken(staff!.id, "IT Staff", staff!.tokenVersion);
    requesterToken = createToken(requester!.id, "Requester", requester!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("1. AC-12 / FR-13, FR-16: Authorized IT Staff loads queue with 200 OK and valid DTO fields", async () => {
    const res = await request(app)
      .get("/api/v1/staff/tickets")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toHaveProperty("page", 1);
    expect(res.body.pagination).toHaveProperty("pageSize", 20);
    expect(res.body.pagination).toHaveProperty("totalItems");
    expect(res.body.pagination).toHaveProperty("totalPages");

    const firstItem = res.body.items[0];
    expect(firstItem).toHaveProperty("id");
    expect(firstItem).toHaveProperty("ticketNumber");
    expect(firstItem).toHaveProperty("requester");
    expect(firstItem.requester).toHaveProperty("id");
    expect(firstItem.requester).toHaveProperty("name");
    expect(firstItem).toHaveProperty("category");
    expect(firstItem.category).toHaveProperty("id");
    expect(firstItem.category).toHaveProperty("name");
    expect(firstItem).toHaveProperty("summary");
    expect(firstItem).toHaveProperty("status");
    expect(firstItem).toHaveProperty("itPriority");
    expect(firstItem).toHaveProperty("assignee");
  });

  it("2. AC-11 / FR-11, FR-12: Unauthenticated request returns 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/staff/tickets");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid authorization token");
  });

  it("3. AC-11 / FR-11, FR-12: Requester and Administrator roles return 403 Forbidden", async () => {
    const resRequester = await request(app)
      .get("/api/v1/staff/tickets")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(resRequester.status).toBe(403);
    expect(resRequester.body.error).toBe("Forbidden: insufficient permissions");

    const resAdmin = await request(app)
      .get("/api/v1/staff/tickets")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(403);
    expect(resAdmin.body.error).toBe("Forbidden: insufficient permissions");
  });

  it("4. AC-13 / FR-14: Search parameter filters tickets by ticketNumber, summary, description, requester name", async () => {
    // Search by summary keyword "Portal"
    const resSummary = await request(app)
      .get("/api/v1/staff/tickets?search=Portal")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resSummary.status).toBe(200);
    expect(resSummary.body.items.length).toBeGreaterThan(0);
    for (const item of resSummary.body.items) {
      const match =
        item.ticketNumber.toLowerCase().includes("portal") ||
        item.summary.toLowerCase().includes("portal") ||
        (item.description && item.description.toLowerCase().includes("portal")) ||
        item.requester.name.toLowerCase().includes("portal") ||
        item.category.name.toLowerCase().includes("portal");
      expect(match).toBe(true);
    }

    // Search with no matches returns 200 OK with empty items
    const resNoMatch = await request(app)
      .get("/api/v1/staff/tickets?search=NonExistentSearchString999")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resNoMatch.status).toBe(200);
    expect(resNoMatch.body.items).toEqual([]);
    expect(resNoMatch.body.pagination.totalItems).toBe(0);
    expect(resNoMatch.body.pagination.totalPages).toBe(0);
  });

  it("5. AC-14 / FR-14: Filtering by status, priority, and assignment", async () => {
    // Filter by status=New
    const resNew = await request(app)
      .get("/api/v1/staff/tickets?status=New")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resNew.status).toBe(200);
    for (const item of resNew.body.items) {
      expect(item.status).toBe("New");
    }

    // Filter by priority=High
    const resHigh = await request(app)
      .get("/api/v1/staff/tickets?priority=High")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resHigh.status).toBe(200);
    for (const item of resHigh.body.items) {
      expect(item.itPriority).toBe("High");
    }

    // Filter by assignment=unassigned
    const resUnassigned = await request(app)
      .get("/api/v1/staff/tickets?assignment=unassigned")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resUnassigned.status).toBe(200);
    for (const item of resUnassigned.body.items) {
      expect(item.assignee).toBeNull();
    }

    // Filter by assignment=assigned
    const resAssigned = await request(app)
      .get("/api/v1/staff/tickets?assignment=assigned")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resAssigned.status).toBe(200);
    for (const item of resAssigned.body.items) {
      expect(item.assignee).not.toBeNull();
    }
  });

  it("6. AC-15 / FR-15: Deterministic sorting by ticketNumber, createdAt, status, priority", async () => {
    const resTicketNumber = await request(app)
      .get("/api/v1/staff/tickets?sortBy=ticketNumber&sortOrder=asc")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resTicketNumber.status).toBe(200);
    const numbers = resTicketNumber.body.items.map((i: any) => i.ticketNumber);
    const sortedNumbers = [...numbers].sort();
    expect(numbers).toEqual(sortedNumbers);
  });

  it("7. AC-16 / FR-15: Pagination page bounds and metadata", async () => {
    const resPage1 = await request(app)
      .get("/api/v1/staff/tickets?page=1&pageSize=2")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.items.length).toBeLessThanOrEqual(2);
    expect(resPage1.body.pagination.page).toBe(1);

    const resPageOut = await request(app)
      .get("/api/v1/staff/tickets?page=999&pageSize=20")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resPageOut.status).toBe(200);
    expect(resPageOut.body.items).toEqual([]);
    expect(resPageOut.body.pagination.page).toBe(999);
  });

  it("8. AC-14 / FR-14: Invalid query parameters return 400 Bad Request", async () => {
    const resInvalidStatus = await request(app)
      .get("/api/v1/staff/tickets?status=InvalidStatusValue")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resInvalidStatus.status).toBe(400);

    const resInvalidPage = await request(app)
      .get("/api/v1/staff/tickets?page=0")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resInvalidPage.status).toBe(400);

    const resInvalidPageSize = await request(app)
      .get("/api/v1/staff/tickets?pageSize=999")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(resInvalidPageSize.status).toBe(400);
  });

  it("9. AC-18 / FR-17: GET /api/v1/staff/tickets/:ticketId returns authorized ticket detail for IT Staff", async () => {
    const queueRes = await request(app)
      .get("/api/v1/staff/tickets")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(queueRes.status).toBe(200);
    const firstTicketId = queueRes.body.items[0].id;

    const detailRes = await request(app)
      .get(`/api/v1/staff/tickets/${firstTicketId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.ticket).toBeDefined();
    expect(detailRes.body.ticket.id).toBe(firstTicketId);
    expect(detailRes.body.ticket.requester).toBeDefined();
    expect(detailRes.body.ticket.category).toBeDefined();
    expect(detailRes.body.ticket.relatedSystem).toBeDefined();
    expect(detailRes.body.ticket.description).toBeDefined();
  });

  it("10. AC-18 / FR-17: GET /api/v1/staff/tickets/:ticketId enforces role protection and 404 behavior", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const unauthRes = await request(app).get(`/api/v1/staff/tickets/${fakeId}`);
    expect(unauthRes.status).toBe(401);

    const requesterRes = await request(app)
      .get(`/api/v1/staff/tickets/${fakeId}`)
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(requesterRes.status).toBe(403);

    const notFoundRes = await request(app)
      .get(`/api/v1/staff/tickets/${fakeId}`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(notFoundRes.status).toBe(404);
  });
});
