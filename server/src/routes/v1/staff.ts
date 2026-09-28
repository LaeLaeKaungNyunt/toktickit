import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../../prisma.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../../middleware/auth.js";

export const staffRouter = Router();

// Apply IT Staff authentication and role checks to all staff routes
staffRouter.use(authenticateToken);
staffRouter.use(requireRole("IT Staff"));

const VALID_STATUSES = new Set([
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
]);
const VALID_PRIORITIES = new Set(["Low", "Medium", "High", "Urgent", "Unassigned"]);
const VALID_ASSIGNMENTS = new Set(["assigned", "unassigned"]);
const VALID_SORT_FIELDS = new Set(["ticketNumber", "createdAt", "status", "requestedPriority", "itPriority", "updatedAt"]);
const VALID_SORT_ORDERS = new Set(["asc", "desc"]);

const PERMITTED_TRANSITIONS: Record<string, string[]> = {
  New: ["Open", "In Progress", "Waiting for Requester", "Cancelled"],
  Open: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
  "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  Resolved: ["Closed", "Reopened", "In Progress"],
  Reopened: ["In Progress", "Waiting for Requester", "Resolved", "Cancelled"],
  Closed: [],
  Cancelled: [],
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/staff/users
 * Returns list of active IT Staff and Administrator users for assignment.
 */
staffRouter.get("/users", async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["IT Staff", "Administrator"] },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ users });
  } catch (error) {
    console.error("Failed to fetch staff users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/staff/tickets
 * Returns the ticket queue for an authenticated IT Staff user.
 */
staffRouter.get("/tickets", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      priority,
      assignment,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      pageSize = "20",
    } = req.query;

    // 1. Validate Query Parameters
    if (status !== undefined && (typeof status !== "string" || !VALID_STATUSES.has(status))) {
      res.status(400).json({ error: "Invalid status query parameter" });
      return;
    }

    if (priority !== undefined && (typeof priority !== "string" || !VALID_PRIORITIES.has(priority))) {
      res.status(400).json({ error: "Invalid priority query parameter" });
      return;
    }

    if (assignment !== undefined && (typeof assignment !== "string" || !VALID_ASSIGNMENTS.has(assignment))) {
      res.status(400).json({ error: "Invalid assignment query parameter" });
      return;
    }

    if (typeof sortBy !== "string" || !VALID_SORT_FIELDS.has(sortBy)) {
      res.status(400).json({ error: "Invalid sortBy query parameter" });
      return;
    }

    if (typeof sortOrder !== "string" || !VALID_SORT_ORDERS.has(sortOrder)) {
      res.status(400).json({ error: "Invalid sortOrder query parameter" });
      return;
    }

    const pageStr = String(page).trim();
    if (!/^\d+$/.test(pageStr)) {
      res.status(400).json({ error: "Invalid page query parameter" });
      return;
    }
    const parsedPage = parseInt(pageStr, 10);
    if (parsedPage < 1) {
      res.status(400).json({ error: "Invalid page query parameter" });
      return;
    }

    const pageSizeStr = String(pageSize).trim();
    if (!/^\d+$/.test(pageSizeStr)) {
      res.status(400).json({ error: "Invalid pageSize query parameter" });
      return;
    }
    const parsedPageSize = parseInt(pageSizeStr, 10);
    if (parsedPageSize < 1 || parsedPageSize > 100) {
      res.status(400).json({ error: "Invalid pageSize query parameter" });
      return;
    }

    // 2. Build Where Clauses
    const where: Prisma.TicketWhereInput = {};

    if (status) {
      where.currentStatus = status as string;
    }

    if (priority) {
      if (priority === "Unassigned") {
        where.itPriority = null;
      } else {
        where.itPriority = priority as string;
      }
    }

    if (assignment) {
      if (assignment === "assigned") {
        where.assigneeId = { not: null };
      } else if (assignment === "unassigned") {
        where.assigneeId = null;
      }
    }

    if (typeof search === "string" && search.trim().length > 0) {
      const trimmedSearch = search.trim();
      where.OR = [
        { ticketNumber: { contains: trimmedSearch, mode: "insensitive" } },
        { summary: { contains: trimmedSearch, mode: "insensitive" } },
        { description: { contains: trimmedSearch, mode: "insensitive" } },
        { requester: { name: { contains: trimmedSearch, mode: "insensitive" } } },
        { category: { name: { contains: trimmedSearch, mode: "insensitive" } } },
      ];
    }

    // 3. Count Total Items
    const prisma = getPrisma();
    const totalItems = await prisma.ticket.count({ where });
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / parsedPageSize);

    // 4. Build Sorting
    const order = sortOrder as "asc" | "desc";
    let orderBy: Prisma.TicketOrderByWithRelationInput[] = [];

    if (sortBy === "ticketNumber") {
      orderBy = [{ ticketNumber: order }, { id: "desc" }];
    } else if (sortBy === "status") {
      orderBy = [{ currentStatus: order }, { id: "desc" }];
    } else if (sortBy === "requestedPriority") {
      orderBy = [{ requestedPriority: order }, { id: "desc" }];
    } else if (sortBy === "itPriority") {
      orderBy = [{ itPriority: order }, { id: "desc" }];
    } else if (sortBy === "updatedAt") {
      orderBy = [{ updatedAt: order }, { id: "desc" }];
    } else {
      orderBy = [{ createdAt: order }, { id: "desc" }];
    }

    // 5. Query Records
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy,
      skip: (parsedPage - 1) * parsedPageSize,
      take: parsedPageSize,
      include: {
        requester: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    // 6. Format Response
    const items = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      requester: {
        id: t.requester.id,
        name: t.requester.name,
      },
      category: {
        id: t.category.id,
        name: t.category.name,
      },
      summary: t.summary,
      description: t.description,
      requestedPriority: t.requestedPriority,
      status: t.currentStatus,
      itPriority: t.itPriority ?? null,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name,
          }
        : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    res.json({
      items,
      pagination: {
        page: parsedPage,
        pageSize: parsedPageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Failed to fetch staff ticket queue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/staff/tickets/:ticketId
 * Returns the authorized IT Staff Ticket Detail.
 */
staffRouter.get("/tickets/:ticketId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticketId } = req.params;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        attachments: {
          where: { removedAt: null },
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        requester: {
          id: ticket.requester.id,
          name: ticket.requester.name,
          email: ticket.requester.email,
        },
        category: {
          id: ticket.category.id,
          name: ticket.category.name,
        },
        relatedSystem: {
          id: ticket.relatedSystem.id,
          name: ticket.relatedSystem.name,
        },
        summary: ticket.summary,
        description: ticket.description,
        requestedPriority: ticket.requestedPriority,
        status: ticket.currentStatus,
        itPriority: ticket.itPriority ?? null,
        requesterResolution: ticket.requesterResolution ?? null,
        assignee: ticket.assignee
          ? {
              id: ticket.assignee.id,
              name: ticket.assignee.name,
              email: ticket.assignee.email,
            }
          : null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        attachments: ticket.attachments.map((att) => ({
          id: att.id,
          filename: att.originalFilename,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          uploadedAt: att.uploadedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch staff ticket detail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/staff/tickets/:ticketId/claim
 * Claims an unassigned ticket for the authenticated IT Staff user.
 * MUST NOT automatically change ticket status.
 */
staffRouter.post("/tickets/:ticketId/claim", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeId: authReq.user!.id,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Create append-only TicketEvent
    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "TICKET_CLAIMED",
        payloadJson: {
          previousAssigneeId: ticket.assigneeId,
          newAssigneeId: authReq.user!.id,
        },
      },
    });

    res.json({
      ticket: {
        id: updatedTicket.id,
        assignee: updatedTicket.assignee
          ? {
              id: updatedTicket.assignee.id,
              name: updatedTicket.assignee.name,
              email: updatedTicket.assignee.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to claim ticket:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/v1/staff/tickets/:ticketId/assignment
 * Reassigns ticket to target user or unassigns if assigneeId is null.
 */
staffRouter.patch("/tickets/:ticketId/assignment", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;
    const { assigneeId } = req.body;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    let targetAssigneeId: string | null = null;
    if (assigneeId !== null && assigneeId !== undefined && assigneeId !== "") {
      if (typeof assigneeId !== "string" || !UUID_REGEX.test(assigneeId)) {
        res.status(400).json({ error: "Invalid assigneeId parameter" });
        return;
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: assigneeId },
      });

      if (!targetUser || !targetUser.isActive || !["IT Staff", "Administrator"].includes(targetUser.role)) {
        res.status(400).json({ error: "Target assignee must be an active IT Staff or Administrator user" });
        return;
      }

      targetAssigneeId = targetUser.id;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeId: targetAssigneeId,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "ASSIGNMENT_CHANGED",
        payloadJson: {
          previousAssigneeId: ticket.assigneeId,
          newAssigneeId: targetAssigneeId,
        },
      },
    });

    res.json({
      ticket: {
        id: updatedTicket.id,
        assignee: updatedTicket.assignee
          ? {
              id: updatedTicket.assignee.id,
              name: updatedTicket.assignee.name,
              email: updatedTicket.assignee.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to reassign ticket:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/v1/staff/tickets/:ticketId/priority
 * Updates IT Priority.
 */
staffRouter.patch("/tickets/:ticketId/priority", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;
    const { itPriority } = req.body;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const ALLOWED_IT_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
    if (typeof itPriority !== "string" || !ALLOWED_IT_PRIORITIES.includes(itPriority)) {
      res.status(400).json({ error: "Invalid or unsupported IT Priority value" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        itPriority,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "IT_PRIORITY_CHANGED",
        payloadJson: {
          previousItPriority: ticket.itPriority,
          newItPriority: itPriority,
        },
      },
    });

    res.json({
      ticket: {
        id: updatedTicket.id,
        itPriority: updatedTicket.itPriority,
      },
    });
  } catch (error) {
    console.error("Failed to update IT Priority:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/v1/staff/tickets/:ticketId/status
 * Performs a permitted ticket status transition.
 */
staffRouter.patch("/tickets/:ticketId/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const allowedNextStatuses = PERMITTED_TRANSITIONS[ticket.currentStatus] || [];
    if (!allowedNextStatuses.includes(status)) {
      res.status(409).json({
        error: `Status transition from '${ticket.currentStatus}' to '${status}' is not permitted`,
      });
      return;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        currentStatus: status,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "STATUS_CHANGED",
        payloadJson: {
          previousStatus: ticket.currentStatus,
          newStatus: status,
        },
      },
    });

    res.json({
      ticket: {
        id: updatedTicket.id,
        status: updatedTicket.currentStatus,
      },
    });
  } catch (error) {
    console.error("Failed to update status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/staff/tickets/:ticketId/comments
 * Returns Public Comments for a ticket.
 */
staffRouter.get("/tickets/:ticketId/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticketId } = req.params;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: {
          id: c.author.id,
          name: c.author.name,
          role: c.author.role,
        },
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch public comments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/staff/tickets/:ticketId/comments
 * Adds a Public Comment to a ticket.
 */
staffRouter.post("/tickets/:ticketId/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;
    const { body } = req.body;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const trimmedBody = typeof body === "string" ? body.trim() : "";
    if (trimmedBody.length === 0 || trimmedBody.length > 2000) {
      res.status(400).json({ error: "Comment body must be between 1 and 2,000 characters long" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const newComment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: authReq.user!.id,
        body: trimmedBody,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "PUBLIC_COMMENT_ADDED",
        payloadJson: {
          commentId: newComment.id,
        },
      },
    });

    res.status(201).json({
      comment: {
        id: newComment.id,
        body: newComment.body,
        author: {
          id: newComment.author.id,
          name: newComment.author.name,
          role: newComment.author.role,
        },
        createdAt: newComment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to post public comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/staff/tickets/:ticketId/notes
 * Returns Internal Notes for authorized staff.
 */
staffRouter.get("/tickets/:ticketId/notes", async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticketId } = req.params;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      notes: notes.map((n) => ({
        id: n.id,
        body: n.body,
        author: {
          id: n.author.id,
          name: n.author.name,
          role: n.author.role,
        },
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch internal notes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/v1/staff/tickets/:ticketId/notes
 * Adds an Internal Note to a ticket.
 */
staffRouter.post("/tickets/:ticketId/notes", async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { ticketId } = req.params;
    const { body } = req.body;

    if (!UUID_REGEX.test(ticketId)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const trimmedBody = typeof body === "string" ? body.trim() : "";
    if (trimmedBody.length === 0 || trimmedBody.length > 2000) {
      res.status(400).json({ error: "Note body must be between 1 and 2,000 characters long" });
      return;
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const newNote = await prisma.internalNote.create({
      data: {
        ticketId,
        authorId: authReq.user!.id,
        body: trimmedBody,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authReq.user!.id,
        eventType: "INTERNAL_NOTE_ADDED",
        payloadJson: {
          noteId: newNote.id,
        },
      },
    });

    res.status(201).json({
      note: {
        id: newNote.id,
        body: newNote.body,
        author: {
          id: newNote.author.id,
          name: newNote.author.name,
          role: newNote.author.role,
        },
        createdAt: newNote.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to post internal note:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
