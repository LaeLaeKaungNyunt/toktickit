import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

import { setStorageService, MockStorageService } from "../../src/services/storage.js";
import { allocateTicketNumber } from "../../src/utils/ticketNumber.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 3 IT Staff Ticket Detail & Operations API (Issue #26)", () => {
  let staff1Token: string;
  let staff1User: any;
  let staff2Token: string;
  let staff2User: any;
  let requesterToken: string;
  let requesterUser: any;
  let adminToken: string;
  let testTicketId: string;

  beforeAll(async () => {
    setStorageService(new MockStorageService());
    const prisma = getPrisma();

    const staff1 = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const staff2 = await prisma.user.findUnique({ where: { email: "staff2@university.edu" } });
    const requester = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });

    expect(staff1).not.toBeNull();
    expect(staff2).not.toBeNull();
    expect(requester).not.toBeNull();
    expect(admin).not.toBeNull();

    staff1User = staff1!;
    staff2User = staff2!;
    requesterUser = requester!;

    staff1Token = createToken(staff1!.id, "IT Staff", staff1!.tokenVersion);
    staff2Token = createToken(staff2!.id, "IT Staff", staff2!.tokenVersion);
    requesterToken = createToken(requester!.id, "Requester", requester!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);

    // Create a fresh test ticket
    const accountCat = await prisma.category.findFirst();
    const portalSys = await prisma.relatedSystem.findFirst();

    const num = await allocateTicketNumber(prisma);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: requester!.id,
        categoryId: accountCat!.id,
        relatedSystemId: portalSys!.id,
        summary: "Detail Operations Test Ticket",
        description: "Test ticket for Issue #26 operations.",
        requestedPriority: "Medium",
        itPriority: "Medium",
        currentStatus: "New",
        assigneeId: null,
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
      await prisma.attachment.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
    await prisma.$disconnect();
  });

  it("1. AC-18 / FR-17: Authorized IT Staff gets ticket detail with 200 OK", async () => {
    const res = await request(app)
      .get(`/api/v1/staff/tickets/${testTicketId}`)
      .set("Authorization", `Bearer ${staff1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.ticket.id).toBe(testTicketId);
    expect(res.body.ticket.summary).toBe("Detail Operations Test Ticket");
    expect(res.body.ticket.status).toBe("New");
  });

  it("2. AC-19 / FR-18: Claim ticket sets assigneeId to caller and DOES NOT alter ticket status", async () => {
    const res = await request(app)
      .post(`/api/v1/staff/tickets/${testTicketId}/claim`)
      .set("Authorization", `Bearer ${staff1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee.id).toBe(staff1User.id);

    // Verify in database that currentStatus is still "New"
    const prisma = getPrisma();
    const dbTicket = await prisma.ticket.findUnique({ where: { id: testTicketId } });
    expect(dbTicket?.assigneeId).toBe(staff1User.id);
    expect(dbTicket?.currentStatus).toBe("New");
  });

  it("3. AC-20 / FR-18: Reassign ticket to another valid IT Staff user", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/assignment`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ assigneeId: staff2User.id });

    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee.id).toBe(staff2User.id);
  });

  it("4. AC-20 / FR-18: Reassigning to a Requester or inactive user is rejected with 400 Bad Request", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/assignment`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ assigneeId: requesterUser.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Target assignee must be an active IT Staff or Administrator user");
  });

  it("5. AC-21 / FR-19: Valid IT Priority update persists", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/priority`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ itPriority: "Urgent" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.itPriority).toBe("Urgent");
  });

  it("6. AC-21 / FR-19: Invalid IT Priority value is rejected with 400 Bad Request", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/priority`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ itPriority: "SuperCritical" });

    expect(res.status).toBe(400);
  });

  it("7. AC-22 / FR-20: Permitted status transition New -> In Progress succeeds", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/status`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ status: "In Progress" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe("In Progress");
  });

  it("8. AC-22 / FR-20: Invalid status transition (In Progress -> Closed) returns 409 Conflict", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/status`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ status: "Closed" });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Status transition from 'In Progress' to 'Closed' is not permitted");
  });

  it("9. AC-22 / FR-20: Requesters cannot execute status transitions", async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/tickets/${testTicketId}/status`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ status: "Resolved" });

    expect(res.status).toBe(403);
  });

  it("10. AC-26 / FR-24: Requester resolution indication sets RESOLVED and DOES NOT change currentStatus for owning Requester", async () => {
    const statusBefore = (await getPrisma().ticket.findUnique({ where: { id: testTicketId } }))?.currentStatus;
    expect(statusBefore).toBe("In Progress");

    const res = await request(app)
      .patch(`/api/v1/tickets/${testTicketId}/resolution`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ requesterResolution: "RESOLVED" });

    expect(res.status).toBe(200);
    expect(res.body.requesterResolution).toBe("RESOLVED");

    const statusAfter = (await getPrisma().ticket.findUnique({ where: { id: testTicketId } }))?.currentStatus;
    expect(statusAfter).toBe("In Progress"); // Unchanged!
  });

  it("11. Resolution endpoint rejects non-owning Requester with 403 Forbidden", async () => {
    const prisma = getPrisma();
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
    const bobToken = createToken(bob!.id, "Requester", bob!.tokenVersion);

    const res = await request(app)
      .patch(`/api/v1/tickets/${testTicketId}/resolution`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ requesterResolution: "RESOLVED" });

    expect(res.status).toBe(403);
  });

  it("12. Resolution endpoint rejects IT Staff with 403 Forbidden", async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${testTicketId}/resolution`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ requesterResolution: "RESOLVED" });

    expect(res.status).toBe(403);
  });

  it("13. Resolution endpoint rejects Administrator with 403 Forbidden", async () => {
    const prisma = getPrisma();
    const admin = await prisma.user.findFirst({ where: { role: "Administrator" } });
    const adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);

    const res = await request(app)
      .patch(`/api/v1/tickets/${testTicketId}/resolution`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requesterResolution: "RESOLVED" });

    expect(res.status).toBe(403);
  });

  it("14. GET /api/v1/staff/users audit: requires staff auth and returns active IT Staff/Administrator with minimum fields (id, name, role)", async () => {
    const unauthRes = await request(app).get("/api/v1/staff/users");
    expect(unauthRes.status).toBe(401);

    const reqRes = await request(app)
      .get("/api/v1/staff/users")
      .set("Authorization", `Bearer ${requesterToken}`);
    expect(reqRes.status).toBe(403);

    const staffRes = await request(app)
      .get("/api/v1/staff/users")
      .set("Authorization", `Bearer ${staff1Token}`);

    expect(staffRes.status).toBe(200);
    expect(Array.isArray(staffRes.body.users)).toBe(true);
    expect(staffRes.body.users.length).toBeGreaterThan(0);

    for (const u of staffRes.body.users) {
      expect(u.id).toBeDefined();
      expect(u.name).toBeDefined();
      expect(u.role).toBeDefined();
      expect(["IT Staff", "Administrator"]).toContain(u.role);
      expect(u.passwordHash).toBeUndefined();
      expect(u.tokenVersion).toBeUndefined();
    }
  });

  it("16. AC-25: Authorized IT Staff can upload, view metadata, download, and soft-remove attachments", async () => {
    const prisma = getPrisma();

    // 1. IT Staff upload attachment
    const uploadRes = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/attachments`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .attach("file", Buffer.from("%PDF-1.4 dummy pdf content"), { filename: "staff-guide.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.id).toBeDefined();
    expect(uploadRes.body.originalFilename).toBe("staff-guide.pdf");

    const createdAttId = uploadRes.body.id;

    // 2. IT Staff view metadata
    const metaRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/attachments/${createdAttId}`)
      .set("Authorization", `Bearer ${staff1Token}`);

    expect(metaRes.status).toBe(200);
    expect(metaRes.body.id).toBe(createdAttId);

    // 3. Unrelated Requester cannot access attachment even with valid attachment ID (404 Not Found)
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
    const bobToken = createToken(bob!.id, "Requester", bob!.tokenVersion);

    const bobMetaRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/attachments/${createdAttId}`)
      .set("Authorization", `Bearer ${bobToken}`);
    expect(bobMetaRes.status).toBe(404);

    // 4. IT Staff download attachment
    const downloadRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/attachments/${createdAttId}/download`)
      .set("Authorization", `Bearer ${staff1Token}`);

    expect(downloadRes.status).toBe(200);

    // 5. IT Staff soft-remove attachment
    const removeRes = await request(app)
      .delete(`/api/v1/tickets/${testTicketId}/attachments/${createdAttId}`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ reason: "Duplicate file uploaded by staff" });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.removedAt).toBeDefined();

    // Verify in DB that ATTACHMENT_REMOVED event was logged with staff actorId
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: testTicketId, eventType: "ATTACHMENT_REMOVED" },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].actorId).toBe(staff1User.id);
  });

  it("17. AC-25: Administrator is rejected with 403 Forbidden on all attachment endpoints", async () => {
    // 1. POST /attachments
    const uploadRes = await request(app)
      .post(`/api/v1/tickets/${testTicketId}/attachments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("%PDF-1.4 admin test"), { filename: "admin.pdf", contentType: "application/pdf" });

    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.error).toBe("Forbidden: insufficient permissions");

    // 2. GET /attachments/:id
    const metaRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/attachments/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(metaRes.status).toBe(403);
    expect(metaRes.body.error).toBe("Forbidden: insufficient permissions");

    // 3. GET /attachments/:id/download
    const downloadRes = await request(app)
      .get(`/api/v1/tickets/${testTicketId}/attachments/00000000-0000-0000-0000-000000000000/download`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(downloadRes.status).toBe(403);
    expect(downloadRes.body.error).toBe("Forbidden: insufficient permissions");

    // 4. DELETE /attachments/:id
    const deleteRes = await request(app)
      .delete(`/api/v1/tickets/${testTicketId}/attachments/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Admin attempt" });

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error).toBe("Forbidden: insufficient permissions");
  });
});
