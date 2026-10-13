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

describe("Lab 4 Requester Dashboard API (Issue #48: RD-01 to RD-14, DA-04 to DA-09, DP-01, DP-02, DP-04, DP-05)", () => {
  let requester1Token: string;
  let requester1User: any;
  let requester2Token: string;
  let requester2User: any;
  let staffToken: string;
  let staffUser: any;
  let adminToken: string;
  let adminUser: any;
  let inactiveRequesterToken: string;
  let inactiveRequesterUser: any;
  let pwChangeRequesterToken: string;
  let pwChangeRequesterUser: any;
  let noTicketsRequesterToken: string;
  let noTicketsRequesterUser: any;

  let defaultCategory: any;
  let defaultSystem: any;

  const createdTicketIds: string[] = [];

  async function createTestTicket(overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    const num = await allocateTicketNumber(prisma);
    const initialStatus = overrides.currentStatus || "Open";

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: overrides.requesterId || requester1User.id,
        categoryId: overrides.categoryId || defaultCategory.id,
        relatedSystemId: overrides.relatedSystemId || defaultSystem.id,
        summary: overrides.summary || `Requester Dashboard Test (${initialStatus}) - ${num}`,
        description: overrides.description || `Test ticket created for requester dashboard test scenarios.`,
        requestedPriority: overrides.requestedPriority || "Medium",
        itPriority: overrides.itPriority !== undefined ? overrides.itPriority : "Medium",
        currentStatus: initialStatus,
        resolutionSummary: overrides.resolutionSummary !== undefined ? overrides.resolutionSummary : null,
        assigneeId: overrides.assigneeId !== undefined ? overrides.assigneeId : null,
        ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      },
    });

    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function createResolutionEvent(ticketId: string, overrides: Partial<any> = {}) {
    const prisma = getPrisma();
    const event = await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: overrides.actorId || staffUser.id,
        eventType: "STATUS_CHANGED",
        payloadJson: {
          previousStatus: overrides.previousStatus || "In Progress",
          newStatus: overrides.newStatus || "Resolved",
          ...(overrides.resolutionSummary !== undefined ? { resolutionSummary: overrides.resolutionSummary } : {}),
        },
        createdAt: overrides.createdAt || new Date(),
      },
    });
    return event;
  }

  let originalTicketCount: any;
  let originalTicketFindMany: any;

  beforeAll(async () => {
    const prisma = getPrisma();
    originalTicketCount = prisma.ticket.count.bind(prisma.ticket);
    originalTicketFindMany = prisma.ticket.findMany.bind(prisma.ticket);

    // 1. Fetch seeded users
    const alice = await prisma.user.findUnique({ where: { email: "alice.smith@university.edu" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob.jones@university.edu" } });
    const staff = await prisma.user.findUnique({ where: { email: "staff1@university.edu" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@university.edu" } });

    expect(alice).not.toBeNull();
    expect(bob).not.toBeNull();
    expect(staff).not.toBeNull();
    expect(admin).not.toBeNull();

    requester1User = alice!;
    requester2User = bob!;
    staffUser = staff!;
    adminUser = admin!;

    requester1Token = createToken(alice!.id, "Requester", alice!.tokenVersion);
    requester2Token = createToken(bob!.id, "Requester", bob!.tokenVersion);
    staffToken = createToken(staff!.id, "IT Staff", staff!.tokenVersion);
    adminToken = createToken(admin!.id, "Administrator", admin!.tokenVersion);

    // 2. Ensure an inactive Requester user exists (DA-07)
    inactiveRequesterUser = await prisma.user.upsert({
      where: { email: "inactive.requester.dashboard.test@university.edu" },
      update: { isActive: false, role: "Requester" },
      create: {
        email: "inactive.requester.dashboard.test@university.edu",
        name: "Inactive Requester Dashboard Test",
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

    // 3. Ensure a Requester with mandatory password change exists (DA-08)
    pwChangeRequesterUser = await prisma.user.upsert({
      where: { email: "pwchange.requester.dashboard.test@university.edu" },
      update: { mustChangePassword: true, isActive: true, role: "Requester" },
      create: {
        email: "pwchange.requester.dashboard.test@university.edu",
        name: "PW Change Requester Test",
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

    // 4. Ensure a Requester with no tickets exists (RD-06)
    noTicketsRequesterUser = await prisma.user.upsert({
      where: { email: "notickets.requester.dashboard.test@university.edu" },
      update: { isActive: true, role: "Requester", mustChangePassword: false },
      create: {
        email: "notickets.requester.dashboard.test@university.edu",
        name: "No Tickets Requester Test",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "Requester",
        isActive: true,
        mustChangePassword: false,
      },
    });
    noTicketsRequesterToken = createToken(
      noTicketsRequesterUser.id,
      "Requester",
      noTicketsRequesterUser.tokenVersion
    );

    // Remove any tickets that might be associated with noTicketsRequesterUser
    const existingNoTicketIds = (
      await prisma.ticket.findMany({
        where: { requesterId: noTicketsRequesterUser.id },
        select: { id: true },
      })
    ).map((t) => t.id);
    if (existingNoTicketIds.length > 0) {
      await prisma.ticketComment.deleteMany({ where: { ticketId: { in: existingNoTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: existingNoTicketIds } } });
      await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: existingNoTicketIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: existingNoTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: existingNoTicketIds } } });
    }

    // 5. Reference categories and systems
    defaultCategory = await prisma.category.findFirst();
    defaultSystem = await prisma.relatedSystem.findFirst();
    expect(defaultCategory).not.toBeNull();
    expect(defaultSystem).not.toBeNull();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const prisma = getPrisma();
    if (originalTicketCount) (prisma.ticket as any).count = originalTicketCount;
    if (originalTicketFindMany) (prisma.ticket as any).findMany = originalTicketFindMany;

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
  // 1. Authorization and Account Status (DA-04 to DA-09)
  // =========================================================================
  describe("1. Authorization and Account Status (DA-04 to DA-09)", () => {
    it("DA-04 (AC-19): Authenticated Requester requests requester dashboard -> HTTP 200 with approved shape", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("metrics");
      expect(res.body).toHaveProperty("waitingForMeTickets");
      expect(res.body).toHaveProperty("recentlyResolvedTickets");
      expect(res.body).toHaveProperty("recentTickets");

      const metrics = res.body.metrics;
      expect(metrics).toHaveProperty("myActiveTickets");
      expect(metrics).toHaveProperty("waitingForMe");
      expect(metrics).toHaveProperty("resolvedTicketsCount");
      expect(metrics).toHaveProperty("totalTicketsCount");
      expect(metrics).toHaveProperty("statusCounts");

      expect(typeof metrics.myActiveTickets).toBe("number");
      expect(typeof metrics.waitingForMe).toBe("number");
      expect(typeof metrics.resolvedTicketsCount).toBe("number");
      expect(typeof metrics.totalTicketsCount).toBe("number");
      expect(typeof metrics.statusCounts).toBe("object");

      expect(Array.isArray(res.body.waitingForMeTickets)).toBe(true);
      expect(Array.isArray(res.body.recentlyResolvedTickets)).toBe(true);
      expect(Array.isArray(res.body.recentTickets)).toBe(true);
    });

    it("DA-05 (AC-22): IT Staff is rejected from requester dashboard -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|insufficient permissions/i);
    });

    it("DA-05 (AC-22): Administrator is rejected from requester dashboard -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden|insufficient permissions/i);
    });

    it("DA-06 (AC-22): Missing or invalid authentication token -> HTTP 401 Unauthorized", async () => {
      const resNoToken = await request(app).get("/api/v1/dashboard/requester");
      expect(resNoToken.status).toBe(401);
      expect(resNoToken.body.error).toMatch(/Missing or invalid authorization token/i);

      const resBadToken = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", "Bearer invalid-jwt-token-xyz");
      expect(resBadToken.status).toBe(401);
    });

    it("DA-07 (AC-22): Inactive Requester user account is rejected -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${inactiveRequesterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/inactive/i);
    });

    it("DA-08 (AC-25): Requester with mandatory password change is rejected -> HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${pwChangeRequesterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    });

    it("DA-09 (AC-26): Unexpected database failure returns safe HTTP 500 without leaking stack traces or internal details", async () => {
      const prisma = getPrisma();
      const originalCount = prisma.ticket.count;
      const spy = vi
        .spyOn(prisma.ticket, "count")
        .mockRejectedValue(new Error("FATAL: database query failed unexpectedly"));

      try {
        const res = await request(app)
          .get("/api/v1/dashboard/requester")
          .set("Authorization", `Bearer ${requester1Token}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
        expect(typeof res.body.error).toBe("string");
        expect(res.body.error).not.toMatch(/FATAL|database query failed|SELECT|prisma/i);
        expect(res.body.stack).toBeUndefined();
      } finally {
        spy.mockRestore();
        prisma.ticket.count = originalCount;
      }
    });
  });

  // =========================================================================
  // 2. Metrics and Ownership Calculations (RD-01 to RD-06, RD-01a, RD-01b, DP-01, DP-04)
  // =========================================================================
  describe("2. Metrics and Ownership Calculations (RD-01 to RD-06, RD-01a, RD-01b, DP-01, DP-04)", () => {
    it("RD-01 (AC-19): Metrics accurately count only tickets belonging to the authenticated Requester", async () => {
      const prisma = getPrisma();

      // Create an open ticket for Alice
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Open" });
      // Create an open ticket for Bob (must not be counted in Alice's metrics)
      await createTestTicket({ requesterId: requester2User.id, currentStatus: "Open" });

      const expectedActive = await prisma.ticket.count({
        where: {
          requesterId: requester1User.id,
          currentStatus: { notIn: ["Closed", "Cancelled"] },
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.myActiveTickets).toBe(expectedActive);
    });

    it("RD-01a (AC-19): totalTicketsCount matches total count of owned tickets across all statuses", async () => {
      const prisma = getPrisma();

      // Create various tickets for Alice (active and terminal)
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "New" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Closed" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Cancelled" });

      // Create a ticket for Bob (must not count towards Alice's total)
      await createTestTicket({ requesterId: requester2User.id, currentStatus: "New" });

      const expectedTotal = await prisma.ticket.count({
        where: { requesterId: requester1User.id },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.totalTicketsCount).toBe(expectedTotal);
    });

    it("RD-01b (AC-19): resolvedTicketsCount matches count of owned tickets currently in Resolved status", async () => {
      const prisma = getPrisma();

      // Create resolved ticket for Alice
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Resolved" });
      // Create resolved ticket for Bob
      await createTestTicket({ requesterId: requester2User.id, currentStatus: "Resolved" });

      const expectedResolved = await prisma.ticket.count({
        where: {
          requesterId: requester1User.id,
          currentStatus: "Resolved",
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.resolvedTicketsCount).toBe(expectedResolved);
    });

    it("RD-02 (AC-19, AC-22): Another Requester's tickets are excluded from all returned metrics and lists", async () => {
      // Create distinctive tickets for Bob only
      const bobTicket = await createTestTicket({
        requesterId: requester2User.id,
        currentStatus: "Waiting for Requester",
        summary: "BOB_SPECIFIC_EXCLUSIVE_TICKET_SUMMARY_12345",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);

      // Verify Bob's ticket is not in any of Alice's preview lists
      const waitingIds = res.body.waitingForMeTickets.map((t: any) => t.id);
      const recentIds = res.body.recentTickets.map((t: any) => t.id);
      const resolvedIds = res.body.recentlyResolvedTickets.map((t: any) => t.id);

      expect(waitingIds).not.toContain(bobTicket.id);
      expect(recentIds).not.toContain(bobTicket.id);
      expect(resolvedIds).not.toContain(bobTicket.id);
    });

    it("RD-03 (AC-19): myActiveTickets excludes Closed and Cancelled tickets", async () => {
      const prisma = getPrisma();

      // Create active tickets
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "New" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Open" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "In Progress" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Waiting for Requester" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Resolved" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Reopened" });

      // Create terminal tickets
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Closed" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Cancelled" });

      const expectedActive = await prisma.ticket.count({
        where: {
          requesterId: requester1User.id,
          currentStatus: { notIn: ["Closed", "Cancelled"] },
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.myActiveTickets).toBe(expectedActive);
    });

    it("RD-04 (AC-20): waitingForMe matches the count of owned tickets in Waiting for Requester status", async () => {
      const prisma = getPrisma();

      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Waiting for Requester" });
      await createTestTicket({ requesterId: requester1User.id, currentStatus: "Waiting for Requester" });
      await createTestTicket({ requesterId: requester2User.id, currentStatus: "Waiting for Requester" }); // Bob's ticket

      const expectedWaiting = await prisma.ticket.count({
        where: {
          requesterId: requester1User.id,
          currentStatus: "Waiting for Requester",
        },
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics.waitingForMe).toBe(expectedWaiting);
    });

    it("RD-05 (AC-19): statusCounts includes all eight statuses, correctly grouped and defaulting missing to 0", async () => {
      const prisma = getPrisma();

      const ALL_STATUSES = [
        "New",
        "Open",
        "In Progress",
        "Waiting for Requester",
        "Resolved",
        "Closed",
        "Reopened",
        "Cancelled",
      ];

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const statusCounts = res.body.metrics.statusCounts;
      expect(statusCounts).toBeDefined();

      for (const status of ALL_STATUSES) {
        expect(statusCounts).toHaveProperty(status);
        expect(typeof statusCounts[status]).toBe("number");

        const dbCount = await prisma.ticket.count({
          where: {
            requesterId: requester1User.id,
            currentStatus: status,
          },
        });
        expect(statusCounts[status]).toBe(dbCount);
      }
    });

    it("RD-06 (AC-19): Requester with no tickets receives all zeroes and empty preview lists", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${noTicketsRequesterToken}`);

      expect(res.status).toBe(200);
      const { metrics, waitingForMeTickets, recentlyResolvedTickets, recentTickets } = res.body;

      expect(metrics.myActiveTickets).toBe(0);
      expect(metrics.waitingForMe).toBe(0);
      expect(metrics.resolvedTicketsCount).toBe(0);
      expect(metrics.totalTicketsCount).toBe(0);

      const ALL_STATUSES = [
        "New",
        "Open",
        "In Progress",
        "Waiting for Requester",
        "Resolved",
        "Closed",
        "Reopened",
        "Cancelled",
      ];
      for (const st of ALL_STATUSES) {
        expect(metrics.statusCounts[st]).toBe(0);
      }

      expect(waitingForMeTickets).toEqual([]);
      expect(recentlyResolvedTickets).toEqual([]);
      expect(recentTickets).toEqual([]);
    });

    it("DP-01 (AC-19): Metrics reflect full database counts independent of the 5-item preview limits", async () => {
      // Create 6 Waiting for Requester tickets for Alice
      for (let i = 0; i < 6; i++) {
        await createTestTicket({
          requesterId: requester1User.id,
          currentStatus: "Waiting for Requester",
          summary: `Batch Waiting Ticket ${i}`,
        });
      }

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      // Metric count should be at least 6
      expect(res.body.metrics.waitingForMe).toBeGreaterThanOrEqual(6);
      // But preview list is strictly capped at 5
      expect(res.body.waitingForMeTickets.length).toBe(5);
    });

    it("DP-04 (AC-19): Updating a ticket's status reflects in dashboard metrics after refresh", async () => {
      const prisma = getPrisma();

      const ticket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Open",
      });

      const resBefore = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);
      expect(resBefore.status).toBe(200);
      const waitingBefore = resBefore.body.metrics.waitingForMe;

      // Update status to Waiting for Requester
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { currentStatus: "Waiting for Requester" },
      });

      const resAfter = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);
      expect(resAfter.status).toBe(200);
      expect(resAfter.body.metrics.waitingForMe).toBe(waitingBefore + 1);
    });
  });

  // =========================================================================
  // 3. Activity Previews and Ordering (RD-07 to RD-12, RD-09a, DP-02, DP-05)
  // =========================================================================
  describe("3. Activity Previews and Ordering (RD-07 to RD-12, RD-09a, DP-02, DP-05)", () => {
    it("RD-07 (AC-20): waitingForMeTickets contains only owned Waiting for Requester tickets with approved fields", async () => {
      const testTicket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Waiting for Requester",
        summary: "Needs password reset confirmation",
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const item = res.body.waitingForMeTickets.find((t: any) => t.id === testTicket.id);
      expect(item).toBeDefined();
      expect(item.ticketNumber).toBe(testTicket.ticketNumber);
      expect(item.summary).toBe(testTicket.summary);
      expect(item.status).toBe("Waiting for Requester");
      expect(typeof item.updatedAt).toBe("string");
      expect(new Date(item.updatedAt).toISOString()).toBe(item.updatedAt);
    });

    it("RD-08 (AC-20): waitingForMeTickets is capped at 5 and sorted by updatedAt DESC, id DESC", async () => {
      const baseTime = Date.now() - 100000;
      const createdItems = [];

      for (let i = 0; i < 7; i++) {
        const ticket = await createTestTicket({
          requesterId: requester1User.id,
          currentStatus: "Waiting for Requester",
          summary: `Waiting Ticket ${i}`,
          updatedAt: new Date(baseTime + i * 10000),
        });
        createdItems.push(ticket);
      }

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const list = res.body.waitingForMeTickets;
      expect(list.length).toBeLessThanOrEqual(5);

      // Verify descending order by updatedAt
      for (let i = 0; i < list.length - 1; i++) {
        const d1 = new Date(list[i].updatedAt).getTime();
        const d2 = new Date(list[i + 1].updatedAt).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);
        if (d1 === d2) {
          expect(list[i].id.localeCompare(list[i + 1].id)).toBeGreaterThan(0);
        }
      }
    });

    it("RD-09 (AC-19): recentlyResolvedTickets contains owned Resolved tickets with resolutionSummary and resolvedAt", async () => {
      const resolutionDate = new Date(Date.now() + 10000);
      const summaryText = "Replaced faulty Ethernet cable in Room 101";

      const ticket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Resolved",
        summary: "No network connectivity",
        resolutionSummary: summaryText,
        updatedAt: resolutionDate,
      });

      await createResolutionEvent(ticket.id, {
        newStatus: "Resolved",
        resolutionSummary: summaryText,
        createdAt: resolutionDate,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const item = res.body.recentlyResolvedTickets.find((t: any) => t.id === ticket.id);
      expect(item).toBeDefined();
      expect(item.ticketNumber).toBe(ticket.ticketNumber);
      expect(item.summary).toBe(ticket.summary);
      expect(item.status).toBe("Resolved");
      expect(item.resolutionSummary).toBe(summaryText);
      expect(item.resolvedAt).toBe(resolutionDate.toISOString());
      expect(item.updatedAt).toBeDefined();
    });

    it("RD-09a (AC-19, AC-23): Legacy Resolved tickets without STATUS_CHANGED event fall back safely to updatedAt", async () => {
      const legacyDate = new Date(Date.now() + 20000);

      // Ticket has status Resolved, but NO ticketEvent records (legacy migrated ticket)
      const ticket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Resolved",
        summary: "Legacy resolved printer setup",
        resolutionSummary: "Legacy resolution summary",
        updatedAt: legacyDate,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const item = res.body.recentlyResolvedTickets.find((t: any) => t.id === ticket.id);
      expect(item).toBeDefined();
      expect(item.resolvedAt).toBe(legacyDate.toISOString());
      expect(item.updatedAt).toBe(legacyDate.toISOString());
    });

    it("RD-10 (AC-19): Reopened tickets or tickets moved out of Resolved are excluded from recentlyResolvedTickets", async () => {
      const resolutionDate = new Date(Date.now() + 25000);

      // Ticket that was resolved in the past, but is currently Reopened
      const ticket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Reopened",
        summary: "Issue recurring after resolution",
        resolutionSummary: "Previous resolution attempt",
        updatedAt: new Date(Date.now() + 26000),
      });

      // Created a resolution event previously
      await createResolutionEvent(ticket.id, {
        previousStatus: "In Progress",
        newStatus: "Resolved",
        createdAt: resolutionDate,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const item = res.body.recentlyResolvedTickets.find((t: any) => t.id === ticket.id);
      expect(item).toBeUndefined(); // Must NOT appear in recently resolved list
    });

    it("RD-11 (AC-19): When multiple resolution events exist, sorting uses the latest relevant resolution event", async () => {
      const olderResolution = new Date(Date.now() + 30000);
      const newerResolution = new Date(Date.now() + 40000);

      // Ticket A: Resolved on older timestamp
      const ticketA = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Resolved",
        summary: "Ticket A - Earlier resolution",
        updatedAt: olderResolution,
      });
      await createResolutionEvent(ticketA.id, { createdAt: olderResolution });

      // Ticket B: Resolved on newer timestamp
      const ticketB = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Resolved",
        summary: "Ticket B - Later resolution",
        updatedAt: newerResolution,
      });
      // Ticket B was resolved earlier, reopened, then resolved again at newerResolution
      await createResolutionEvent(ticketB.id, { createdAt: new Date(Date.now() + 15000) });
      await createResolutionEvent(ticketB.id, { createdAt: newerResolution });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const list = res.body.recentlyResolvedTickets;

      const idxA = list.findIndex((t: any) => t.id === ticketA.id);
      const idxB = list.findIndex((t: any) => t.id === ticketB.id);

      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      // Ticket B must appear before Ticket A because its latest resolution date is newer
      expect(idxB).toBeLessThan(idxA);
    });

    it("RD-12 (AC-19): recentTickets contains at most 5 owned tickets sorted by updatedAt DESC, id DESC", async () => {
      const baseTime = Date.now() - 500000;
      for (let i = 0; i < 7; i++) {
        await createTestTicket({
          requesterId: requester1User.id,
          currentStatus: "Open",
          summary: `Recent Ticket ${i}`,
          updatedAt: new Date(baseTime + i * 20000),
        });
      }

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const list = res.body.recentTickets;
      expect(list.length).toBeLessThanOrEqual(5);

      for (let i = 0; i < list.length - 1; i++) {
        const d1 = new Date(list[i].updatedAt).getTime();
        const d2 = new Date(list[i + 1].updatedAt).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);
        if (d1 === d2) {
          expect(list[i].id.localeCompare(list[i + 1].id)).toBeGreaterThan(0);
        }
      }

      // Check fields of the first item
      if (list.length > 0) {
        const first = list[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("ticketNumber");
        expect(first).toHaveProperty("summary");
        expect(first).toHaveProperty("status");
        expect(first).toHaveProperty("updatedAt");
      }
    });

    it("DP-02 (AC-17, AC-19): Secondary ordering produces deterministic results (id DESC) when timestamps tie", async () => {
      const identicalTime = new Date("2026-10-11T12:00:00.000Z");

      const t1 = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Open",
        summary: "Tiebreaker Ticket 1",
        updatedAt: identicalTime,
      });

      const t2 = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Open",
        summary: "Tiebreaker Ticket 2",
        updatedAt: identicalTime,
      });

      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      const list = res.body.recentTickets;
      const idx1 = list.findIndex((t: any) => t.id === t1.id);
      const idx2 = list.findIndex((t: any) => t.id === t2.id);

      if (idx1 !== -1 && idx2 !== -1) {
        if (t1.id > t2.id) {
          expect(idx1).toBeLessThan(idx2);
        } else {
          expect(idx2).toBeLessThan(idx1);
        }
      }
    });

    it("DP-05 (AC-18, AC-19): When no items match, preview arrays are returned empty rather than null or missing", async () => {
      const res = await request(app)
        .get("/api/v1/dashboard/requester")
        .set("Authorization", `Bearer ${noTicketsRequesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.waitingForMeTickets).toEqual([]);
      expect(res.body.recentlyResolvedTickets).toEqual([]);
      expect(res.body.recentTickets).toEqual([]);
    });
  });

  // =========================================================================
  // 4. Ownership, Privacy, and Security Controls (RD-13, RD-14, AC-22)
  // =========================================================================
  describe("4. Ownership, Privacy, and Security Controls (RD-13, RD-14, AC-22)", () => {
    it("AC-22 (BR-30): Client-supplied requesterId query parameter cannot override authenticated ownership", async () => {
      // Bob owns this ticket
      const bobTicket = await createTestTicket({
        requesterId: requester2User.id,
        currentStatus: "Waiting for Requester",
        summary: "Bob's private ticket requiring response",
      });

      // Alice tries to inject ?requesterId=bobId
      const res = await request(app)
        .get(`/api/v1/dashboard/requester?requesterId=${requester2User.id}`)
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      // The dashboard MUST return Alice's data, ignoring Bob's requesterId
      const waitingIds = res.body.waitingForMeTickets.map((t: any) => t.id);
      expect(waitingIds).not.toContain(bobTicket.id);
    });

    it("RD-13 (AC-21): Requester can open their own ticket detail via existing GET /api/v1/tickets/:ticketId", async () => {
      const ticket = await createTestTicket({
        requesterId: requester1User.id,
        currentStatus: "Open",
        summary: "Alice's verifiable ticket detail",
      });

      const res = await request(app)
        .get(`/api/v1/tickets/${ticket.id}`)
        .set("Authorization", `Bearer ${requester1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ticket.id);
      expect(res.body.requester.id).toBe(requester1User.id);
    });

    it("RD-14 (AC-22): Requester attempting to open another user's ticket detail is denied access", async () => {
      // Bob's ticket
      const bobTicket = await createTestTicket({
        requesterId: requester2User.id,
        currentStatus: "Open",
        summary: "Bob's confidential ticket",
      });

      // Alice attempts to access Bob's ticket
      const res = await request(app)
        .get(`/api/v1/tickets/${bobTicket.id}`)
        .set("Authorization", `Bearer ${requester1Token}`);

      // Contract requires 404 (inaccessible without disclosing existence) or 403
      expect([403, 404]).toContain(res.status);
      expect(res.body.id).toBeUndefined();
      expect(res.body.summary).toBeUndefined();
    });
  });
});
