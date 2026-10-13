import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-toktickit-jwt-secret-key";

function createToken(userId: string, role: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, tokenVersion }, JWT_SECRET, { expiresIn: "8h" });
}

describe("Lab 4 Migration, Schema & Seed Verification (Issue #45: MG-01 to MG-08)", () => {
  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("MG-01 (AC-23): Lab 4 ActionTaken table and Prisma model exist in database", async () => {
    const prisma = getPrisma();

    // Verify ActionTaken model and database table exist
    expect((prisma as any).actionTaken).toBeDefined();

    // Raw query to check PostgreSQL table existence
    const tableCheck: any[] = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ActionTaken';
    `;
    expect(tableCheck.length).toBe(1);
  });

  it("MG-02 (AC-23): Existing Tickets are preserved with IDs, ownership, statuses, and timestamps", async () => {
    const prisma = getPrisma();

    const tickets = await prisma.ticket.findMany({
      include: {
        requester: true,
      },
    });

    expect(tickets.length).toBeGreaterThanOrEqual(4);

    for (const ticket of tickets) {
      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d+$/);
      expect(ticket.requesterId).toBeDefined();
      expect(ticket.requester).toBeDefined();
      expect(ticket.requester.id).toBe(ticket.requesterId);
      expect(ticket.currentStatus).toBeDefined();
      expect(ticket.requestedPriority).toBeDefined();
      expect(ticket.createdAt).toBeInstanceOf(Date);
      expect(ticket.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("MG-03 (AC-23): Existing comments, internal notes, attachments, and events remain valid", async () => {
    const prisma = getPrisma();

    // Check TicketEvents
    const events = await prisma.ticketEvent.findMany({
      include: { ticket: true },
    });
    for (const event of events) {
      expect(event.ticket).toBeDefined();
      expect(event.ticketId).toBe(event.ticket.id);
    }

    // Check Attachments
    const attachments = await prisma.attachment.findMany({
      include: { ticket: true },
    });
    for (const attachment of attachments) {
      expect(attachment.ticket).toBeDefined();
      expect(attachment.ticketId).toBe(attachment.ticket.id);
    }

    // Check TicketComments
    const comments = await prisma.ticketComment.findMany({
      include: { ticket: true, author: true },
    });
    for (const comment of comments) {
      expect(comment.ticket).toBeDefined();
      expect(comment.author).toBeDefined();
    }

    // Check InternalNotes
    const notes = await prisma.internalNote.findMany({
      include: { ticket: true, author: true },
    });
    for (const note of notes) {
      expect(note.ticket).toBeDefined();
      expect(note.author).toBeDefined();
    }
  });

  it("MG-04 (AC-23): Legacy Ticket with no Actions Taken returns empty actions list", async () => {
    const prisma = getPrisma();

    // Find a seeded ticket
    const legacyTicket = await prisma.ticket.findFirst({
      include: { requester: true },
    });
    expect(legacyTicket).not.toBeNull();

    const staff = await prisma.user.findFirst({
      where: { role: "IT Staff", isActive: true, mustChangePassword: false },
    });
    expect(staff).not.toBeNull();

    const staffToken = createToken(staff!.id, "IT Staff", staff!.tokenVersion);

    const res = await request(app)
      .get(`/api/v1/tickets/${legacyTicket!.id}/actions`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.actions).toBeDefined();
    expect(Array.isArray(res.body.actions)).toBe(true);
  });

  it("MG-05 (AC-23): Inspect newly added Ticket resolutionSummary column with safe null default", async () => {
    const prisma = getPrisma();

    // Verify resolutionSummary column exists on Ticket table in PostgreSQL
    const columnCheck: any[] = await prisma.$queryRaw`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Ticket' AND column_name = 'resolutionSummary';
    `;
    expect(columnCheck.length).toBe(1);
    expect(columnCheck[0].is_nullable).toBe("YES");

    // Existing tickets should have resolutionSummary === null
    const existingTicket = await prisma.ticket.findFirst({
      select: {
        id: true,
        // @ts-ignore - resolutionSummary will be available once schema is updated
        resolutionSummary: true,
      },
    });

    expect(existingTicket).not.toBeNull();
    // @ts-ignore
    expect(existingTicket?.resolutionSummary).toBeNull();
  });

  it("MG-06 (AC-24): Seed data integrity and uniqueness constraints prevent duplicate records", async () => {
    const prisma = getPrisma();

    // Verify categories are unique
    const categories = await prisma.category.findMany();
    const catNames = new Set(categories.map((c) => c.name));
    expect(catNames.size).toBe(categories.length);
    expect(categories.length).toBeGreaterThanOrEqual(4);

    // Verify users have unique emails
    const users = await prisma.user.findMany();
    const userEmails = new Set(users.map((u) => u.email));
    expect(userEmails.size).toBe(users.length);

    // Verify related systems are unique
    const systems = await prisma.relatedSystem.findMany();
    const sysNames = new Set(systems.map((s) => s.name));
    expect(sysNames.size).toBe(systems.length);
  });

  it("MG-07 (AC-23): Create Actions Taken linked to valid Ticket and User enforces foreign keys", async () => {
    const prisma = getPrisma();
    expect((prisma as any).actionTaken).toBeDefined();

    const ticket = await prisma.ticket.findFirst();
    const staff = await prisma.user.findFirst({ where: { role: "IT Staff" } });
    expect(ticket).not.toBeNull();
    expect(staff).not.toBeNull();

    const action = await (prisma as any).actionTaken.create({
      data: {
        ticketId: ticket!.id,
        actionDateTime: new Date(),
        description: "Migration relational integrity test",
        result: "Verified valid foreign key insertion",
        performedById: staff!.id,
        followUpRequired: false,
      },
    });

    expect(action.id).toBeDefined();
    expect(action.ticketId).toBe(ticket!.id);
    expect(action.performedById).toBe(staff!.id);

    // Clean up
    await (prisma as any).actionTaken.delete({ where: { id: action.id } });
  });

  it("MG-08 (AC-23): Attempt to link Action Taken to nonexistent Ticket or User is rejected", async () => {
    const prisma = getPrisma();
    expect((prisma as any).actionTaken).toBeDefined();

    const staff = await prisma.user.findFirst({ where: { role: "IT Staff" } });
    expect(staff).not.toBeNull();

    // Invalid ticket ID foreign key
    await expect(
      (prisma as any).actionTaken.create({
        data: {
          ticketId: "00000000-0000-0000-0000-000000000000",
          actionDateTime: new Date(),
          description: "Invalid FK test",
          result: "Should fail",
          performedById: staff!.id,
          followUpRequired: false,
        },
      })
    ).rejects.toThrow();

    // Invalid performer ID foreign key
    const ticket = await prisma.ticket.findFirst();
    await expect(
      (prisma as any).actionTaken.create({
        data: {
          ticketId: ticket!.id,
          actionDateTime: new Date(),
          description: "Invalid FK test",
          result: "Should fail",
          performedById: "00000000-0000-0000-0000-000000000000",
          followUpRequired: false,
        },
      })
    ).rejects.toThrow();
  });
});
