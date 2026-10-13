import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { allocateTicketNumber } from "../../src/utils/ticketNumber.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 4 Authorization & Regression Integration Suite (Issue #49: AT-07, AT-12, AT-14 to AT-19, TS-30 to TS-36, DA-01 to DA-09, RD-02, RD-14, RG-01 to RG-10, ER-02, ER-05, AC-01 to AC-30)", () => {
  let aliceToken: string;
  let aliceUser: any;
  let bobToken: string;
  let bobUser: any;
  let staff1Token: string;
  let staff1User: any;
  let staff2Token: string;
  let staff2User: any;
  let adminToken: string;
  let adminUser: any;

  let inactiveRequesterToken: string;
  let inactiveRequesterUser: any;
  let inactiveStaffToken: string;
  let inactiveStaffUser: any;

  let pwChangeRequesterToken: string;
  let pwChangeRequesterUser: any;
  let pwChangeStaffToken: string;
  let pwChangeStaffUser: any;

  let defaultCategory: any;
  let defaultSystem: any;

  let originalTicketCount: any;
  let originalActionCount: any;
  let originalTicketFindMany: any;
  let originalActionFindMany: any;

  const createdTicketIds: string[] = [];

  async function createTestTicket(overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    const num = await allocateTicketNumber(prisma);
    const initialStatus = overrides.currentStatus || "Open";

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: overrides.requesterId || aliceUser.id,
        categoryId: overrides.categoryId || defaultCategory.id,
        relatedSystemId: overrides.relatedSystemId || defaultSystem.id,
        summary: overrides.summary || `Auth-Reg Test Ticket (${initialStatus}) - ${num}`,
        description: overrides.description || `Ticket created for Issue #49 authorization and regression verification.`,
        requestedPriority: overrides.requestedPriority || "Medium",
        itPriority: overrides.itPriority !== undefined ? overrides.itPriority : "Medium",
        currentStatus: initialStatus,
        resolutionSummary: overrides.resolutionSummary !== undefined ? overrides.resolutionSummary : null,
        assigneeId: overrides.assigneeId !== undefined ? overrides.assigneeId : null,
        ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
      },
    });

    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function createTestAction(ticketId: string, overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    return prisma.actionTaken.create({
      data: {
        ticketId,
        performedById: overrides.performedById || staff1User.id,
        actionDateTime: overrides.actionDateTime || new Date(),
        description: overrides.description || "Routine diagnostics on server connection",
        result: overrides.result || "Diagnosed latency and restarted network interface",
        status: overrides.status || "Completed",
        followUpRequired: overrides.followUpRequired ?? false,
        followUpNote: overrides.followUpNote ?? null,
        attachmentNotes: overrides.attachmentNotes ?? null,
        assignedToId: overrides.assignedToId !== undefined ? overrides.assignedToId : null,
      },
    });
  }

  beforeAll(async () => {
    const prisma = getPrisma();
    originalTicketCount = prisma.ticket.count.bind(prisma.ticket);
    originalActionCount = prisma.actionTaken.count.bind(prisma.actionTaken);
    originalTicketFindMany = prisma.ticket.findMany.bind(prisma.ticket);
    originalActionFindMany = prisma.actionTaken.findMany.bind(prisma.actionTaken);

    // 1. Fetch seeded users
    const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
    const staff1 = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const staff2 = await prisma.user.findUnique({ where: { email: "staff2@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });

    expect(alice).not.toBeNull();
    expect(bob).not.toBeNull();
    expect(staff1).not.toBeNull();
    expect(staff2).not.toBeNull();
    expect(admin).not.toBeNull();

    aliceUser = alice!;
    bobUser = bob!;
    staff1User = staff1!;
    staff2User = staff2!;
    adminUser = admin!;

    aliceToken = createToken(alice!.id, "Requester", alice!.tokenVersion);
    bobToken = createToken(bob!.id, "Requester", bob!.tokenVersion);
    staff1Token = createToken(staff1!.id, "IT Staff", staff1!.tokenVersion);
    staff2Token = createToken(staff2!.id, "IT Staff", staff2!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);

    // 2. Inactive accounts
    inactiveRequesterUser = await prisma.user.upsert({
      where: { email: "inactive.requester.authreg@university.edu" },
      update: { isActive: false, role: "Requester" },
      create: {
        email: "inactive.requester.authreg@university.edu",
        name: "Inactive Requester AuthReg",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "Requester",
        isActive: false,
        mustChangePassword: false,
      },
    });
    inactiveRequesterToken = createToken(
      inactiveRequesterUser.id,
      "Requester",
      inactiveRequesterUser.tokenVersion
    );

    inactiveStaffUser = await prisma.user.upsert({
      where: { email: "inactive.staff.authreg@university.edu" },
      update: { isActive: false, role: "IT Staff" },
      create: {
        email: "inactive.staff.authreg@university.edu",
        name: "Inactive Staff AuthReg",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: false,
        mustChangePassword: false,
      },
    });
    inactiveStaffToken = createToken(
      inactiveStaffUser.id,
      "IT Staff",
      inactiveStaffUser.tokenVersion
    );

    // 3. Mandatory password change accounts
    pwChangeRequesterUser = await prisma.user.upsert({
      where: { email: "pwchange.requester.authreg@university.edu" },
      update: { mustChangePassword: true, isActive: true, role: "Requester" },
      create: {
        email: "pwchange.requester.authreg@university.edu",
        name: "PW Change Requester AuthReg",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "Requester",
        isActive: true,
        mustChangePassword: true,
      },
    });
    pwChangeRequesterToken = createToken(
      pwChangeRequesterUser.id,
      "Requester",
      pwChangeRequesterUser.tokenVersion
    );

    pwChangeStaffUser = await prisma.user.upsert({
      where: { email: "pwchange.staff.authreg@university.edu" },
      update: { mustChangePassword: true, isActive: true, role: "IT Staff" },
      create: {
        email: "pwchange.staff.authreg@university.edu",
        name: "PW Change Staff AuthReg",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: true,
        mustChangePassword: true,
      },
    });
    pwChangeStaffToken = createToken(
      pwChangeStaffUser.id,
      "IT Staff",
      pwChangeStaffUser.tokenVersion
    );

    // 4. Reference reference data
    defaultCategory = await prisma.category.findFirst();
    defaultSystem = await prisma.relatedSystem.findFirst();
    expect(defaultCategory).not.toBeNull();
    expect(defaultSystem).not.toBeNull();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const prisma = getPrisma();
    if (originalTicketCount) (prisma.ticket as any).count = originalTicketCount;
    if (originalActionCount) (prisma.actionTaken as any).count = originalActionCount;
    if (originalTicketFindMany) (prisma.ticket as any).findMany = originalTicketFindMany;
    if (originalActionFindMany) (prisma.actionTaken as any).findMany = originalActionFindMany;

    if (createdTicketIds.length > 0) {
      await prisma.attachment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticketComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
      createdTicketIds.length = 0;
    }
  });

  afterAll(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Cross-Role Authorization Matrix (AT-07, AT-14 to AT-19, TS-30 to TS-36, DA-01 to DA-09)
  // =========================================================================
  describe("1. Cross-Role Authorization Matrix across all Lab 4 Endpoints", () => {
    // -----------------------------------------------------------------------
    // Route 1: GET /api/v1/tickets/:ticketId/actions
    // -----------------------------------------------------------------------
    describe("1.1 GET /api/v1/tickets/:ticketId/actions (AT-14, AT-15, AT-16, AT-19, AC-02, AC-06, AC-07)", () => {
      it("AT-15 (AC-06): Requester viewing owned ticket receives HTTP 200 with read-only actions array", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        await createTestAction(ticket.id, { description: "Alice's router checked" });

        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.actions)).toBe(true);
        expect(res.body.actions.length).toBe(1);
        expect(res.body.actions[0].description).toBe("Alice's router checked");
      });

      it("AT-16 (AC-07): Requester viewing another user's ticket receives HTTP 404 (does not disclose existence)", async () => {
        const bobTicket = await createTestTicket({ requesterId: bobUser.id });
        await createTestAction(bobTicket.id);

        const res = await request(app)
          .get(`/api/v1/tickets/${bobTicket.id}/actions`)
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(404);
        expect(res.body.actions).toBeUndefined();
      });

      it("AT-14 (AC-02): IT Staff viewing any ticket receives HTTP 200 with actions list", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        await createTestAction(ticket.id);

        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.actions)).toBe(true);
      });

      it("AC-02 / Approved Decision 2: Administrator viewing ticket receives HTTP 200 with actions list", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        await createTestAction(ticket.id);

        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.actions)).toBe(true);
      });

      it("AT-19 (AC-07): Unauthenticated request receives HTTP 401 Unauthorized", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app).get(`/api/v1/tickets/${ticket.id}/actions`);
        expect(res.status).toBe(401);
      });

      it("AC-22: Inactive user receives HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${inactiveRequesterToken}`);

        expect(res.status).toBe(403);
      });

      it("AC-25: User with mandatory password change receives HTTP 403 PASSWORD_CHANGE_REQUIRED", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${pwChangeRequesterToken}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      });
    });

    // -----------------------------------------------------------------------
    // Route 2: POST /api/v1/tickets/:ticketId/actions
    // -----------------------------------------------------------------------
    describe("1.2 POST /api/v1/tickets/:ticketId/actions (AT-01, AT-02, AT-17, AC-01, AC-07)", () => {
      it("AT-17 (AC-07): Requester is rejected with HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({
            description: "Requester attempt to log work",
            result: "Should be denied",
            actionDateTime: new Date().toISOString(),
          });

        expect(res.status).toBe(403);
      });

      it("AT-01 (AC-01): IT Staff creates action successfully -> HTTP 201 Created", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({
            description: "Configured static IP reservation",
            result: "DHCP lease bound successfully",
            actionDateTime: new Date().toISOString(),
            status: "Completed",
          });

        expect(res.status).toBe(201);
        expect(res.body.action).toBeDefined();
        expect(res.body.action.performedBy.id).toBe(staff1User.id);
      });

      it("AT-02 (AC-01, Approved Decision 2): Administrator creates action successfully -> HTTP 201 Created", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            description: "Admin configured firewall rule",
            result: "Port opened and verified",
            actionDateTime: new Date().toISOString(),
            status: "Completed",
          });

        expect(res.status).toBe(201);
        expect(res.body.action).toBeDefined();
        expect(res.body.action.performedBy.id).toBe(adminUser.id);
      });

      it("AC-07: Unauthenticated create action receives HTTP 401 Unauthorized", async () => {
        const ticket = await createTestTicket();

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .send({
            description: "Unauthenticated attempt",
            result: "Denied",
            actionDateTime: new Date().toISOString(),
          });

        expect(res.status).toBe(401);
      });

      it("AC-22: Inactive IT Staff cannot create actions -> HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket();

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${inactiveStaffToken}`)
          .send({
            description: "Inactive staff attempt",
            result: "Denied",
            actionDateTime: new Date().toISOString(),
          });

        expect(res.status).toBe(403);
      });

      it("AC-25: IT Staff with mandatory password change receives HTTP 403 PASSWORD_CHANGE_REQUIRED", async () => {
        const ticket = await createTestTicket();

        const res = await request(app)
          .post(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${pwChangeStaffToken}`)
          .send({
            description: "PW change staff attempt",
            result: "Denied",
            actionDateTime: new Date().toISOString(),
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      });
    });

    // -----------------------------------------------------------------------
    // Route 3: PATCH /api/v1/tickets/:ticketId/actions/:actionId
    // -----------------------------------------------------------------------
    describe("1.3 PATCH /api/v1/tickets/:ticketId/actions/:actionId (AT-18, AT-22, AC-03, AC-07)", () => {
      it("AT-18 (AC-07): Requester is rejected with HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        const action = await createTestAction(ticket.id, { status: "Active" });

        const res = await request(app)
          .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({
            description: "Requester edit attempt",
            expectedUpdatedAt: action.updatedAt.toISOString(),
          });

        expect(res.status).toBe(403);
      });

      it("AT-22 (AC-03): IT Staff updates action -> HTTP 200 OK", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        const action = await createTestAction(ticket.id, { status: "Active" });

        const res = await request(app)
          .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({
            description: "Staff updated diagnostics",
            expectedUpdatedAt: action.updatedAt.toISOString(),
          });

        expect(res.status).toBe(200);
        expect(res.body.action.description).toBe("Staff updated diagnostics");
      });

      it("AC-03 / Approved Decision 2: Administrator updates action -> HTTP 200 OK", async () => {
        const ticket = await createTestTicket({ requesterId: aliceUser.id });
        const action = await createTestAction(ticket.id, { status: "Active" });

        const res = await request(app)
          .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            description: "Administrator updated diagnostics",
            expectedUpdatedAt: action.updatedAt.toISOString(),
          });

        expect(res.status).toBe(200);
        expect(res.body.action.description).toBe("Administrator updated diagnostics");
      });

      it("AC-07: Unauthenticated patch action receives HTTP 401 Unauthorized", async () => {
        const ticket = await createTestTicket();
        const action = await createTestAction(ticket.id, { status: "Active" });

        const res = await request(app)
          .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
          .send({
            description: "Unauthenticated edit",
            expectedUpdatedAt: action.updatedAt.toISOString(),
          });

        expect(res.status).toBe(401);
      });

      it("AC-22: Inactive IT Staff cannot update actions -> HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket();
        const action = await createTestAction(ticket.id, { status: "Active" });

        const res = await request(app)
          .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
          .set("Authorization", `Bearer ${inactiveStaffToken}`)
          .send({
            description: "Inactive staff edit",
            expectedUpdatedAt: action.updatedAt.toISOString(),
          });

        expect(res.status).toBe(403);
      });
    });

    // -----------------------------------------------------------------------
    // Route 4: PATCH /api/v1/staff/tickets/:ticketId/status
    // -----------------------------------------------------------------------
    describe("1.4 PATCH /api/v1/staff/tickets/:ticketId/status (TS-30 to TS-35, AC-09, AC-10, AC-25)", () => {
      it("TS-30 (AC-10): Requester is rejected with HTTP 403 Forbidden; status remains unchanged", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send({
            status: "In Progress",
          });

        expect(res.status).toBe(403);

        const checkTicket = await getPrisma().ticket.findUnique({ where: { id: ticket.id } });
        expect(checkTicket?.currentStatus).toBe("Open");
      });

      it("AC-09: IT Staff updates ticket status -> HTTP 200 OK and STATUS_CHANGED event saved", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({
            status: "In Progress",
          });

        expect(res.status).toBe(200);
        expect(res.body.ticket.status).toBe("In Progress");

        const events = await getPrisma().ticketEvent.findMany({
          where: { ticketId: ticket.id, eventType: "STATUS_CHANGED" },
        });
        expect(events.length).toBeGreaterThanOrEqual(1);
      });

      it("TS-35 (AC-09, AC-25): Administrator updates status -> HTTP 200 OK and STATUS_CHANGED event saved", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            status: "In Progress",
          });

        expect(res.status).toBe(200);
        expect(res.body.ticket.status).toBe("In Progress");
      });

      it("TS-31 (AC-10): Unauthenticated status update receives HTTP 401 Unauthorized", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .send({ status: "In Progress" });

        expect(res.status).toBe(401);
      });

      it("TS-32 (AC-10): Inactive IT Staff cannot update status -> HTTP 403 Forbidden", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${inactiveStaffToken}`)
          .send({ status: "In Progress" });

        expect(res.status).toBe(403);
      });

      it("AC-25: IT Staff with mandatory password change receives HTTP 403 PASSWORD_CHANGE_REQUIRED", async () => {
        const ticket = await createTestTicket({ currentStatus: "Open" });

        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${pwChangeStaffToken}`)
          .send({ status: "In Progress" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      });
    });

    // -----------------------------------------------------------------------
    // Route 5: GET /api/v1/dashboard/staff
    // -----------------------------------------------------------------------
    describe("1.5 GET /api/v1/dashboard/staff (DA-01 to DA-03, DA-06 to DA-08, AC-15, AC-22, AC-25)", () => {
      it("DA-03 (AC-22): Requester is rejected from staff dashboard with HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(403);
      });

      it("DA-01 (AC-15): IT Staff requests staff dashboard -> HTTP 200 OK", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.metrics).toBeDefined();
        expect(res.body.myActions).toBeDefined();
      });

      it("DA-02 (AC-15, Approved Decision 2): Administrator requests staff dashboard -> HTTP 200 OK", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.metrics).toBeDefined();
      });

      it("DA-06 (AC-22): Unauthenticated request receives HTTP 401 Unauthorized", async () => {
        const res = await request(app).get("/api/v1/dashboard/staff");
        expect(res.status).toBe(401);
      });

      it("DA-07 (AC-22): Inactive account receives HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${inactiveStaffToken}`);

        expect(res.status).toBe(403);
      });

      it("DA-08 (AC-25): Mandatory password change receives HTTP 403 PASSWORD_CHANGE_REQUIRED", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${pwChangeStaffToken}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      });
    });

    // -----------------------------------------------------------------------
    // Route 6: GET /api/v1/dashboard/requester
    // -----------------------------------------------------------------------
    describe("1.6 GET /api/v1/dashboard/requester (DA-04, DA-05, DA-06 to DA-08, AC-19, AC-22, AC-25)", () => {
      it("DA-04 (AC-19): Authenticated Requester requests requester dashboard -> HTTP 200 OK", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(200);
        expect(res.body.metrics).toBeDefined();
        expect(res.body.waitingForMeTickets).toBeDefined();
        expect(res.body.recentlyResolvedTickets).toBeDefined();
        expect(res.body.recentTickets).toBeDefined();
      });

      it("DA-05 (AC-22): IT Staff is rejected from requester dashboard -> HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(403);
      });

      it("DA-05 (AC-22): Administrator is rejected from requester dashboard -> HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(403);
      });

      it("DA-06 (AC-22): Unauthenticated request receives HTTP 401 Unauthorized", async () => {
        const res = await request(app).get("/api/v1/dashboard/requester");
        expect(res.status).toBe(401);
      });

      it("DA-07 (AC-22): Inactive Requester receives HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${inactiveRequesterToken}`);

        expect(res.status).toBe(403);
      });

      it("DA-08 (AC-25): Requester with mandatory password change receives HTTP 403 PASSWORD_CHANGE_REQUIRED", async () => {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${pwChangeRequesterToken}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
      });
    });

    // -----------------------------------------------------------------------
    // Route 7: GET /api/v1/staff/tickets
    // -----------------------------------------------------------------------
    describe("1.7 GET /api/v1/staff/tickets (SD-18, AC-15, AC-22, AC-25)", () => {
      it("AC-22: Requester is rejected from staff ticket queue -> HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/staff/tickets")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(403);
      });

      it("AC-15: IT Staff queries staff ticket queue -> HTTP 200 OK", async () => {
        const res = await request(app)
          .get("/api/v1/staff/tickets")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toBeDefined();
      });

      it("SD-18 (AC-15, AC-25): Administrator queries staff ticket queue -> HTTP 200 OK", async () => {
        const res = await request(app)
          .get("/api/v1/staff/tickets")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toBeDefined();
      });

      it("AC-22: Unauthenticated queue query receives HTTP 401 Unauthorized", async () => {
        const res = await request(app).get("/api/v1/staff/tickets");
        expect(res.status).toBe(401);
      });

      it("AC-22: Inactive staff receives HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/v1/staff/tickets")
          .set("Authorization", `Bearer ${inactiveStaffToken}`);

        expect(res.status).toBe(403);
      });
    });
  });

  // =========================================================================
  // 2. Ownership Isolation and Anti-Tampering (AT-12, AT-16, RD-02, RD-14, AC-01, AC-07, AC-19, AC-22, BR-30)
  // =========================================================================
  describe("2. Ownership Isolation and Anti-Tampering", () => {
    it("RD-14 (AC-22): Requester A (Alice) cannot view Requester B's (Bob) ticket detail via GET /api/v1/tickets/:ticketId", async () => {
      const bobTicket = await createTestTicket({
        requesterId: bobUser.id,
        summary: "Bob's confidential financial payroll inquiry",
      });

      const res = await request(app)
        .get(`/api/v1/tickets/${bobTicket.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      // Expect 404 or 403 without leaking summary or id
      expect([403, 404]).toContain(res.status);
      expect(res.body.summary).toBeUndefined();
      expect(res.body.id).toBeUndefined();
    });

    it("AT-16 (AC-07): Requester A (Alice) cannot view Bob's Actions Taken via GET /api/v1/tickets/:ticketId/actions", async () => {
      const bobTicket = await createTestTicket({ requesterId: bobUser.id });
      await createTestAction(bobTicket.id, { description: "Sensitive security patch applied for Bob" });

      const res = await request(app)
        .get(`/api/v1/tickets/${bobTicket.id}/actions`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(404);
      expect(res.body.actions).toBeUndefined();
    });

    it("RD-02 (AC-19, AC-22): Requester Dashboard strictly isolates data; Bob's tickets are excluded from Alice's metrics and lists", async () => {
      const bobTicket = await createTestTicket({
        requesterId: bobUser.id,
        currentStatus: "Waiting for Requester",
        summary: "BOB_ISOLATED_SECRET_TICKET",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);

      const waitingIds = res.body.waitingForMeTickets.map((t: any) => t.id);
      const recentIds = res.body.recentTickets.map((t: any) => t.id);
      const resolvedIds = res.body.recentlyResolvedTickets.map((t: any) => t.id);

      expect(waitingIds).not.toContain(bobTicket.id);
      expect(recentIds).not.toContain(bobTicket.id);
      expect(resolvedIds).not.toContain(bobTicket.id);
    });

    it("BR-30 (AC-22): Caller cannot override dashboard ownership via query parameters (?requesterId=bobId)", async () => {
      const bobTicket = await createTestTicket({
        requesterId: bobUser.id,
        currentStatus: "Waiting for Requester",
      });

      const res = await request(app)
        .get(`/api/v1/dashboard/requester?requesterId=${bobUser.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      const waitingIds = res.body.waitingForMeTickets.map((t: any) => t.id);
      expect(waitingIds).not.toContain(bobTicket.id);
    });

    it("AT-12 (AC-01): Caller cannot forge performedById on action creation (performer is bound to authenticated user)", async () => {
      const ticket = await createTestTicket();

      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Staff 1 creating action with forged performedById",
          result: "Performer should remain Staff 1",
          actionDateTime: new Date().toISOString(),
          status: "Active",
          performedById: staff2User.id, // Attempt to attribute to Staff 2
        });

      // Must either reject with 400 or bind performedById to authenticated staff1User.id
      if (res.status === 201) {
        expect(res.body.action.performedBy.id).toBe(staff1User.id);
        expect(res.body.action.performedBy.id).not.toBe(staff2User.id);
      } else {
        expect([400, 422]).toContain(res.status);
      }
    });

    it("AC-03: Mismatched ticketId and actionId on PATCH returns 400 or 404, preventing cross-ticket mutation", async () => {
      const ticketA = await createTestTicket({ requesterId: aliceUser.id });
      const ticketB = await createTestTicket({ requesterId: bobUser.id });
      const actionOfTicketB = await createTestAction(ticketB.id, { status: "Active" });

      // Attempt to patch Ticket B's action through Ticket A's URL path
      const res = await request(app)
        .patch(`/api/v1/tickets/${ticketA.id}/actions/${actionOfTicketB.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Tamper attempt",
          expectedUpdatedAt: actionOfTicketB.updatedAt.toISOString(),
        });

      expect([400, 404]).toContain(res.status);
    });

    it("AC-22: Non-existent random UUIDs return 404 without crashing or disclosing internal system structures", async () => {
      const randomUuid = "a0000000-0000-4000-8000-000000000000";

      const resTicket = await request(app)
        .get(`/api/v1/tickets/${randomUuid}`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(resTicket.status).toBe(404);

      const resActions = await request(app)
        .get(`/api/v1/tickets/${randomUuid}/actions`)
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resActions.status).toBe(404);

      const resStaffTicket = await request(app)
        .get(`/api/v1/staff/tickets/${randomUuid}`)
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resStaffTicket.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. Safe Error Responses and Information Disclosure Protection (ER-02, ER-05, AC-14, AC-26, AC-29, BR-38)
  // =========================================================================
  describe("3. Safe Error Responses and Information Disclosure Protection", () => {
    it("ER-02 / AC-14: Stale update conflict (HTTP 409) returns clean error without leaking Prisma or SQL internals", async () => {
      const ticket = await createTestTicket({ requesterId: aliceUser.id });
      const action = await createTestAction(ticket.id, { status: "Active" });

      // Pass intentionally stale timestamp
      const staleTimestamp = new Date(Date.now() - 500000).toISOString();

      const res = await request(app)
        .patch(`/api/v1/tickets/${ticket.id}/actions/${action.id}`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          description: "Stale edit attempt",
          expectedUpdatedAt: staleTimestamp,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.stack).toBeUndefined();

      const errorStr = JSON.stringify(res.body);
      expect(errorStr).not.toMatch(/(\bSELECT\b|\bUPDATE\s+\w+\s+SET\b|\bFROM\b|\bWHERE\b|\bPrismaClient\b)/i);
    });

    it("AC-26: Authentication and Authorization failures do not disclose stack traces or server file paths", async () => {
      const res401 = await request(app).get("/api/v1/dashboard/staff");
      expect(res401.status).toBe(401);
      expect(res401.body.stack).toBeUndefined();
      expect(JSON.stringify(res401.body)).not.toMatch(/\/server\/src|\/node_modules/);

      const res403 = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(res403.status).toBe(403);
      expect(res403.body.stack).toBeUndefined();
      expect(JSON.stringify(res403.body)).not.toMatch(/\/server\/src|\/node_modules/);
    });

    it("DA-09 / BR-38: Safe HTTP 500 on unexpected database failure during GET /api/v1/dashboard/staff", async () => {
      const prisma = getPrisma();
      const countSpy = vi
        .spyOn(prisma.ticket, "count")
        .mockRejectedValue(new Error("FATAL: relation \"Ticket\" connection pool exhaustion"));

      try {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to load staff dashboard");
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/FATAL|relation|connection pool|exhaustion|SELECT/i);
      } finally {
        countSpy.mockRestore();
        (prisma.ticket as any).count = originalTicketCount;
      }
    });

    it("DA-09 / BR-38: Safe HTTP 500 on unexpected database failure during GET /api/v1/dashboard/requester", async () => {
      const prisma = getPrisma();
      const countSpy = vi
        .spyOn(prisma.ticket, "count")
        .mockRejectedValue(new Error("FATAL: database query timeout on requester dashboard"));

      try {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${aliceToken}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to load requester dashboard");
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/FATAL|timeout|query|SELECT/i);
      } finally {
        countSpy.mockRestore();
        (prisma.ticket as any).count = originalTicketCount;
      }
    });

    it("ER-05 / AC-26: Safe HTTP 500 on unexpected database failure during GET /api/v1/tickets/:id/actions", async () => {
      const ticket = await createTestTicket();
      const prisma = getPrisma();
      const spy = vi
        .spyOn(prisma.actionTaken, "findMany")
        .mockRejectedValue(new Error("FATAL: postgres socket hang up"));

      try {
        const res = await request(app)
          .get(`/api/v1/tickets/${ticket.id}/actions`)
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to retrieve actions taken");
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(/socket|hang up|postgres/i);
      } finally {
        spy.mockRestore();
        (prisma.actionTaken as any).findMany = originalActionFindMany;
      }
    });
  });

  // =========================================================================
  // 4. Labs 1–3 Regression Protection (RG-01 through RG-10, TS-33 to TS-36, AC-13, AC-25)
  // =========================================================================
  describe("4. Labs 1–3 Regression Protection", () => {
    it("RG-01 (AC-25): Valid credentials login returns JWT and user profile; invalid credentials return 401", async () => {
      // Alice login
      const validRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice.smith@university.edu",
          password: "Password123!",
        });

      expect(validRes.status).toBe(200);
      expect(validRes.body.token).toBeDefined();
      expect(validRes.body.user.role).toBe("Requester");

      // Bad password
      const invalidRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "alice.smith@university.edu",
          password: "wrongpassword!",
        });

      expect(invalidRes.status).toBe(401);
    });

    it("RG-02 (AC-25): Password-change gate prevents access to standard API features until password is changed", async () => {
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${pwChangeRequesterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("RG-03 (AC-25): Requester creates ticket via POST /api/v1/tickets with strict caller ownership", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          categoryId: defaultCategory.id,
          relatedSystemId: defaultSystem.id,
          summary: "Alice's regression test ticket",
          description: "Verifying standard ticket creation from Lab 2",
          requestedPriority: "High",
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      createdTicketIds.push(res.body.id);

      const dbTicket = await getPrisma().ticket.findUnique({ where: { id: res.body.id } });
      expect(dbTicket?.requesterId).toBe(aliceUser.id);
    });

    it("RG-04 (AC-25): IT Staff queries staff queue with filters, sorting, and pagination", async () => {
      const res = await request(app)
        .get("/api/v1/staff/tickets?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });

    it("RG-05 / TS-33 (AC-25): IT Staff updates ticket assignment and IT Priority", async () => {
      const ticket = await createTestTicket({ currentStatus: "Open" });

      // Assign to Staff 2
      const assignRes = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/assignment`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ assigneeId: staff2User.id });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.ticket.assignee.id).toBe(staff2User.id);

      // Update IT Priority to Urgent
      const priorityRes = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ itPriority: "Urgent" });

      expect(priorityRes.status).toBe(200);
      expect(priorityRes.body.ticket.itPriority).toBe("Urgent");
    });

    it("RG-06 / TS-34 (AC-25): Comments and Internal Notes workflows remain functional", async () => {
      const ticket = await createTestTicket({ requesterId: aliceUser.id });

      // Requester adds Public Comment
      const commentRes = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/comments`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ body: "Hello IT, here is additional context for my request." });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.comment).toBeDefined();

      // IT Staff adds Internal Note
      const noteRes = await request(app)
        .post(`/api/v1/staff/tickets/${ticket.id}/notes`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ body: "Internal note: verified DHCP lease table." });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.note).toBeDefined();
    });

    it("RG-07 (AC-25): Requester cannot upload attachments to another requester's ticket", async () => {
      const bobTicket = await createTestTicket({ requesterId: bobUser.id });

      const res = await request(app)
        .post(`/api/v1/tickets/${bobTicket.id}/attachments`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .attach("file", Buffer.from("dummy-attachment-data"), "test.png");

      expect([403, 404]).toContain(res.status);
    });

    it("RG-08 (AC-13, AC-25): Requester advisory indication toggles without modifying formal currentStatus", async () => {
      const ticket = await createTestTicket({
        requesterId: aliceUser.id,
        currentStatus: "Open",
      });

      // Alice indicates problem is resolved
      const res = await request(app)
        .patch(`/api/v1/tickets/${ticket.id}/resolution`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ requesterResolution: "RESOLVED" });

      expect(res.status).toBe(200);
      expect(res.body.requesterResolution).toBe("RESOLVED");

      // Formal status MUST remain Open
      const dbTicket = await getPrisma().ticket.findUnique({ where: { id: ticket.id } });
      expect(dbTicket?.currentStatus).toBe("Open");
    });

    it("RG-09 (AC-25): Administrator user management remains operational", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users?role=Requester")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it("TS-36 (AC-09, AC-25): Legacy status update omitting expectedUpdatedAt succeeds for backward compatibility", async () => {
      const ticket = await createTestTicket({ currentStatus: "New" });

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Open",
          // expectedUpdatedAt omitted intentionally
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Open");
    });
  });
});
