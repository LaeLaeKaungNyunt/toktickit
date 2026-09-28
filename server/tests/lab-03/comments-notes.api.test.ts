import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

import { allocateTicketNumber } from "../../src/utils/ticketNumber.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 3 Public Comments and Internal Notes API (Issue #26)", () => {
  let staffToken: string;
  let requesterToken: string;
  let otherRequesterToken: string;
  let testTicketId: string;

  beforeAll(async () => {
    const prisma = getPrisma();

    const staff = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });

    staffToken = createToken(staff!.id, "IT Staff", staff!.tokenVersion);
    requesterToken = createToken(alice!.id, "Requester", alice!.tokenVersion);
    otherRequesterToken = createToken(bob!.id, "Requester", bob!.tokenVersion);

    const accountCat = await prisma.category.findFirst();
    const portalSys = await prisma.relatedSystem.findFirst();

    const num = await allocateTicketNumber(prisma);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: alice!.id,
        categoryId: accountCat!.id,
        relatedSystemId: portalSys!.id,
        summary: "Comments Notes Test Ticket",
        description: "Test ticket for Issue #26 comments and notes isolation.",
        requestedPriority: "Low",
        itPriority: "Low",
        currentStatus: "New",
      },
    });

    testTicketId = ticket.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (testTicketId) {
      await prisma.ticketEvent.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticketComment.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.internalNote.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
    await prisma.$disconnect();
  });

  it("1. AC-23 / FR-21: IT Staff can add a Public Comment", async () => {
    const res = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: "Hello Alice, we are investigating your ticket." });

    expect(res.status).toBe(201);
    expect(res.body.comment).toBeDefined();
    expect(res.body.comment.body).toBe("Hello Alice, we are investigating your ticket.");
    expect(res.body.comment.author.role).toBe("IT Staff");
  });

  it("2. AC-23 / FR-21: Ticket Requester can view Public Comments", async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.comments).toBeDefined();
    expect(res.body.comments.length).toBeGreaterThan(0);
    expect(res.body.comments[0].body).toBe("Hello Alice, we are investigating your ticket.");
  });

  it("3. AC-23 / FR-21: Ticket Requester can post a Public Comment", async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ body: "Thank you for working on this!" });

    expect(res.status).toBe(201);
    expect(res.body.comment.body).toBe("Thank you for working on this!");
  });

  it("4. AC-24 / FR-22: IT Staff can add and view Internal Notes", async () => {
    const postRes = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/notes`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: "Internal Note: User has expired auth token in database." });

    expect(postRes.status).toBe(201);
    expect(postRes.body.note).toBeDefined();
    expect(postRes.body.note.body).toBe("Internal Note: User has expired auth token in database.");

    const getRes = await request(app)
      .get(`/api/v1/staff/tickets/${testTicketId}/notes`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.notes.length).toBeGreaterThan(0);
    expect(getRes.body.notes[0].body).toBe("Internal Note: User has expired auth token in database.");
  });

  it("5. AC-24 / FR-22: Requesters cannot access Internal Notes (403 Forbidden)", async () => {
    const res = await request(app)
      .get(`/api/v1/staff/tickets/${testTicketId}/notes`)
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(403);
  });

  it("6. AC-09 / FR-09: Unrelated Requester cannot view or post comments on another Requester's ticket", async () => {
    const getRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${otherRequesterToken}`);

    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${otherRequesterToken}`)
      .send({ body: "Unauthorized comment" });

    expect(postRes.status).toBe(403);
  });

  it("7. IT Staff and Administrator are rejected with 403 from Requester comment endpoints", async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.findFirst({ where: { role: "Administrator" } });
    const adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);

    // IT Staff calling GET /tickets/:id/comments
    const staffGet = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(staffGet.status).toBe(403);

    // IT Staff calling POST /tickets/:id/comments
    const staffPost = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: "Staff posting to Requester endpoint" });
    expect(staffPost.status).toBe(403);

    // Administrator calling GET /tickets/:id/comments
    const adminGet = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminGet.status).toBe(403);

    // Administrator calling POST /tickets/:id/comments
    const adminPost = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ body: "Admin posting to Requester endpoint" });
    expect(adminPost.status).toBe(403);
  });

  it("8. Empty/whitespace comment or note body returns 400 Bad Request across all endpoints", async () => {
    const staffCommentRes = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: "   " });
    expect(staffCommentRes.status).toBe(400);

    const staffNoteRes = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/notes`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: "   " });
    expect(staffNoteRes.status).toBe(400);

    const reqCommentRes = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ body: "   " });
    expect(reqCommentRes.status).toBe(400);
  });

  it("9. Body trimmed length >2000 characters is rejected with 400 Bad Request across all endpoints", async () => {
    const longBody = "A".repeat(2001);

    // Requester Public Comment POST
    const reqRes = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ body: longBody });
    expect(reqRes.status).toBe(400);

    // Staff Public Comment POST
    const staffCommentRes = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/comments`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: longBody });
    expect(staffCommentRes.status).toBe(400);

    // Staff Internal Note POST
    const staffNoteRes = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/notes`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ body: longBody });
    expect(staffNoteRes.status).toBe(400);
  });
});
