import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { getPrisma } from "../../prisma.js";
import { authenticateToken, requireRole } from "../../middleware/auth.js";

export const staffRouter = Router();

// Apply IT Staff authentication and role checks to all staff routes
staffRouter.use(authenticateToken);
staffRouter.use(requireRole("IT Staff"));

const VALID_STATUSES = new Set(["New", "In Progress", "On Hold", "Resolved", "Closed", "Cancelled"]);
const VALID_PRIORITIES = new Set(["Low", "Medium", "High", "Urgent", "Unassigned"]);
const VALID_ASSIGNMENTS = new Set(["assigned", "unassigned"]);
const VALID_SORT_FIELDS = new Set(["ticketNumber", "createdAt", "status", "requestedPriority", "itPriority", "updatedAt"]);
const VALID_SORT_ORDERS = new Set(["asc", "desc"]);

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
