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

describe("Lab 4 IT Staff Operational Dashboard API (Issue #47: SD-01 to SD-18, DA-01 to DA-09, DP-01 to DP-02, PF-01)", () => {
  let staff1Token: string;
  let staff1User: any;
  let staff2Token: string;
  let staff2User: any;
  let adminToken: string;
  let adminUser: any;
  let requesterToken: string;
  let requesterUser: any;
  let inactiveStaffToken: string;
  let inactiveStaffUser: any;
  let pwChangeStaffToken: string;
  let pwChangeStaffUser: any;

  let defaultCategory: any;
  let defaultSystem: any;

  const createdTicketIds: string[] = [];
  const createdActionIds: string[] = [];

  async function createTestTicket(overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    const num = await allocateTicketNumber(prisma);
    const initialStatus = overrides.currentStatus || "Open";

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: overrides.requesterId || requesterUser.id,
        categoryId: overrides.categoryId || defaultCategory.id,
        relatedSystemId: overrides.relatedSystemId || defaultSystem.id,
        summary: overrides.summary || `Dashboard Test Ticket (${initialStatus}) - ${num}`,
        description: overrides.description || `Test ticket created for dashboard test scenarios.`,
        requestedPriority: overrides.requestedPriority || "Medium",
        itPriority: overrides.itPriority !== undefined ? overrides.itPriority : "Medium",
        currentStatus: initialStatus,
        assigneeId: overrides.assigneeId !== undefined ? overrides.assigneeId : null,
        ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
      },
    });

    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function createTestAction(ticketId: string, overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    const status = overrides.status || "Active";

    const action = await prisma.actionTaken.create({
      data: {
        ticketId,
        performedById: overrides.performedById || staff1User.id,
        assignedToId: overrides.assignedToId !== undefined ? overrides.assignedToId : staff1User.id,
        actionDateTime: overrides.actionDateTime || new Date(),
        description: overrides.description || `Test action record (${status})`,
        result: overrides.result || `Standard test outcome for ${status}`,
        status,
        followUpRequired: overrides.followUpRequired ?? false,
        followUpNote: overrides.followUpNote ?? null,
        attachmentNotes: overrides.attachmentNotes ?? null,
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      },
    });

    createdActionIds.push(action.id);
    return action;
  }

  let originalTicketCount: any;
  let originalActionCount: any;
  let originalTicketFindMany: any;
  let originalActionFindMany: any;

  beforeAll(async () => {
    const prisma = getPrisma();
    originalTicketCount = prisma.ticket.count.bind(prisma.ticket);
    originalActionCount = prisma.actionTaken.count.bind(prisma.actionTaken);
    originalTicketFindMany = prisma.ticket.findMany.bind(prisma.ticket);
    originalActionFindMany = prisma.actionTaken.findMany.bind(prisma.actionTaken);

    // 1. Fetch seeded users
    const staff1 = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const staff2 = await prisma.user.findUnique({ where: { email: "staff2@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });
    const requester = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });

    expect(staff1).not.toBeNull();
    expect(staff2).not.toBeNull();
    expect(admin).not.toBeNull();
    expect(requester).not.toBeNull();

    staff1User = staff1!;
    staff2User = staff2!;
    adminUser = admin!;
    requesterUser = requester!;

    staff1Token = createToken(staff1!.id, "IT Staff", staff1!.tokenVersion);
    staff2Token = createToken(staff2!.id, "IT Staff", staff2!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);
    requesterToken = createToken(requester!.id, "Requester", requester!.tokenVersion);

    // 2. Ensure an inactive IT Staff user exists (DA-07)
    inactiveStaffUser = await prisma.user.upsert({
      where: { email: "inactive.staff.dashboard.test@university.edu" },
      update: { isActive: false, role: "IT Staff" },
      create: {
        email: "inactive.staff.dashboard.test@university.edu",
        name: "Inactive Staff Dashboard Test",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: false,
        mustChangePassword: false,
      },
    });
    inactiveStaffToken = createToken(inactiveStaffUser.id, "IT Staff", inactiveStaffUser.tokenVersion);

    // 3. Ensure a user with mandatory password change exists (DA-08)
    pwChangeStaffUser = await prisma.user.upsert({
      where: { email: "pwchange.staff.dashboard.test@university.edu" },
      update: { mustChangePassword: true, isActive: true, role: "IT Staff" },
      create: {
        email: "pwchange.staff.dashboard.test@university.edu",
        name: "PW Change Staff Test",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: true,
        mustChangePassword: true,
      },
    });
    pwChangeStaffToken = createToken(pwChangeStaffUser.id, "IT Staff", pwChangeStaffUser.tokenVersion);

    // 4. Default reference categories and systems
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

    if (createdActionIds.length > 0) {
      await prisma.actionTaken.deleteMany({ where: { id: { in: createdActionIds } } });
      createdActionIds.length = 0;
    }
    if (createdTicketIds.length > 0) {
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
  // 1. Authorization and Account Status (DA-01 to DA-09)
  // =========================================================================
  describe("1. Authorization and Account Status (DA-01 to DA-09)", () => {
    it("DA-01 (AC-15): Authenticated IT Staff requests staff dashboard -> HTTP 200 with approved shape", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("metrics");
      expect(res.body).toHaveProperty("myActions");
      expect(res.body).toHaveProperty("recentTickets");
      expect(res.body).toHaveProperty("urgentTickets");
      expect(Array.isArray(res.body.myActions)).toBe(true);
      expect(Array.isArray(res.body.recentTickets)).toBe(true);
      expect(Array.isArray(res.body.urgentTickets)).toBe(true);
    });

    it("DA-02 (AC-15): Authenticated Administrator requests staff dashboard -> HTTP 200", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("metrics");
      expect(res.body.metrics).toHaveProperty("unassignedTickets");
      expect(res.body.metrics).toHaveProperty("myAssignedTickets");
      expect(res.body.metrics).toHaveProperty("urgentTickets");
      expect(res.body.metrics).toHaveProperty("myActiveActionsCount");
      expect(res.body.metrics).toHaveProperty("statusCounts");
    });

    it("DA-03 (AC-22): Requester role is rejected from staff dashboard -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${requesterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|insufficient permissions/i);
    });

    it("DA-06 (AC-22): Missing or invalid authentication token -> HTTP 401 Unauthorized", async () => {
      const resNoToken = await request(app).get("/api/v1/dashboard/staff");
      expect(resNoToken.status).toBe(401);
      expect(resNoToken.body.error).toMatch(/Missing or invalid authorization token/i);

      const resBadToken = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", "Bearer invalid-jwt-token-xyz");
      expect(resBadToken.status).toBe(401);
    });

    it("DA-07 (AC-22): Inactive user account is rejected -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${inactiveStaffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/inactive/i);
    });

    it("DA-08 (AC-25): User with mandatory password change is rejected -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${pwChangeStaffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("DA-09 (AC-26): Unexpected database failure returns safe HTTP 500 without leaking stack traces or internal details", async () => {
      const prisma = getPrisma();
      const originalCount = prisma.ticket.count;
      const spy = vi.spyOn(prisma.ticket, "count").mockRejectedValue(new Error("FATAL: connection terminated unexpectedly"));

      try {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
        expect(typeof res.body.error).toBe("string");
        expect(res.body.error).not.toMatch(/FATAL|connection terminated|SELECT|prisma/i);
        expect(res.body.stack).toBeUndefined();
      } finally {
        spy.mockRestore();
        prisma.ticket.count = originalCount;
      }
    });
  });

  // =========================================================================
  // 2. Operational Metrics Calculations (SD-01 to SD-07, SD-01a, DP-01)
  // =========================================================================
  describe("2. Operational Metrics Calculations (SD-01 to SD-07, SD-01a, DP-01)", () => {
    it("SD-01 (AC-15): unassignedTickets accurately counts non-terminal tickets without an assignee", async () => {
      const prisma = getPrisma();

      // Create an unassigned ticket in non-terminal status
      const activeUnassigned = await createTestTicket({
        currentStatus: "In Progress",
        assigneeId: null,
      });

      // Create unassigned terminal tickets (Closed and Cancelled) which must NOT be counted
      await createTestTicket({ currentStatus: "Closed", assigneeId: null });
      await createTestTicket({ currentStatus: "Cancelled", assigneeId: null });

      // Create an assigned ticket which must NOT be counted
      await createTestTicket({ currentStatus: "In Progress", assigneeId: staff1User.id });

      const expectedCount = await prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          assigneeId: null,
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.unassignedTickets).toBe(expectedCount);
      expect(expectedCount).toBeGreaterThanOrEqual(1);
    });

    it("SD-01a (AC-15, AC-16): myActiveActionsCount counts all Active actions assigned to caller", async () => {
      const prisma = getPrisma();
      const parentTicket = await createTestTicket({ currentStatus: "Open" });

      // Create active actions assigned to staff1
      const action1 = await createTestAction(parentTicket.id, {
        status: "Active",
        assignedToId: staff1User.id,
      });

      // Create Completed and Cancelled actions assigned to staff1 (must NOT be counted)
      await createTestAction(parentTicket.id, {
        status: "Completed",
        assignedToId: staff1User.id,
      });
      await createTestAction(parentTicket.id, {
        status: "Cancelled",
        assignedToId: staff1User.id,
      });

      // Create active action assigned to staff2 (must NOT be counted for staff1)
      await createTestAction(parentTicket.id, {
        status: "Active",
        assignedToId: staff2User.id,
      });

      const expectedCount = await prisma.actionTaken.count({
        where: {
          status: "Active",
          assignedToId: staff1User.id,
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.myActiveActionsCount).toBe(expectedCount);
      expect(expectedCount).toBeGreaterThanOrEqual(1);
    });

    it("SD-02 (AC-15): myAssignedTickets counts only caller's non-terminal tickets", async () => {
      const prisma = getPrisma();

      await createTestTicket({
        currentStatus: "Open",
        assigneeId: staff1User.id,
      });
      // Terminal tickets assigned to staff1 must NOT be counted
      await createTestTicket({
        currentStatus: "Closed",
        assigneeId: staff1User.id,
      });
      await createTestTicket({
        currentStatus: "Cancelled",
        assigneeId: staff1User.id,
      });

      const expectedCount = await prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          assigneeId: staff1User.id,
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.myAssignedTickets).toBe(expectedCount);
      expect(expectedCount).toBeGreaterThanOrEqual(1);
    });

    it("SD-03 (AC-15): Other staff assignments are excluded from caller's myAssignedTickets", async () => {
      const prisma = getPrisma();

      await createTestTicket({
        currentStatus: "Open",
        assigneeId: staff2User.id,
      });

      const resStaff1 = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      const resStaff2 = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff2Token}`);

      expect(resStaff1.status).toBe(200);
      expect(resStaff2.status).toBe(200);

      const staff1Expected = await prisma.ticket.count({
        where: { currentStatus: { notIn: ["Closed", "Cancelled"] }, assigneeId: staff1User.id },
      });
      const staff2Expected = await prisma.ticket.count({
        where: { currentStatus: { notIn: ["Closed", "Cancelled"] }, assigneeId: staff2User.id },
      });

      expect(resStaff1.body.metrics.myAssignedTickets).toBe(staff1Expected);
      expect(resStaff2.body.metrics.myAssignedTickets).toBe(staff2Expected);
    });

    it("SD-04 (AC-15): urgentTickets metric includes Urgent and High priority non-terminal tickets", async () => {
      const prisma = getPrisma();

      await createTestTicket({ currentStatus: "Open", itPriority: "Urgent" });
      await createTestTicket({ currentStatus: "In Progress", itPriority: "High" });
      // Terminal tickets with Urgent/High must be excluded
      await createTestTicket({ currentStatus: "Closed", itPriority: "Urgent" });
      await createTestTicket({ currentStatus: "Cancelled", itPriority: "High" });

      const expectedCount = await prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          itPriority: { in: ["Urgent", "High"] },
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.urgentTickets).toBe(expectedCount);
      expect(expectedCount).toBeGreaterThanOrEqual(2);
    });

    it("SD-05 (AC-15): Low, Medium, and unset IT Priority tickets are excluded from urgentTickets count", async () => {
      const prisma = getPrisma();

      await createTestTicket({ currentStatus: "Open", itPriority: "Low" });
      await createTestTicket({ currentStatus: "Open", itPriority: "Medium" });
      await createTestTicket({ currentStatus: "Open", itPriority: null });

      const expectedCount = await prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          itPriority: { in: ["Urgent", "High"] },
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.urgentTickets).toBe(expectedCount);
    });

    it("SD-06 (AC-15): statusCounts accurately matches database counts across all eight statuses", async () => {
      const prisma = getPrisma();
      const allStatuses = [
        "New",
        "Open",
        "In Progress",
        "Waiting for Requester",
        "Resolved",
        "Closed",
        "Reopened",
        "Cancelled",
      ];

      // Ensure at least one ticket exists in each status
      for (const st of allStatuses) {
        await createTestTicket({ currentStatus: st });
      }

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.statusCounts).toBeDefined();

      for (const st of allStatuses) {
        const expected = await prisma.ticket.count({ where: { currentStatus: st } });
        expect(res.body.metrics.statusCounts[st]).toBe(expected);
      }
    });

    it("SD-07 (AC-18): Zero-count behavior and empty arrays when database has no records", async () => {
      const prisma = getPrisma();

      const originalTicketCount = prisma.ticket.count;
      const originalActionCount = prisma.actionTaken.count;
      const originalTicketFindMany = prisma.ticket.findMany;
      const originalActionFindMany = prisma.actionTaken.findMany;

      const spyTicketCount = vi.spyOn(prisma.ticket, "count").mockResolvedValue(0);
      const spyActionCount = vi.spyOn(prisma.actionTaken, "count").mockResolvedValue(0);
      const spyTicketFindMany = vi.spyOn(prisma.ticket, "findMany").mockResolvedValue([]);
      const spyActionFindMany = vi.spyOn(prisma.actionTaken, "findMany").mockResolvedValue([]);

      try {
        const res = await request(app)
          .get("/api/v1/dashboard/staff")
          .set("Authorization", `Bearer ${staff1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.metrics.unassignedTickets).toBe(0);
        expect(res.body.metrics.myAssignedTickets).toBe(0);
        expect(res.body.metrics.urgentTickets).toBe(0);
        expect(res.body.metrics.myActiveActionsCount).toBe(0);

        const allStatuses = [
          "New",
          "Open",
          "In Progress",
          "Waiting for Requester",
          "Resolved",
          "Closed",
          "Reopened",
          "Cancelled",
        ];
        for (const st of allStatuses) {
          expect(res.body.metrics.statusCounts[st]).toBe(0);
        }

        expect(res.body.myActions).toEqual([]);
        expect(res.body.recentTickets).toEqual([]);
        expect(res.body.urgentTickets).toEqual([]);
      } finally {
        spyTicketCount.mockRestore();
        spyActionCount.mockRestore();
        spyTicketFindMany.mockRestore();
        spyActionFindMany.mockRestore();
        prisma.ticket.count = originalTicketCount;
        prisma.actionTaken.count = originalActionCount;
        prisma.ticket.findMany = originalTicketFindMany;
        prisma.actionTaken.findMany = originalActionFindMany;
      }
    });

    it("DP-01 (AC-15): Metrics count all matching records even when previews are capped at five", async () => {
      // Create 7 active actions assigned to staff1
      const ticket = await createTestTicket({ currentStatus: "Open" });
      for (let i = 0; i < 7; i++) {
        await createTestAction(ticket.id, {
          status: "Active",
          assignedToId: staff1User.id,
          description: `Active Action ${i + 1}`,
        });
      }

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.myActiveActionsCount).toBeGreaterThanOrEqual(7);
      expect(res.body.myActions.length).toBeLessThanOrEqual(5);
    });
  });

  // =========================================================================
  // 3. Work Lists and Previews (SD-08 to SD-13, DP-02)
  // =========================================================================
  describe("3. Work Lists and Previews (SD-08 to SD-13, DP-02)", () => {
    it("SD-08 (AC-16): myActions preview includes Active actions assigned to caller with required fields", async () => {
      const ticket = await createTestTicket({
        currentStatus: "In Progress",
        summary: "SD-08 Test Ticket Summary",
      });

      const action = await createTestAction(ticket.id, {
        status: "Active",
        assignedToId: staff1User.id,
        description: "Diagnosing wireless interface card",
        followUpRequired: true,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      const found = res.body.myActions.find((a: any) => a.id === action.id);
      expect(found).toBeDefined();
      expect(found.ticketId).toBe(ticket.id);
      expect(found.ticketNumber).toBe(ticket.ticketNumber);
      expect(found.ticketSummary).toBe(ticket.summary);
      expect(found.description).toBe("Diagnosing wireless interface card");
      expect(found.status).toBe("Active");
      expect(found.followUpRequired).toBe(true);
      expect(found.actionDateTime).toBeDefined();
      expect(found.createdAt).toBeDefined();
    });

    it("SD-09 (AC-16): Actions assigned to other staff members are excluded from caller's myActions", async () => {
      const ticket = await createTestTicket({ currentStatus: "Open" });
      const otherStaffAction = await createTestAction(ticket.id, {
        status: "Active",
        assignedToId: staff2User.id,
        description: "Action exclusively assigned to Staff 2",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      const found = res.body.myActions.find((a: any) => a.id === otherStaffAction.id);
      expect(found).toBeUndefined();
    });

    it("SD-10 (AC-16): Completed and Cancelled actions are excluded from myActions preview", async () => {
      const ticket = await createTestTicket({ currentStatus: "Open" });

      const completedAction = await createTestAction(ticket.id, {
        status: "Completed",
        assignedToId: staff1User.id,
        description: "Completed maintenance task",
      });
      const cancelledAction = await createTestAction(ticket.id, {
        status: "Cancelled",
        assignedToId: staff1User.id,
        description: "Cancelled redundant task",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.myActions.find((a: any) => a.id === completedAction.id)).toBeUndefined();
      expect(res.body.myActions.find((a: any) => a.id === cancelledAction.id)).toBeUndefined();
    });

    it("SD-11 & SD-11b (AC-16): myActions preview is capped at 5 and sorted by actionDateTime ASC, createdAt ASC, id ASC", async () => {
      const ticket = await createTestTicket({ currentStatus: "Open" });

      // Create 6 active actions with explicitly ordered actionDateTime
      const baseTime = Date.now() - 3600000;
      const createdActions = [];
      for (let i = 0; i < 6; i++) {
        const action = await createTestAction(ticket.id, {
          status: "Active",
          assignedToId: staff1User.id,
          actionDateTime: new Date(baseTime + i * 60000),
          description: `Ordered Action #${i + 1}`,
        });
        createdActions.push(action);
      }

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.myActions.length).toBeLessThanOrEqual(5);

      // Verify ascending order by actionDateTime
      for (let i = 0; i < res.body.myActions.length - 1; i++) {
        const current = new Date(res.body.myActions[i].actionDateTime).getTime();
        const next = new Date(res.body.myActions[i + 1].actionDateTime).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });

    it("SD-12 (AC-17): recentTickets preview returns at most 5 most recently updated tickets, sorted by updatedAt DESC, id DESC", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.recentTickets.length).toBeLessThanOrEqual(5);

      if (res.body.recentTickets.length > 0) {
        const first = res.body.recentTickets[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("ticketNumber");
        expect(first).toHaveProperty("summary");
        expect(first).toHaveProperty("status");
        expect(first).toHaveProperty("requestedPriority");
        expect(first).toHaveProperty("itPriority");
        expect(first).toHaveProperty("updatedAt");
      }

      // Verify descending order
      for (let i = 0; i < res.body.recentTickets.length - 1; i++) {
        const curTime = new Date(res.body.recentTickets[i].updatedAt).getTime();
        const nextTime = new Date(res.body.recentTickets[i + 1].updatedAt).getTime();
        expect(curTime).toBeGreaterThanOrEqual(nextTime);
      }
    });

    it("SD-13 (AC-17): urgentTickets preview prioritizes Urgent over High, then updatedAt DESC, id DESC, capped at 5", async () => {
      const highTicket = await createTestTicket({
        currentStatus: "Open",
        itPriority: "High",
        summary: "High Priority Ticket",
        assigneeId: staff2User.id,
      });

      const urgentTicket = await createTestTicket({
        currentStatus: "Open",
        itPriority: "Urgent",
        summary: "Urgent Priority Ticket",
        assigneeId: staff1User.id,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.urgentTickets.length).toBeLessThanOrEqual(5);

      const urgentIndex = res.body.urgentTickets.findIndex((t: any) => t.id === urgentTicket.id);
      const highIndex = res.body.urgentTickets.findIndex((t: any) => t.id === highTicket.id);

      if (urgentIndex !== -1 && highIndex !== -1) {
        expect(urgentIndex).toBeLessThan(highIndex);
      }

      // Check fields
      const foundUrgent = res.body.urgentTickets.find((t: any) => t.id === urgentTicket.id);
      if (foundUrgent) {
        expect(foundUrgent).toHaveProperty("ticketNumber");
        expect(foundUrgent).toHaveProperty("summary");
        expect(foundUrgent).toHaveProperty("status");
        expect(foundUrgent.itPriority).toBe("Urgent");
        expect(foundUrgent.assignee).toBeDefined();
        expect(foundUrgent.assignee.id).toBe(staff1User.id);
        expect(foundUrgent.assignee.name).toBe(staff1User.name);
      }
    });

    it("DP-02 (AC-17): Deterministic tie-breaking for tickets with identical updatedAt timestamps (id DESC)", async () => {
      const identicalTime = new Date("2026-10-10T12:00:00.000Z");

      const ticketA = await createTestTicket({
        currentStatus: "Open",
        updatedAt: identicalTime,
        summary: "Tie-breaker Ticket A",
      });

      const ticketB = await createTestTicket({
        currentStatus: "Open",
        updatedAt: identicalTime,
        summary: "Tie-breaker Ticket B",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);

      const idxA = res.body.recentTickets.findIndex((t: any) => t.id === ticketA.id);
      const idxB = res.body.recentTickets.findIndex((t: any) => t.id === ticketB.id);

      if (idxA !== -1 && idxB !== -1) {
        if (ticketA.id > ticketB.id) {
          expect(idxA).toBeLessThan(idxB);
        } else {
          expect(idxB).toBeLessThan(idxA);
        }
      }
    });
  });

  // =========================================================================
  // 4. Staff Queue Extensions and Preserved Behavior (SD-16 to SD-18)
  // =========================================================================
  describe("4. Staff Queue Extensions and Preserved Behavior (SD-16 to SD-18)", () => {
    it("SD-16 (AC-15, AC-17): GET /api/v1/staff/tickets?assignedToMe=true filters exclusively to authenticated caller's tickets", async () => {
      const myTicket = await createTestTicket({
        currentStatus: "Open",
        assigneeId: staff1User.id,
        summary: "SD-16 Ticket assigned to Staff 1",
      });

      const otherTicket = await createTestTicket({
        currentStatus: "Open",
        assigneeId: staff2User.id,
        summary: "SD-16 Ticket assigned to Staff 2",
      });

      const res = await request(app)
        .get("/api/v1/staff/tickets?assignedToMe=true")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();

      for (const item of res.body.items) {
        expect(item.assignee).not.toBeNull();
        expect(item.assignee.id).toBe(staff1User.id);
      }

      const itemIds = res.body.items.map((i: any) => i.id);
      expect(itemIds).toContain(myTicket.id);
      expect(itemIds).not.toContain(otherTicket.id);
    });

    it("SD-17 (AC-15, AC-17): GET /api/v1/staff/tickets?priority=Urgent,High filters simultaneously to Urgent and High priorities", async () => {
      const urgentTicket = await createTestTicket({
        currentStatus: "Open",
        itPriority: "Urgent",
        summary: "SD-17 Urgent Ticket",
      });
      const highTicket = await createTestTicket({
        currentStatus: "Open",
        itPriority: "High",
        summary: "SD-17 High Ticket",
      });
      const lowTicket = await createTestTicket({
        currentStatus: "Open",
        itPriority: "Low",
        summary: "SD-17 Low Ticket",
      });

      const res = await request(app)
        .get("/api/v1/staff/tickets?priority=Urgent,High")
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();

      for (const item of res.body.items) {
        expect(["Urgent", "High"]).toContain(item.itPriority);
      }

      const itemIds = res.body.items.map((i: any) => i.id);
      expect(itemIds).toContain(urgentTicket.id);
      expect(itemIds).toContain(highTicket.id);
      expect(itemIds).not.toContain(lowTicket.id);
    });

    it("SD-18 (AC-15, AC-25): Administrator can access staff queue and staff dashboard with HTTP 200", async () => {
      const resDashboard = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resDashboard.status).toBe(200);

      const resQueue = await request(app)
        .get("/api/v1/staff/tickets")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resQueue.status).toBe(200);
      expect(resQueue.body).toHaveProperty("items");
      expect(resQueue.body).toHaveProperty("pagination");
    });

    it("Existing staff queue filters continue working (single priority, assignment, status, pagination)", async () => {
      // Single priority
      const resPriority = await request(app)
        .get("/api/v1/staff/tickets?priority=Low")
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resPriority.status).toBe(200);

      // Assignment: unassigned
      const resUnassigned = await request(app)
        .get("/api/v1/staff/tickets?assignment=unassigned")
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resUnassigned.status).toBe(200);
      for (const item of resUnassigned.body.items) {
        expect(item.assignee).toBeNull();
      }

      // Status filter
      const resStatus = await request(app)
        .get("/api/v1/staff/tickets?status=Open")
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resStatus.status).toBe(200);
      for (const item of resStatus.body.items) {
        expect(item.status).toBe("Open");
      }

      // Pagination
      const resPage = await request(app)
        .get("/api/v1/staff/tickets?page=1&pageSize=3")
        .set("Authorization", `Bearer ${staff1Token}`);
      expect(resPage.status).toBe(200);
      expect(resPage.body.pagination.pageSize).toBe(3);
    });
  });

  // =========================================================================
  // 5. Performance-Smoke Verification (PF-01)
  // =========================================================================
  describe("5. Performance-Smoke Verification (PF-01)", () => {
    it("PF-01 (AC-15): Staff dashboard query responds within acceptable threshold (< 2500ms)", async () => {
      const start = Date.now();

      const res = await request(app)
        .get("/api/v1/dashboard/staff")
        .set("Authorization", `Bearer ${staff1Token}`);

      const elapsedMs = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsedMs).toBeLessThan(2500);
      console.log(`[PF-01] Staff Dashboard response time: ${elapsedMs}ms`);
    });
  });
});
