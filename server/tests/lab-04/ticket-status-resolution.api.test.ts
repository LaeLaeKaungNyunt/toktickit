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

describe("Lab 4 Ticket Status and Resolution API (Issue #46: TS-01 to TS-36)", () => {
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
  let inactiveStaffToken: string;
  let inactiveStaffUser: any;

  let defaultCategory: any;
  let defaultSystem: any;
  const createdTicketIds: string[] = [];

  async function createTestTicket(initialStatus: string = "New", requesterId?: string) {
    const prisma = getPrisma();
    const num = await allocateTicketNumber(prisma);
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: num,
        requesterId: requesterId || aliceUser.id,
        categoryId: defaultCategory.id,
        relatedSystemId: defaultSystem.id,
        summary: `TS Test Ticket (${initialStatus}) - ${num}`,
        description: `Automated test ticket initialized with status ${initialStatus}.`,
        requestedPriority: "Medium",
        itPriority: "Medium",
        currentStatus: initialStatus,
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  async function createTestAction(
    ticketId: string,
    status: "Active" | "Completed" | "Cancelled" = "Completed",
    overrides: Partial<any> = {}
  ) {
    const prisma = getPrisma();
    return prisma.actionTaken.create({
      data: {
        ticketId,
        performedById: staff1User.id,
        actionDateTime: new Date(),
        description: overrides.description || `Test action record with status ${status}`,
        result: overrides.result || `Standard test outcome and verification for ${status}`,
        status,
        followUpRequired: overrides.followUpRequired ?? false,
        followUpNote: overrides.followUpNote ?? null,
        attachmentNotes: overrides.attachmentNotes ?? null,
        ...overrides,
      },
    });
  }

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

    // 2. Ensure an inactive staff account exists
    inactiveStaffUser = await prisma.user.upsert({
      where: { email: "inactive.staff.ts46@university.edu" },
      update: { isActive: false, role: "IT Staff" },
      create: {
        email: "inactive.staff.ts46@university.edu",
        name: "Inactive Staff TS46",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        role: "IT Staff",
        isActive: false,
      },
    });
    inactiveStaffToken = createToken(inactiveStaffUser.id, "IT Staff", inactiveStaffUser.tokenVersion);

    // 3. Category and RelatedSystem reference fixtures
    defaultCategory = await prisma.category.findFirst();
    defaultSystem = await prisma.relatedSystem.findFirst();
    expect(defaultCategory).not.toBeNull();
    expect(defaultSystem).not.toBeNull();
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdTicketIds.length > 0) {
      await prisma.ticketComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.actionTaken.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
  });

  // =========================================================================
  // 3.1 Permitted Status Transitions (TS-01 to TS-09)
  // =========================================================================
  describe("3.1 Permitted Status Transitions", () => {
    it("TS-01 (AC-09): New -> Open succeeds with HTTP 200 and updates status", async () => {
      const ticket = await createTestTicket("New");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Open" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Open");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Open");
    });

    it("TS-02 (AC-09): New -> In Progress succeeds with HTTP 200 and updates status", async () => {
      const ticket = await createTestTicket("New");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("In Progress");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("In Progress");
    });

    it("TS-03 (AC-12): Open -> Resolved with valid resolution evidence succeeds with HTTP 200", async () => {
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Completed", {
        description: "Replaced faulty switch port and tested network cable.",
        result: "Port link established at 1 Gbps duplex with zero packet drops.",
      });

      const summary = "Replaced switch port and verified full 1Gbps connectivity.";

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: summary,
          expectedUpdatedAt: ticket.updatedAt.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Resolved");
      expect(res.body.ticket.resolutionSummary).toBe(summary);
      expect(res.body.ticket.updatedAt).toBeDefined();

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Resolved");
      expect(updated?.resolutionSummary).toBe(summary);
    });

    it("TS-04 (AC-09): In Progress -> Waiting for Requester succeeds with HTTP 200", async () => {
      const ticket = await createTestTicket("In Progress");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Waiting for Requester" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Waiting for Requester");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Waiting for Requester");
    });

    it("TS-05 (AC-09): Waiting for Requester -> In Progress succeeds with HTTP 200", async () => {
      const ticket = await createTestTicket("Waiting for Requester");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("In Progress");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("In Progress");
    });

    it("TS-06 (AC-09): Resolved -> Closed succeeds with HTTP 200 and closes ticket", async () => {
      const ticket = await createTestTicket("Resolved");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Closed" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Closed");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Closed");
    });

    it("TS-07 (AC-09): Resolved -> Reopened succeeds with HTTP 200 and reopens ticket", async () => {
      const ticket = await createTestTicket("Resolved");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Reopened" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Reopened");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Reopened");
    });

    it("TS-08 (AC-09): Reopened -> In Progress succeeds with HTTP 200", async () => {
      const ticket = await createTestTicket("Reopened");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("In Progress");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("In Progress");
    });

    it.each([
      { from: "New", to: "Waiting for Requester" },
      { from: "New", to: "Cancelled" },
      { from: "Open", to: "In Progress" },
      { from: "Open", to: "Waiting for Requester" },
      { from: "Open", to: "Cancelled" },
      { from: "In Progress", to: "Cancelled" },
      { from: "Waiting for Requester", to: "Cancelled" },
      { from: "Resolved", to: "In Progress" },
      { from: "Reopened", to: "Waiting for Requester" },
      { from: "Reopened", to: "Cancelled" },
      { from: "In Progress", to: "Resolved", requiresEvidence: true },
      { from: "Waiting for Requester", to: "Resolved", requiresEvidence: true },
      { from: "Reopened", to: "Resolved", requiresEvidence: true },
    ])("TS-09 (AC-09): Permitted transition from $from -> $to succeeds with HTTP 200", async ({ from, to, requiresEvidence }) => {
      const ticket = await createTestTicket(from);

      let payload: any = { status: to };
      if (requiresEvidence) {
        await createTestAction(ticket.id, "Completed", {
          description: `Action completed before transitioning from ${from} to Resolved.`,
          result: `Work verified for ${from} resolution.`,
        });
        payload = {
          status: to,
          resolutionSummary: `Resolved successfully from ${from}.`,
          expectedUpdatedAt: ticket.updatedAt.toISOString(),
        };
      }

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe(to);

      if (requiresEvidence) {
        expect(res.body.ticket.resolutionSummary).toBe(`Resolved successfully from ${from}.`);
      }

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe(to);
    });
  });

  // =========================================================================
  // 3.2 Prohibited Status Transitions (TS-10 to TS-15)
  // =========================================================================
  describe("3.2 Prohibited Status Transitions", () => {
    it("TS-10 (AC-10): New -> Resolved returns HTTP 409 and status remains unchanged", async () => {
      const ticket = await createTestTicket("New");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Resolved", resolutionSummary: "Attempt direct resolution from New." });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("New");
    });

    it("TS-11 (AC-10): Closed -> In Progress returns HTTP 409 and status remains Closed", async () => {
      const ticket = await createTestTicket("Closed");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Closed");
    });

    it("TS-12 (AC-10): Cancelled -> Open returns HTTP 409 and status remains Cancelled", async () => {
      const ticket = await createTestTicket("Cancelled");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Open" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Cancelled");
    });

    it("TS-13 (AC-10): In Progress -> New returns HTTP 409 and status remains In Progress", async () => {
      const ticket = await createTestTicket("In Progress");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "New" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("In Progress");
    });

    it("TS-14 (AC-10): Submit an unsupported status value returns HTTP 400 and status is unchanged", async () => {
      const ticket = await createTestTicket("Open");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Finished" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
    });

    it.each([
      { from: "New", to: "Closed" },
      { from: "New", to: "Reopened" },
      { from: "Open", to: "New" },
      { from: "Open", to: "Closed" },
      { from: "Open", to: "Reopened" },
      { from: "In Progress", to: "Open" },
      { from: "In Progress", to: "Closed" },
      { from: "In Progress", to: "Reopened" },
      { from: "Waiting for Requester", to: "New" },
      { from: "Waiting for Requester", to: "Open" },
      { from: "Waiting for Requester", to: "Closed" },
      { from: "Waiting for Requester", to: "Reopened" },
      { from: "Resolved", to: "New" },
      { from: "Resolved", to: "Open" },
      { from: "Resolved", to: "Cancelled" },
      { from: "Reopened", to: "New" },
      { from: "Reopened", to: "Open" },
      { from: "Reopened", to: "Closed" },
      { from: "Closed", to: "Open" },
      { from: "Closed", to: "Resolved" },
      { from: "Closed", to: "Cancelled" },
      { from: "Cancelled", to: "In Progress" },
      { from: "Cancelled", to: "Resolved" },
      { from: "Cancelled", to: "Closed" },
    ])("TS-15 (AC-10): Attempt prohibited transition $from -> $to returns HTTP 409 without changing status", async ({ from, to }) => {
      const ticket = await createTestTicket(from);

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: to });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe(from);
    });
  });

  // =========================================================================
  // 3.3 Formal Resolution Gate (TS-16 to TS-23)
  // =========================================================================
  describe("3.3 Formal Resolution Gate", () => {
    it("TS-16 (AC-11): Resolve Ticket with no Actions Taken returns HTTP 400 and Ticket remains unchanged", async () => {
      const ticket = await createTestTicket("Open");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: "Attempting resolution without any actions taken recorded.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/action|evidence|completed/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
      expect(unchanged?.resolutionSummary).toBeNull();
    });

    it("TS-17 (AC-11): Resolve Ticket with only Active actions returns HTTP 400 and Ticket remains unchanged", async () => {
      const ticket = await createTestTicket("In Progress");
      await createTestAction(ticket.id, "Active", {
        description: "Still investigating the issue actively.",
        result: "Interim diagnosis pending parts replacement.",
      });

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: "Trying to resolve while action is still Active.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/action|evidence|completed/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("In Progress");
      expect(unchanged?.resolutionSummary).toBeNull();
    });

    it("TS-18 (AC-11): Resolve Ticket with only Cancelled actions returns HTTP 400 and Ticket remains unchanged", async () => {
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Cancelled", {
        description: "Work was aborted due to incorrect system targeted.",
        result: "Cancelled; no actual resolution occurred.",
      });

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: "Trying to resolve with only a cancelled action.",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/action|evidence|completed/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
      expect(unchanged?.resolutionSummary).toBeNull();
    });

    it("TS-19 (AC-12): Resolve Ticket with at least one Completed action and valid Resolution Summary succeeds with HTTP 200", async () => {
      const ticket = await createTestTicket("In Progress");
      await createTestAction(ticket.id, "Completed", {
        description: "Re-installed damaged network driver and configured static IP.",
        result: "System pinged gateway and external DNS successfully with 0% loss.",
      });

      const resolutionText = "Re-installed NIC driver and verified gateway connectivity.";

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: resolutionText,
          expectedUpdatedAt: ticket.updatedAt.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Resolved");
      expect(res.body.ticket.resolutionSummary).toBe(resolutionText);
      expect(res.body.ticket.updatedAt).toBeDefined();

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("Resolved");
      expect(updated?.resolutionSummary).toBe(resolutionText);
    });

    it("TS-20 (AC-12): Resolve Ticket with Completed action but blank Resolution Summary returns HTTP 400", async () => {
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Completed");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: "   ",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/resolution.*summary/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
      expect(unchanged?.resolutionSummary).toBeNull();
    });

    it("TS-21 (AC-12): Resolve Ticket with Completed action but missing Resolution Summary returns HTTP 400", async () => {
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Completed");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/resolution.*summary/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
      expect(unchanged?.resolutionSummary).toBeNull();
    });

    it("TS-22 (AC-13): Requester indicates RESOLVED via requester-resolution feature without changing formal status", async () => {
      const ticket = await createTestTicket("In Progress", aliceUser.id);

      const res = await request(app)
        .patch(`/api/v1/tickets/${ticket.id}/resolution`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ requesterResolution: "RESOLVED" });

      expect(res.status).toBe(200);
      expect(res.body.requesterResolution).toBe("RESOLVED");

      const prisma = getPrisma();
      const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(dbTicket?.currentStatus).toBe("In Progress"); // Formal status remains In Progress!
      expect(dbTicket?.requesterResolution).toBe("RESOLVED");

      // No formal STATUS_CHANGED event was created
      const events = await prisma.ticketEvent.findMany({
        where: { ticketId: ticket.id, eventType: "STATUS_CHANGED" },
      });
      expect(events).toEqual([]);
    });

    it("TS-23 (AC-10, AC-12): Resolve Ticket with valid evidence but from prohibited source status returns HTTP 409", async () => {
      const ticket = await createTestTicket("New");
      await createTestAction(ticket.id, "Completed", {
        description: "Completed diagnostic work prematurely.",
        result: "Issue identified.",
      });

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: "Direct transition from New to Resolved is prohibited.",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("New");
    });
  });

  // =========================================================================
  // 3.4 Concurrency and Audit History (TS-24 to TS-29)
  // =========================================================================
  describe("3.4 Concurrency and Audit History", () => {
    it("TS-24 (AC-14): Update Ticket using a stale expectedUpdatedAt returns HTTP 409", async () => {
      const ticket = await createTestTicket("Open");
      const staleTimestamp = new Date(Date.now() - 3600000).toISOString();

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "In Progress",
          expectedUpdatedAt: staleTimestamp,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/stale|conflict|modified/i);

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
    });

    it("TS-25 (AC-14): Two users submit conflicting transitions from the same version; second receives HTTP 409", async () => {
      const ticket = await createTestTicket("Open");
      const currentVersion = ticket.updatedAt.toISOString();

      // User 1 executes Open -> In Progress with expectedUpdatedAt
      const res1 = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "In Progress",
          expectedUpdatedAt: currentVersion,
        });

      expect(res1.status).toBe(200);

      // User 2 attempts Open -> Waiting for Requester based on the old version
      const res2 = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff2Token}`)
        .send({
          status: "Waiting for Requester",
          expectedUpdatedAt: currentVersion,
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/stale|conflict|modified/i);

      // User 1's transition is preserved in database
      const prisma = getPrisma();
      const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(dbTicket?.currentStatus).toBe("In Progress");
    });

    it("TS-26 (AC-09): Successful status transition saves STATUS_CHANGED TicketEvent with actor, previous status, and new status", async () => {
      const prisma = getPrisma();
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Completed", {
        description: "Repaired display connector cable.",
        result: "External monitor detected and functioning at 4K 60Hz.",
      });

      const summaryText = "Repaired display connector and verified monitor signal.";

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: summaryText,
        });

      expect(res.status).toBe(200);

      const events = await prisma.ticketEvent.findMany({
        where: {
          ticketId: ticket.id,
          eventType: "STATUS_CHANGED",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(events.length).toBeGreaterThan(0);
      const latestEvent = events[0];
      expect(latestEvent.actorId).toBe(staff1User.id);
      expect((latestEvent.payloadJson as any).previousStatus).toBe("Open");
      expect((latestEvent.payloadJson as any).newStatus).toBe("Resolved");
      expect((latestEvent.payloadJson as any).resolutionSummary).toBe(summaryText);
    });

    it("TS-27 (AC-10, AC-11): Rejected transition or resolution attempt creates no successful status-change event", async () => {
      const prisma = getPrisma();
      const ticket = await createTestTicket("New");

      // Attempt 1: Prohibited transition New -> Resolved
      const res1 = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Resolved", resolutionSummary: "Prohibited resolution." });

      expect(res1.status).toBe(409);

      // Attempt 2: Resolution without completed action from Open
      const ticketOpen = await createTestTicket("Open");
      const res2 = await request(app)
        .patch(`/api/v1/staff/tickets/${ticketOpen.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "Resolved", resolutionSummary: "Missing action." });

      expect(res2.status).toBe(400);

      const events1 = await prisma.ticketEvent.findMany({
        where: { ticketId: ticket.id, eventType: "STATUS_CHANGED" },
      });
      expect(events1).toEqual([]);

      const events2 = await prisma.ticketEvent.findMany({
        where: { ticketId: ticketOpen.id, eventType: "STATUS_CHANGED" },
      });
      expect(events2).toEqual([]);
    });

    it("TS-28 (AC-09): Simulated failure while saving status and audit event rolls back entire transaction", async () => {
      const prisma = getPrisma();
      const ticket = await createTestTicket("Open");

      const originalCreate = prisma.ticketEvent.create;
      const spy = vi.spyOn(prisma.ticketEvent, "create").mockRejectedValueOnce(
        new Error("Simulated database failure during audit event creation")
      );

      try {
        const res = await request(app)
          .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
          .set("Authorization", `Bearer ${staff1Token}`)
          .send({ status: "In Progress" });

        expect(res.status).toBe(500);

        // Ticket status in database MUST remain 'Open' due to transaction rollback
        const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
        expect(dbTicket?.currentStatus).toBe("Open");
      } finally {
        spy.mockRestore();
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

    it("TS-29 (AC-12): Resolve Ticket successfully saves Resolution Summary and it remains available in Ticket Detail", async () => {
      const ticket = await createTestTicket("Open");
      await createTestAction(ticket.id, "Completed", {
        description: "Replaced faulty RAM module.",
        result: "System booted cleanly and passed memory stress test.",
      });

      const summaryText = "Diagnosed faulty RAM module and replaced with 16GB DDR4 ECC. System fully operational.";

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({
          status: "Resolved",
          resolutionSummary: summaryText,
          expectedUpdatedAt: ticket.updatedAt.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Resolved");
      expect(res.body.ticket.resolutionSummary).toBe(summaryText);

      // Verify retrievable via Staff Ticket Detail
      const staffDetailRes = await request(app)
        .get(`/api/v1/staff/tickets/${ticket.id}`)
        .set("Authorization", `Bearer ${staff1Token}`);

      expect(staffDetailRes.status).toBe(200);
      expect(staffDetailRes.body.ticket.resolutionSummary).toBe(summaryText);

      // Verify retrievable via Requester Ticket Detail
      const reqDetailRes = await request(app)
        .get(`/api/v1/tickets/${ticket.id}`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(reqDetailRes.status).toBe(200);
      expect(reqDetailRes.body.resolutionSummary).toBe(summaryText);
    });
  });

  // =========================================================================
  // 3.5 Authorization and Regression (TS-30 to TS-36)
  // =========================================================================
  describe("3.5 Authorization and Regression", () => {
    it("TS-30 (AC-10): Requester calling IT Staff status endpoint returns HTTP 403 and status is unchanged", async () => {
      const ticket = await createTestTicket("Open", aliceUser.id);

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
    });

    it("TS-31 (AC-10): Unauthenticated user calling status endpoint returns HTTP 401", async () => {
      const ticket = await createTestTicket("Open");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(401);
    });

    it("TS-32 (AC-10): Inactive IT Staff account attempting a transition returns HTTP 403", async () => {
      const ticket = await createTestTicket("Open");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${inactiveStaffToken}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();

      const prisma = getPrisma();
      const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(unchanged?.currentStatus).toBe("Open");
    });

    it("TS-33 (AC-25): Existing Ticket assignment and IT Priority updates continue working as in Lab 3", async () => {
      const ticket = await createTestTicket("Open");

      // 1. Assignment update
      const assignRes = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/assignment`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ assigneeId: staff2User.id });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.ticket.assignee.id).toBe(staff2User.id);

      // 2. IT Priority update
      const priorityRes = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/priority`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ itPriority: "Urgent" });

      expect(priorityRes.status).toBe(200);
      expect(priorityRes.body.ticket.itPriority).toBe("Urgent");
    });

    it("TS-34 (AC-25): Existing Ticket comments, notes, and attachment workflows continue working as in Lab 3", async () => {
      const ticket = await createTestTicket("Open");

      // 1. Add Public Comment
      const commentRes = await request(app)
        .post(`/api/v1/staff/tickets/${ticket.id}/comments`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ body: "Regression test public comment." });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.comment.body).toBe("Regression test public comment.");

      // 2. Add Internal Note
      const noteRes = await request(app)
        .post(`/api/v1/staff/tickets/${ticket.id}/notes`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ body: "Regression test internal staff note." });

      expect(noteRes.status).toBe(201);
      expect(noteRes.body.note.body).toBe("Regression test internal staff note.");
    });

    it("TS-35 (AC-09, AC-25): Administrator calls status endpoint with valid transition succeeds with HTTP 200 and audit event", async () => {
      const prisma = getPrisma();
      const ticket = await createTestTicket("New");

      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Open" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("Open");

      const events = await prisma.ticketEvent.findMany({
        where: { ticketId: ticket.id, eventType: "STATUS_CHANGED" },
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].actorId).toBe(adminUser.id);
    });

    it("TS-36 (AC-09, AC-25): IT Staff or Administrator status update omits expectedUpdatedAt succeeds (Labs 1-3 backward compatibility)", async () => {
      const ticket = await createTestTicket("Open");

      // Omitting expectedUpdatedAt must succeed for legacy/regression tests
      const res = await request(app)
        .patch(`/api/v1/staff/tickets/${ticket.id}/status`)
        .set("Authorization", `Bearer ${staff1Token}`)
        .send({ status: "In Progress" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe("In Progress");

      const prisma = getPrisma();
      const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(updated?.currentStatus).toBe("In Progress");
    });
  });
});
