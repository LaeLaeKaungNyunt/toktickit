import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { allocateTicketNumber } from "../../src/utils/ticketNumber.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 4 Actions Taken API (Issue #45: AT-01 to AT-44)", () => {
  let staff1Token: string;
  let staff1User: any;
  let staff2Token: string;
  let staff2User: any;
  let adminToken: string;
  let adminUser: any;
  let aliceToken: string;
  let aliceUser: any;
  let bobToken: string;
  let bobUser: any;
  let inactiveStaffUser: any;

  let testTicketId: string;
  let otherTicketId: string;
  let emptyTicketId: string;

  beforeAll(async () => {
    const prisma = getPrisma();

    // 1. Fetch seeded users
    const staff1 = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const staff2 = await prisma.user.findUnique({ where: { email: "staff2@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });
    const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });

    expect(staff1).not.toBeNull();
    expect(staff2).not.toBeNull();
    expect(admin).not.toBeNull();
    expect(alice).not.toBeNull();
    expect(bob).not.toBeNull();

    staff1User = staff1!;
    staff2User = staff2!;
    adminUser = admin!;
    aliceUser = alice!;
    bobUser = bob!;

    staff1Token = createToken(staff1!.id, "IT Staff", staff1!.tokenVersion);
    staff2Token = createToken(staff2!.id, "IT Staff", staff2!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);
    aliceToken = createToken(alice!.id, "Requester", alice!.tokenVersion);
    bobToken = createToken(bob!.id, "Requester", bob!.tokenVersion);

    // 2. Ensure an inactive IT Staff member exists for assignment validation (AT-10)
    inactiveStaffUser = await prisma.user.upsert({
      where: { email: "inactive.staff.at45@university.edu" },
      update: { isActive: false, role: "IT Staff" },
      create: {
        email: "inactive.staff.at45@university.edu",
        name: "Inactive Staff",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: false,
      },
    });

    // 3. Create test tickets
    const accountCat = await prisma.category.findFirst();
    const portalSys = await prisma.relatedSystem.findFirst();
    expect(accountCat).not.toBeNull();
    expect(portalSys).not.toBeNull();

    const num1 = await allocateTicketNumber(prisma);
    const ticket1 = await prisma.ticket.create({
      data: {
        ticketNumber: num1,
        requesterId: alice!.id,
        categoryId: accountCat!.id,
        relatedSystemId: portalSys!.id,
        summary: "AT-45 Primary Test Ticket (Alice)",
        description: "Primary ticket for testing Actions Taken API.",
        requestedPriority: "Medium",
        itPriority: "Medium",
        currentStatus: "New",
      },
    });
    testTicketId = ticket1.id;

    const num2 = await allocateTicketNumber(prisma);
    const ticket2 = await prisma.ticket.create({
      data: {
        ticketNumber: num2,
        requesterId: bob!.id,
        categoryId: accountCat!.id,
        relatedSystemId: portalSys!.id,
        summary: "AT-45 Secondary Test Ticket (Bob)",
        description: "Ticket owned by Bob for testing ownership isolation.",
        requestedPriority: "Low",
        itPriority: "Low",
        currentStatus: "New",
      },
    });
    otherTicketId = ticket2.id;

    const num3 = await allocateTicketNumber(prisma);
    const ticket3 = await prisma.ticket.create({
      data: {
        ticketNumber: num3,
        requesterId: alice!.id,
        categoryId: accountCat!.id,
        relatedSystemId: portalSys!.id,
        summary: "AT-45 Empty Actions Test Ticket (Alice)",
        description: "Ticket with zero actions for testing empty array response.",
        requestedPriority: "Low",
        itPriority: "Low",
        currentStatus: "New",
      },
    });
    emptyTicketId = ticket3.id;
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const ticketIds = [testTicketId, otherTicketId, emptyTicketId].filter(Boolean);

    for (const tid of ticketIds) {
      // Delete any ActionsTaken if model exists in DB
      if ((prisma as any).actionTaken) {
        await (prisma as any).actionTaken.deleteMany({ where: { ticketId: tid } });
      }
      await prisma.ticketEvent.deleteMany({ where: { ticketId: tid } });
      await prisma.ticketComment.deleteMany({ where: { ticketId: tid } });
      await prisma.internalNote.deleteMany({ where: { ticketId: tid } });
      await prisma.attachment.deleteMany({ where: { ticketId: tid } });
      await prisma.ticket.deleteMany({ where: { id: tid } });
    }

    if (inactiveStaffUser?.id) {
      await prisma.user.deleteMany({ where: { id: inactiveStaffUser.id } });
    }

    await prisma.$disconnect();
  });

  // =========================================================================
  // Section 2.1 Creation and Validation (AT-01 to AT-13)
  // =========================================================================
  describe("2.1 Creation and Validation (AT-01 to AT-13)", () => {
    it("AT-01 (AC-01): IT Staff creates an action with valid required fields", async () => {
      const payload = {
        actionDateTime: "2026-10-11T09:30:00.000Z",
        description: "Checked network switch port 12",
        result: "Reconnected loose patch cable",
        assignedToId: staff2User.id,
        followUpRequired: true,
        followUpNote: "Order replacement Cat6 patch cable and test throughput",
        attachmentNotes: "Refer to photos attached to parent ticket",
      };

      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.action).toBeDefined();
      expect(res.body.action.id).toBeDefined();
      expect(res.body.action.ticketId).toBe(testTicketId);
      expect(res.body.action.actionDateTime).toBe("2026-10-11T09:30:00.000Z");
      expect(res.body.action.description).toBe("Checked network switch port 12");
      expect(res.body.action.result).toBe("Reconnected loose patch cable");
      expect(res.body.action.performedById).toBe(staff1User.id);
      expect(res.body.action.performedBy).toEqual({
        id: staff1User.id,
        name: staff1User.name,
      });
      expect(res.body.action.assignedToId).toBe(staff2User.id);
      expect(res.body.action.assignedTo).toEqual({
        id: staff2User.id,
        name: staff2User.name,
      });
      expect(res.body.action.followUpRequired).toBe(true);
      expect(res.body.action.followUpNote).toBe("Order replacement Cat6 patch cable and test throughput");
      expect(res.body.action.attachmentNotes).toBe("Refer to photos attached to parent ticket");
      expect(res.body.action.status).toBe("Active");
      expect(res.body.action.createdAt).toBeDefined();
      expect(res.body.action.updatedAt).toBeDefined();
    });

    it("AT-02 (AC-01): Administrator creates an action", async () => {
      const payload = {
        actionDateTime: "2026-10-11T10:00:00.000Z",
        description: "Admin verified core router configuration",
        result: "BGP routes successfully updated",
        followUpRequired: false,
      };

      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.action).toBeDefined();
      expect(res.body.action.performedById).toBe(adminUser.id);
      expect(res.body.action.performedBy).toEqual({
        id: adminUser.id,
        name: adminUser.name,
      });
      expect(res.body.action.status).toBe("Active");
    });

    it("AT-03 (AC-01): Create action with blank description returns 400", async () => {
      const resBlank = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "   ",
          result: "Valid result",
          followUpRequired: false,
        });

      expect(resBlank.status).toBe(400);

      const resEmpty = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "",
          result: "Valid result",
          followUpRequired: false,
        });

      expect(resEmpty.status).toBe(400);
    });

    it("AT-04 (AC-01): Create action with blank result returns 400", async () => {
      const resBlank = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "Valid description",
          result: "   ",
          followUpRequired: false,
        });

      expect(resBlank.status).toBe(400);

      const resEmpty = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "Valid description",
          result: "",
          followUpRequired: false,
        });

      expect(resEmpty.status).toBe(400);
    });

    it("AT-05 (AC-01): Create action without valid action date/time returns 400", async () => {
      const resInvalid = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "invalid-date-format",
          description: "Valid description",
          result: "Valid result",
          followUpRequired: false,
        });

      expect(resInvalid.status).toBe(400);

      const resMissing = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Valid description",
          result: "Valid result",
          followUpRequired: false,
        });

      expect(resMissing.status).toBe(400);
    });

    it("AT-06 (AC-04): Create action with followUpRequired = true and blank note returns 400", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "Valid description",
          result: "Valid result",
          followUpRequired: true,
          followUpNote: "   ",
        });

      expect(res.status).toBe(400);

      const resMissingNote = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:00:00.000Z",
          description: "Valid description",
          result: "Valid result",
          followUpRequired: true,
        });

      expect(resMissingNote.status).toBe(400);
    });

    it("AT-07 (AC-04): Create action with followUpRequired = false and no note succeeds", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:15:00.000Z",
          description: "Diagnosed DHCP server pool",
          result: "IP leases cleared and restored",
          followUpRequired: false,
          followUpNote: null,
        });

      expect(res.status).toBe(201);
      expect(res.body.action).toBeDefined();
      expect(res.body.action.followUpRequired).toBe(false);
      expect(res.body.action.followUpNote).toBeNull();
    });

    it("AT-08 (AC-01, AC-05): Create action with active IT Staff assignee succeeds", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:20:00.000Z",
          description: "Assigned hardware diagnostic to Alex Tech",
          result: "Assignment recorded",
          assignedToId: staff2User.id,
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.action.assignedToId).toBe(staff2User.id);
      expect(res.body.action.assignedTo).toEqual({
        id: staff2User.id,
        name: staff2User.name,
      });
    });

    it("AT-09 (AC-05): Create action with active Administrator assignee succeeds", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:25:00.000Z",
          description: "Escalated to Administrator for firewall policy update",
          result: "Assigned to Admin",
          assignedToId: adminUser.id,
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.action.assignedToId).toBe(adminUser.id);
      expect(res.body.action.assignedTo).toEqual({
        id: adminUser.id,
        name: adminUser.name,
      });
    });

    it("AT-10 (AC-05): Assign action to inactive user returns 400", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:30:00.000Z",
          description: "Attempted assignment to inactive staff",
          result: "Should fail validation",
          assignedToId: inactiveStaffUser.id,
          followUpRequired: false,
        });

      expect(res.status).toBe(400);
    });

    it("AT-11 (AC-05): Assign action to Requester returns 400", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:35:00.000Z",
          description: "Attempted assignment to requester Alice",
          result: "Should fail validation",
          assignedToId: aliceUser.id,
          followUpRequired: false,
        });

      expect(res.status).toBe(400);
    });

    it("AT-12 (AC-01): Client attempts to set performedById is rejected or overwritten with caller", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:40:00.000Z",
          description: "Impersonation test action",
          result: "Testing forged performer ID",
          performedById: staff2User.id, // Attempting to forge staff2
          followUpRequired: false,
        });

      // Contract requires: "performedById: Set automatically from authenticated caller (req.user.id); never accept from client body"
      // If endpoint returns 201, performedById must strictly match staff1User.id (not forged staff2User.id).
      // If endpoint returns 400, that is also a safe rejection.
      if (res.status === 201) {
        expect(res.body.action.performedById).toBe(staff1User.id);
        expect(res.body.action.performedBy.id).toBe(staff1User.id);
      } else {
        expect(res.status).toBe(400);
      }
    });

    it("AT-13 (AC-01): Create action for nonexistent Ticket returns 404", async () => {
      const res = await request(app)
        .post("/api/v1/tickets/00000000-0000-0000-0000-000000000000/actions")
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T10:45:00.000Z",
          description: "Action on missing ticket",
          result: "Should return 404",
          followUpRequired: false,
        });

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error).toBeDefined();
    });
  });

  // =========================================================================
  // Section 2.2 Listing and Ownership (AT-14 to AT-21)
  // =========================================================================
  describe("2.2 Listing and Ownership (AT-14 to AT-21)", () => {
    it("AT-14 (AC-02): IT Staff lists actions for an existing Ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.actions).toBeDefined();
      expect(Array.isArray(res.body.actions)).toBe(true);
    });

    it("AT-15 (AC-06): Requester lists actions for owned Ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions).toBeDefined();
      expect(Array.isArray(res.body.actions)).toBe(true);
    });

    it("AT-16 (AC-07): Requester lists actions for another user's Ticket returns 404", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${bobToken}`); // Bob requesting Alice's ticket

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error).toBeDefined();
      expect(res.body.actions).toBeUndefined();
    });

    it("AT-17 (AC-07): Requester attempts to create an action returns 403", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          actionDateTime: "2026-10-11T11:00:00.000Z",
          description: "Requester unauthorized creation attempt",
          result: "Forbidden",
          followUpRequired: false,
        });

      expect(res.status).toBe(403);
    });

    it("AT-18 (AC-07): Requester attempts to edit an action returns 403", async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/00000000-0000-0000-0000-000000000001`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          description: "Requester unauthorized edit attempt",
          expectedUpdatedAt: "2026-10-11T11:00:00.000Z",
        });

      expect(res.status).toBe(403);
    });

    it("AT-19 (AC-07): Unauthenticated user requests actions returns 401", async () => {
      const getRes = await request(app)
        .get(`/api/v1/tickets/${testTicketId}/actions`);
      expect(getRes.status).toBe(401);

      const postRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .send({
          actionDateTime: "2026-10-11T11:00:00.000Z",
          description: "Unauthenticated creation",
          result: "Should return 401",
          followUpRequired: false,
        });
      expect(postRes.status).toBe(401);

      const patchRes = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/00000000-0000-0000-0000-000000000001`)
        .send({
          description: "Unauthenticated edit",
          expectedUpdatedAt: "2026-10-11T11:00:00.000Z",
        });
      expect(patchRes.status).toBe(401);
    });

    it("AT-20 (AC-02): Ticket contains no actions returns 200 with empty array", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${emptyTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.actions).toBeDefined();
      expect(res.body.actions).toEqual([]);
    });

    it("AT-21 (AC-02): Multiple actions share the same action date/time follow stable ordering", async () => {
      const sharedDateTime = "2026-10-11T12:00:00.000Z";

      // Create two actions on otherTicketId with the same actionDateTime
      await request(app)
        .post(`/api/v1/tickets/${otherTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: sharedDateTime,
          description: "Action 1 with shared date",
          result: "Result 1",
          followUpRequired: false,
        });

      await request(app)
        .post(`/api/v1/tickets/${otherTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: sharedDateTime,
          description: "Action 2 with shared date",
          result: "Result 2",
          followUpRequired: false,
        });

      const res = await request(app)
        .get(`/api/v1/tickets/${otherTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.actions.length).toBeGreaterThanOrEqual(2);

      // Verify stable sorting: actionDateTime ASC, then createdAt ASC, then id ASC
      for (let i = 0; i < res.body.actions.length - 1; i++) {
        const a = res.body.actions[i];
        const b = res.body.actions[i + 1];

        const dateA = new Date(a.actionDateTime).getTime();
        const dateB = new Date(b.actionDateTime).getTime();
        expect(dateA).toBeLessThanOrEqual(dateB);

        if (dateA === dateB) {
          const createdA = new Date(a.createdAt).getTime();
          const createdB = new Date(b.createdAt).getTime();
          expect(createdA).toBeLessThanOrEqual(createdB);

          if (createdA === createdB) {
            expect(a.id.localeCompare(b.id)).toBeLessThanOrEqual(0);
          }
        }
      }
    });
  });

  // =========================================================================
  // Section 2.3 Editing and Assignment (AT-22 to AT-30)
  // =========================================================================
  describe("2.3 Editing and Assignment (AT-22 to AT-30)", () => {
    let editableAction: any;

    beforeAll(async () => {
      // Create a fresh action to edit
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T13:00:00.000Z",
          description: "Action to be edited",
          result: "Original result",
          followUpRequired: false,
          assignedToId: staff1User.id,
        });

      editableAction = createRes.body?.action;
    });

    it("AT-22 (AC-03): IT Staff edits action description and result", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Updated action description by Staff",
          result: "Updated action result by Staff",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.description).toBe("Updated action description by Staff");
      expect(res.body.action.result).toBe("Updated action result by Staff");
      expect(res.body.action.performedById).toBe(editableAction?.performedById || staff1User.id);
      editableAction = res.body.action;
    });

    it("AT-23 (AC-03): Administrator edits an action", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          description: "Admin reviewed and refined action description",
          result: "Admin confirmed action result",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.description).toBe("Admin reviewed and refined action description");
      editableAction = res.body.action;
    });

    it("AT-24 (AC-05): Edit action assignment to another active staff member", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          assignedToId: staff2User.id,
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.assignedToId).toBe(staff2User.id);
      expect(res.body.action.assignedTo).toEqual({
        id: staff2User.id,
        name: staff2User.name,
      });
      editableAction = res.body.action;
    });

    it("AT-25 (AC-05): Remove an optional action assignee", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          assignedToId: null,
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.assignedToId).toBeNull();
      expect(res.body.action.assignedTo).toBeNull();
      editableAction = res.body.action;
    });

    it("AT-26 (AC-03): Attempt to change ticketId or action id returns 400", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      // 1. Attempt to change ticketId
      const resTicketId = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          ticketId: otherTicketId,
          expectedUpdatedAt,
        });

      expect(resTicketId.status).toBe(400);

      // 2. Attempt to change ActionTaken id
      const resActionId = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          id: "00000000-0000-0000-0000-000000000099",
          expectedUpdatedAt,
        });

      expect(resActionId.status).toBe(400);
    });

    it("AT-27 (AC-03): Attempt to change performedById returns 400", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          performedById: staff2User.id,
          expectedUpdatedAt,
        });

      expect(res.status).toBe(400);
    });

    it("AT-28 (AC-04): Edit action with invalid follow-up combination returns 400", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const expectedUpdatedAt = editableAction?.updatedAt || "2026-10-11T13:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          followUpRequired: true,
          followUpNote: "   ",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(400);
    });

    it("AT-29 (AC-03): Action ID belongs to a different Ticket returns 404", async () => {
      expect(editableAction).toBeDefined();
      expect(editableAction?.id).toBeDefined();

      // Calling on otherTicketId while action belongs to testTicketId
      const res = await request(app)
        .patch(`/api/v1/tickets/${otherTicketId}/actions/${editableAction.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Mismatched ticket edit",
          expectedUpdatedAt: editableAction.updatedAt,
        });

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error).toBeDefined();
    });

    it("AT-30 (AC-14): Edit action using a stale expectedUpdatedAt returns 409", async () => {
      const actionId = editableAction?.id || "00000000-0000-0000-0000-000000000002";
      const staleTimestamp = "2020-01-01T00:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Stale concurrency test edit",
          expectedUpdatedAt: staleTimestamp,
        });

      expect(res.status).toBe(409);
    });
  });

  // =========================================================================
  // Section 2.4 Action Lifecycle (AT-31 to AT-36, AT-44)
  // =========================================================================
  describe("2.4 Action Lifecycle (AT-31 to AT-36, AT-44)", () => {
    let lifecycleAction: any;

    it("AT-31 (AC-01): Create a valid Action Taken has initial status Active", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T14:00:00.000Z",
          description: "Lifecycle test action",
          result: "In progress work",
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.action.status).toBe("Active");
      lifecycleAction = res.body.action;
    });

    it("AT-32 (AC-08): Transition Active -> Completed succeeds", async () => {
      const actionId = lifecycleAction?.id || "00000000-0000-0000-0000-000000000003";
      const expectedUpdatedAt = lifecycleAction?.updatedAt || "2026-10-11T14:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Completed",
          result: "Work fully verified and completed",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.status).toBe("Completed");
      lifecycleAction = res.body.action;
    });

    it("AT-33 (AC-08): Transition Active -> Cancelled succeeds", async () => {
      // Create a second action to test cancellation
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T14:10:00.000Z",
          description: "Action to cancel",
          result: "Work discontinued",
          followUpRequired: false,
        });

      expect(createRes.status).toBe(201);
      const actionToCancel = createRes.body.action;

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionToCancel.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Cancelled",
          expectedUpdatedAt: actionToCancel.updatedAt,
        });

      expect(res.status).toBe(200);
      expect(res.body.action.status).toBe("Cancelled");
    });

    it("AT-34 (AC-08): Transition Completed -> Active returns 409 Conflict", async () => {
      const actionId = lifecycleAction?.id || "00000000-0000-0000-0000-000000000003";
      const expectedUpdatedAt = lifecycleAction?.updatedAt || "2026-10-11T14:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Active",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(409);
    });

    it("AT-35 (AC-08): Transition Cancelled -> Completed returns 409 Conflict", async () => {
      // Create and cancel an action
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T14:20:00.000Z",
          description: "Action to cancel then try completing",
          result: "Cancelled work",
          followUpRequired: false,
        });

      const action = createRes.body?.action;
      const cancelRes = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${action?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Cancelled",
          expectedUpdatedAt: action?.updatedAt,
        });

      const cancelledAction = cancelRes.body?.action;

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${action?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Completed",
          expectedUpdatedAt: cancelledAction?.updatedAt,
        });

      expect(res.status).toBe(409);
    });

    it("AT-36 (AC-14): Two concurrent requests update the same action version; only one succeeds", async () => {
      // Create fresh action
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T14:30:00.000Z",
          description: "Action for concurrency race",
          result: "Initial state",
          followUpRequired: false,
        });

      const targetAction = createRes.body?.action;
      const expectedUpdatedAt = targetAction?.updatedAt;

      // Submit two updates simultaneously with the same expectedUpdatedAt
      const [req1, req2] = await Promise.all([
        request(app)
          .patch(`/api/v1/tickets/${testTicketId}/actions/${targetAction?.id}`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({
            description: "Concurrent update A",
            expectedUpdatedAt,
          }),
        request(app)
          .patch(`/api/v1/tickets/${testTicketId}/actions/${targetAction?.id}`)
          .set("Authorization", `Bearer ${staff2Token}`)
          .send({
            description: "Concurrent update B",
            expectedUpdatedAt,
          }),
      ]);

      const statuses = [req1.status, req2.status].sort();
      // One must succeed with 200, one must fail with 409
      expect(statuses).toEqual([200, 409]);
    });

    it("AT-44 (AC-03, AC-08): Attempt to edit fields or reassign a Completed or Cancelled Action Taken returns 409", async () => {
      // 1. Attempt edit on Completed action
      const completedActionId = lifecycleAction?.id || "00000000-0000-0000-0000-000000000003";
      const resCompleted = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${completedActionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Attempting to edit already Completed action",
          expectedUpdatedAt: lifecycleAction?.updatedAt,
        });

      expect(resCompleted.status).toBe(409);

      // 2. Create and cancel an action, then attempt to edit its description
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T14:40:00.000Z",
          description: "Action to cancel and try editing",
          result: "Initial result",
          followUpRequired: false,
        });

      const action = createRes.body?.action;
      const cancelRes = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${action?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Cancelled",
          expectedUpdatedAt: action?.updatedAt,
        });

      const cancelledAction = cancelRes.body?.action;

      const resCancelled = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${action?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Attempting to edit already Cancelled action",
          expectedUpdatedAt: cancelledAction?.updatedAt,
        });

      expect(resCancelled.status).toBe(409);
    });
  });

  // =========================================================================
  // Section 2.5 Audit History and Atomicity (AT-37 to AT-43)
  // =========================================================================
  describe("2.5 Audit History and Atomicity (AT-37 to AT-43)", () => {
    let auditAction: any;

    it("AT-37 (AC-01): Create Action Taken successfully creates ACTION_CREATED TicketEvent", async () => {
      const prisma = getPrisma();

      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T15:00:00.000Z",
          description: "Audit test action creation",
          result: "Event test result",
          followUpRequired: false,
        });

      expect(res.status).toBe(201);
      auditAction = res.body.action;

      const event = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_CREATED",
          actorId: staff1User.id,
        },
        orderBy: { createdAt: "desc" },
      });

      expect(event).not.toBeNull();
      expect(event?.actorId).toBe(staff1User.id);
      expect((event?.payloadJson as any)?.actionId).toBe(auditAction.id);
    });

    it("AT-38 (AC-03): Edit Action Taken successfully creates ACTION_UPDATED TicketEvent", async () => {
      const prisma = getPrisma();
      const actionId = auditAction?.id || "00000000-0000-0000-0000-000000000004";
      const expectedUpdatedAt = auditAction?.updatedAt || "2026-10-11T15:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Audit test action modified",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      auditAction = res.body.action;

      const event = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_UPDATED",
          actorId: staff1User.id,
        },
        orderBy: { createdAt: "desc" },
      });

      expect(event).not.toBeNull();
      expect(event?.actorId).toBe(staff1User.id);
      expect((event?.payloadJson as any)?.actionId).toBe(auditAction.id);
    });

    it("AT-39 (AC-08): Complete Action Taken creates ACTION_COMPLETED TicketEvent", async () => {
      const prisma = getPrisma();
      const actionId = auditAction?.id || "00000000-0000-0000-0000-000000000004";
      const expectedUpdatedAt = auditAction?.updatedAt || "2026-10-11T15:00:00.000Z";

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionId}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Completed",
          expectedUpdatedAt,
        });

      expect(res.status).toBe(200);
      auditAction = res.body.action;

      const event = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_COMPLETED",
          actorId: staff1User.id,
        },
        orderBy: { createdAt: "desc" },
      });

      expect(event).not.toBeNull();
      expect(event?.actorId).toBe(staff1User.id);
      expect((event?.payloadJson as any)?.actionId).toBe(auditAction.id);
    });

    it("AT-40 (AC-08): Cancel Action Taken creates ACTION_CANCELLED TicketEvent", async () => {
      const prisma = getPrisma();

      // Create new action to cancel
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T15:10:00.000Z",
          description: "Action to cancel for audit verification",
          result: "Cancelled result",
          followUpRequired: false,
        });

      const actionToCancel = createRes.body?.action;

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${actionToCancel?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Cancelled",
          expectedUpdatedAt: actionToCancel?.updatedAt,
        });

      expect(res.status).toBe(200);

      const event = await prisma.ticketEvent.findFirst({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_CANCELLED",
          actorId: staff1User.id,
        },
        orderBy: { createdAt: "desc" },
      });

      expect(event).not.toBeNull();
      expect(event?.actorId).toBe(staff1User.id);
      expect((event?.payloadJson as any)?.actionId).toBe(actionToCancel?.id);
    });

    it("AT-41 (AC-03): Submit invalid Action Taken update does not create new audit event", async () => {
      expect(auditAction).toBeDefined();
      expect(auditAction?.id).toBeDefined();

      const prisma = getPrisma();
      const initialCount = await prisma.ticketEvent.count({
        where: { ticketId: testTicketId },
      });

      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${auditAction.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "   ", // Invalid blank description
          expectedUpdatedAt: auditAction.updatedAt,
        });

      expect(res.status).toBe(400);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error).toBeDefined();

      const finalCount = await prisma.ticketEvent.count({
        where: { ticketId: testTicketId },
      });

      expect(finalCount).toBe(initialCount);
    });

    it("AT-42 (AC-03): Simulated transaction atomicity ensures no partial action or misleading event", async () => {
      const prisma = getPrisma();

      // Capture original method reference from the Prisma model delegate before mocking
      const originalCreate = prisma.ticketEvent.create;

      // Spy on prisma.ticketEvent.create to simulate failure during audit event persistence within the transaction
      const spy = vi.spyOn(prisma.ticketEvent, "create").mockRejectedValueOnce(
        new Error("Simulated database failure during audit event creation")
      );

      try {
        const res = await request(app)
          .post(`/api/v1/tickets/${testTicketId}/actions`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({
            actionDateTime: "2026-10-11T16:00:00.000Z",
            description: "Atomicity rollback test action",
            result: "Should roll back completely",
            followUpRequired: false,
          });

        // Endpoint must fail safely (500)
        expect(res.status).toBe(500);
        expect(res.headers["content-type"]).toMatch(/json/);
        expect(res.body.error).toBeDefined();

        // Database verification: ActionTaken must NOT have been saved
        expect((prisma as any).actionTaken).toBeDefined();
        const actions = await (prisma as any).actionTaken.findMany({
          where: {
            ticketId: testTicketId,
            description: "Atomicity rollback test action",
          },
        });
        expect(actions).toEqual([]);

        // No orphan TicketEvent was created
        const events = await prisma.ticketEvent.findMany({
          where: {
            ticketId: testTicketId,
            eventType: "ACTION_CREATED",
          },
        });
        const rollbackEvents = events.filter((e) =>
          JSON.stringify(e.payloadJson || {}).includes("Atomicity rollback test action")
        );
        expect(rollbackEvents).toEqual([]);
      } finally {
        spy.mockRestore();
        // Vitest's mockRestore restores an undefined descriptor due to Prisma Proxy delegate accessors.
        // Reliably restore the original callable delegate method onto the proxy target.
        if (typeof originalCreate === "function") {
          const desc = Object.getOwnPropertyDescriptor(prisma.ticketEvent, "create");
          if (!desc || desc.configurable || desc.writable) {
            Object.defineProperty(prisma.ticketEvent, "create", {
              value: originalCreate,
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      }
    });

    it("AT-43 (AC-03): Edit an existing Action Taken leaves earlier TicketEvent history unchanged", async () => {
      const prisma = getPrisma();

      const createdEventsBefore = await prisma.ticketEvent.findMany({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_CREATED",
        },
        orderBy: { createdAt: "asc" },
      });

      expect(createdEventsBefore.length).toBeGreaterThanOrEqual(1);

      // Perform an edit on an active action
      const createRes = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          actionDateTime: "2026-10-11T15:30:00.000Z",
          description: "Action for testing immutable past events",
          result: "Original result",
          followUpRequired: false,
        });

      const freshAction = createRes.body?.action;

      await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/actions/${freshAction?.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Edited action description",
          expectedUpdatedAt: freshAction?.updatedAt,
        });

      const createdEventsAfter = await prisma.ticketEvent.findMany({
        where: {
          ticketId: testTicketId,
          eventType: "ACTION_CREATED",
        },
        orderBy: { createdAt: "asc" },
      });

      // Earlier ACTION_CREATED records must not be deleted or modified
      expect(createdEventsAfter.length).toBeGreaterThan(createdEventsBefore.length);
      expect(createdEventsAfter[0].id).toBe(createdEventsBefore[0].id);
      expect(createdEventsAfter[0].createdAt).toEqual(createdEventsBefore[0].createdAt);
    });
  });
});
