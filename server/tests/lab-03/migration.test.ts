import { describe, it, expect, afterAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";

describe("Lab 3 User Migration and Data Preservation", () => {
  afterAll(async () => {
    await getPrisma().$disconnect();
  });

  it("AC-37 & AC-38: Existing requesters exist as User records with Requester role and preserved data", async () => {
    const prisma = getPrisma();

    const requesters = await prisma.user.findMany({
      where: { role: "Requester" },
    });

    expect(requesters.length).toBeGreaterThanOrEqual(4);

    const alice = await prisma.user.findUnique({
      where: { email: "alice.smith@university.edu" },
      include: {
        tickets: true,
        ticketEvents: true,
        removedAttachments: true,
      },
    });

    expect(alice).not.toBeNull();
    expect(alice?.name).toBe("Alice Smith");
    expect(alice?.role).toBe("Requester");
    expect(alice?.isActive).toBe(true);
    expect(alice?.passwordHash).toBeDefined();
    expect(Array.isArray(alice?.tickets)).toBe(true);
    expect(Array.isArray(alice?.ticketEvents)).toBe(true);
    expect(Array.isArray(alice?.removedAttachments)).toBe(true);
  });

  it("AC-38: Category integer IDs and Ticket.categoryId relational continuity are preserved", async () => {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
    });

    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(typeof categories[0].id).toBe("number");
    expect(categories[0].name).toBe("Account and Access");

    // Verify Ticket.categoryId -> Category.id relational continuity for all existing tickets
    const tickets = await prisma.ticket.findMany({
      include: {
        category: true,
        requester: true,
      },
    });

    for (const ticket of tickets) {
      expect(ticket.category).toBeDefined();
      expect(ticket.categoryId).toBe(ticket.category.id);
      expect(typeof ticket.categoryId).toBe("number");
      expect(typeof ticket.category.id).toBe("number");
      expect(categories.some((c) => c.id === ticket.categoryId)).toBe(true);
      expect(ticket.requester).toBeDefined();
      expect(ticket.requester.id).toBe(ticket.requesterId);
      expect(ticket.requester.role).toBe("Requester");
    }
  });

  it("AC-38: Ticket, Attachment, and TicketEvent relational preservation", async () => {
    const prisma = getPrisma();

    // Verify Ticket -> User (Requester) relationship
    const tickets = await prisma.ticket.findMany({
      include: {
        requester: true,
      },
    });

    for (const ticket of tickets) {
      expect(ticket.requester).toBeDefined();
      expect(ticket.requester.id).toBe(ticket.requesterId);
      expect(ticket.requester.role).toBe("Requester");
    }

    // Verify Attachment -> Ticket & Attachment -> User (removedByRequester) relationship
    const attachments = await prisma.attachment.findMany({
      include: {
        ticket: true,
        removedByRequester: true,
      },
    });

    for (const attachment of attachments) {
      expect(attachment.ticket).toBeDefined();
      expect(attachment.ticketId).toBe(attachment.ticket.id);

      if (attachment.removedByRequesterId) {
        expect(attachment.removedByRequester).toBeDefined();
        expect(attachment.removedByRequester?.id).toBe(attachment.removedByRequesterId);
        expect(attachment.removedByRequester?.role).toBe("Requester");
      }
    }

    // Verify TicketEvent -> Ticket & TicketEvent -> User (actor) relationship
    const ticketEvents = await prisma.ticketEvent.findMany({
      include: {
        ticket: true,
        actor: true,
      },
    });

    for (const event of ticketEvents) {
      expect(event.ticket).toBeDefined();
      expect(event.ticketId).toBe(event.ticket.id);

      if (event.actorId) {
        expect(event.actor).toBeDefined();
        expect(event.actor?.id).toBe(event.actorId);
      }
    }
  });

  it("AC-38: Seeded IT Staff and Administrator users exist with correct roles", async () => {
    const prisma = getPrisma();

    const staff = await prisma.user.findUnique({
      where: { email: "staff1@university.edu" },
    });
    expect(staff).not.toBeNull();
    expect(staff?.role).toBe("IT Staff");

    const admin = await prisma.user.findUnique({
      where: { email: "admin@university.edu" },
    });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("Administrator");
  });
});
