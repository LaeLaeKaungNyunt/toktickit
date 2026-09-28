import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role = "Requester", tokenVersion = 0, mustChangePassword = false) {
  return jwt.sign(
    { userId, role, tokenVersion, mustChangePassword },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

describe("Lab 3 Authorization API & Requester Isolation (Issue #24)", () => {
  let aliceId: string;
  let bobId: string;
  let staffId: string;
  let initialUserId: string;
  let aliceToken: string;
  let bobToken: string;
  let staffToken: string;
  let initialUserToken: string;
  let categoryId: number;
  let relatedSystemId: string;
  let aliceTicketId: string;

  beforeAll(async () => {
    const prisma = getPrisma();

    // Fetch seeded users
    const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
    const staff = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst({ where: { isActive: true } });

    expect(alice).not.toBeNull();
    expect(bob).not.toBeNull();
    expect(staff).not.toBeNull();
    expect(category).not.toBeNull();
    expect(system).not.toBeNull();

    aliceId = alice!.id;
    bobId = bob!.id;
    staffId = staff!.id;
    categoryId = category!.id;
    relatedSystemId = system!.id;

    aliceToken = createToken(aliceId, "Requester", alice!.tokenVersion);
    bobToken = createToken(bobId, "Requester", bob!.tokenVersion);
    staffToken = createToken(staffId, staff!.role, staff!.tokenVersion);

    // Create a user with mustChangePassword: true for testing password gate on ticket endpoints
    const initialUser = await prisma.user.upsert({
      where: { email: "auth.gate.test@university.edu" },
      update: { mustChangePassword: true, isActive: true },
      create: {
        name: "Auth Gate Test User",
        email: "auth.gate.test@university.edu",
        role: "Requester",
        passwordHash: "hash",
        mustChangePassword: true,
        isActive: true,
      },
    });
    initialUserId = initialUser.id;
    initialUserToken = createToken(initialUserId, "Requester", initialUser.tokenVersion, true);

    // Create a ticket for Alice
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
        requesterId: aliceId,
        categoryId,
        relatedSystemId,
        summary: "Alice's Authorization Test Ticket",
        description: "Testing strict ownership isolation for Alice.",
        requestedPriority: "High",
        currentStatus: "New",
      },
    });
    aliceTicketId = ticket.id;
  });

  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("1. Ticket creation assigns ownership strictly to authenticated caller", async () => {
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        categoryId,
        relatedSystemId,
        summary: "Alice Created Ticket",
        requestedPriority: "Medium",
        description: "Alice creating a new ticket with valid JWT.",
      });

    expect(res.status).toBe(201);
    expect(res.body.requester.id).toBe(aliceId);
  });

  it("2. Client-supplied body spoofing (requesterId, currentStatus) is ignored", async () => {
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        categoryId,
        relatedSystemId,
        summary: "Alice Spoof Attempt",
        requestedPriority: "Medium",
        description: "Attempting to create a ticket under Bob's ID with Resolved status.",
        requesterId: bobId,
        currentStatus: "Resolved",
        ticketNumber: "TKT-9999-99999",
      });

    expect(res.status).toBe(201);
    expect(res.body.requester.id).toBe(aliceId);
    expect(res.body.currentStatus).toBe("New");
    expect(res.body.ticketNumber).not.toBe("TKT-9999-99999");
  });

  it("3. My Tickets returns only tickets owned by authenticated requester", async () => {
    const resAlice = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${aliceToken}`);

    expect(resAlice.status).toBe(200);
    const aliceTicketIds = resAlice.body.items.map((t: { id: string }) => t.id);
    expect(aliceTicketIds).toContain(aliceTicketId);

    const resBob = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${bobToken}`);

    expect(resBob.status).toBe(200);
    const bobTicketIds = resBob.body.items.map((t: { id: string }) => t.id);
    expect(bobTicketIds).not.toContain(aliceTicketId);
  });

  it("4. Cross-requester ticket detail read returns safe 404 Not Found", async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${aliceTicketId}`)
      .set("Authorization", `Bearer ${bobToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("5. Cross-requester attachment operations return safe 404 Not Found", async () => {
    // Attempt to list or view attachment on Alice's ticket using Bob's token
    const res = await request(app)
      .get(`/api/v1/tickets/${aliceTicketId}/attachments/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${bobToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("6. Unauthenticated request returns 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/tickets");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing or invalid authorization token");
  });

  it("7. Non-Requester role returns 403 Forbidden on Requester ticket endpoints", async () => {
    const res = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden: insufficient permissions");
  });

  it("8. Mandatory password change gate blocks ticket endpoints", async () => {
    const res = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", `Bearer ${initialUserToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
});
