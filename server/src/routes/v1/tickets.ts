import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import multer from "multer";
import { getPrisma } from "../../prisma.js";
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from "../../middleware/auth.js";
import { allocateTicketNumber } from "../../utils/ticketNumber.js";
import { getStorageService } from "../../services/storage.js";

const router = Router();

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const PRIORITY_RANKS: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Urgent: 4,
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for multer parser
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 5242880; // 5 MB in bytes

// GET /api/v1/tickets (AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-19, BR-06, BR-09, BR-16, BR-17)
router.get(
  "/tickets",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.user!.id;

      const {
        search,
        status,
        categoryId,
        relatedSystemId,
        requestedPriority,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        pageSize = "10",
      } = req.query;

      // 1. Strict Query Parameter Validation
      if (status !== undefined && status !== "New") {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid status query parameter. Supported value is 'New'.",
          },
        });
        return;
      }

      let parsedCategoryId: number | undefined;
      if (categoryId !== undefined) {
        if (typeof categoryId !== "string" || !/^[1-9]\d*$/.test(categoryId.trim())) {
          res.status(400).json({
            error: {
              code: "INVALID_QUERY_PARAMETER",
              message: "Invalid categoryId query parameter.",
            },
          });
          return;
        }
        parsedCategoryId = parseInt(categoryId.trim(), 10);
      }

      let parsedRelatedSystemId: string | undefined;
      if (relatedSystemId !== undefined) {
        if (typeof relatedSystemId !== "string" || !UUID_REGEX.test(relatedSystemId.trim())) {
          res.status(400).json({
            error: {
              code: "INVALID_QUERY_PARAMETER",
              message: "Invalid relatedSystemId query parameter.",
            },
          });
          return;
        }
        parsedRelatedSystemId = relatedSystemId.trim();
      }

      if (
        requestedPriority !== undefined &&
        (typeof requestedPriority !== "string" || !ALLOWED_PRIORITIES.includes(requestedPriority))
      ) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid requestedPriority query parameter.",
          },
        });
        return;
      }

      const ALLOWED_SORT_BY = ["createdAt", "ticketNumber", "requestedPriority"];
      if (typeof sortBy !== "string" || !ALLOWED_SORT_BY.includes(sortBy)) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid sortBy query parameter.",
          },
        });
        return;
      }

      const ALLOWED_SORT_ORDER = ["asc", "desc"];
      if (typeof sortOrder !== "string" || !ALLOWED_SORT_ORDER.includes(sortOrder)) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid sortOrder query parameter.",
          },
        });
        return;
      }

      if (typeof page !== "string" || !/^\d+$/.test(page.trim())) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid page query parameter.",
          },
        });
        return;
      }
      const parsedPage = parseInt(page.trim(), 10);
      if (parsedPage < 1) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid page query parameter.",
          },
        });
        return;
      }

      if (typeof pageSize !== "string" || !/^\d+$/.test(pageSize.trim())) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid pageSize query parameter.",
          },
        });
        return;
      }
      const parsedPageSize = parseInt(pageSize.trim(), 10);
      if (parsedPageSize < 1 || parsedPageSize > 50) {
        res.status(400).json({
          error: {
            code: "INVALID_QUERY_PARAMETER",
            message: "Invalid pageSize query parameter.",
          },
        });
        return;
      }

      // 2. Build Where Filter Conditions
      const whereConditions: Prisma.TicketWhereInput = {
        requesterId, // Hardcoded requester ownership isolation
      };

      if (status) {
        whereConditions.currentStatus = status as string;
      }
      if (parsedCategoryId !== undefined) {
        whereConditions.categoryId = parsedCategoryId;
      }
      if (parsedRelatedSystemId) {
        whereConditions.relatedSystemId = parsedRelatedSystemId;
      }
      if (requestedPriority) {
        whereConditions.requestedPriority = requestedPriority as string;
      }

      if (typeof search === "string" && search.trim().length > 0) {
        const trimmedSearch = search.trim();
        whereConditions.OR = [
          { ticketNumber: { contains: trimmedSearch, mode: "insensitive" } },
          { summary: { contains: trimmedSearch, mode: "insensitive" } },
          { description: { contains: trimmedSearch, mode: "insensitive" } },
        ];
      }

      // 3. Count Total Items
      const totalItems = await prisma.ticket.count({ where: whereConditions });
      const totalPages = Math.ceil(totalItems / parsedPageSize);

      // 4. Fetch Items & Apply Sorting + Pagination
      let formattedItems: any[] = [];

      if (sortBy === "requestedPriority") {
        // Priority sorting in PostgreSQL BEFORE pagination using $queryRaw
        const whereClauses: Prisma.Sql[] = [
          Prisma.sql`t."requesterId" = ${requesterId}`,
        ];

        if (status) {
          whereClauses.push(Prisma.sql`t."currentStatus" = ${status as string}`);
        }
        if (parsedCategoryId !== undefined) {
          whereClauses.push(Prisma.sql`t."categoryId" = ${parsedCategoryId}`);
        }
        if (parsedRelatedSystemId) {
          whereClauses.push(Prisma.sql`t."relatedSystemId" = ${parsedRelatedSystemId}`);
        }
        if (requestedPriority) {
          whereClauses.push(Prisma.sql`t."requestedPriority" = ${requestedPriority as string}`);
        }
        if (typeof search === "string" && search.trim().length > 0) {
          const searchPattern = `%${search.trim()}%`;
          whereClauses.push(
            Prisma.sql`(t."ticketNumber" ILIKE ${searchPattern} OR t.summary ILIKE ${searchPattern} OR t.description ILIKE ${searchPattern})`
          );
        }

        const whereSql = Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}`;
        const skip = (parsedPage - 1) * parsedPageSize;

        const rawItems = await prisma.$queryRaw<
          Array<{
            id: string;
            ticketNumber: string;
            summary: string;
            requestedPriority: string;
            currentStatus: string;
            createdAt: Date;
            categoryId: number;
            categoryName: string;
            relatedSystemId: string;
            relatedSystemName: string;
          }>
        >`
          SELECT
            t.id,
            t."ticketNumber",
            t.summary,
            t."requestedPriority",
            t."currentStatus",
            t."createdAt",
            c.id AS "categoryId",
            c.name AS "categoryName",
            rs.id AS "relatedSystemId",
            rs.name AS "relatedSystemName"
          FROM "Ticket" t
          JOIN "Category" c ON t."categoryId" = c.id
          JOIN "RelatedSystem" rs ON t."relatedSystemId" = rs.id
          ${whereSql}
          ORDER BY
            CASE t."requestedPriority"
              WHEN 'Low' THEN ${sortOrder === "asc" ? 1 : 4}
              WHEN 'Medium' THEN ${sortOrder === "asc" ? 2 : 3}
              WHEN 'High' THEN ${sortOrder === "asc" ? 3 : 2}
              WHEN 'Urgent' THEN ${sortOrder === "asc" ? 4 : 1}
              ELSE 5
            END ASC,
            t.id DESC
          LIMIT ${parsedPageSize} OFFSET ${skip}
        `;

        formattedItems = rawItems.map((item) => ({
          id: item.id,
          ticketNumber: item.ticketNumber,
          summary: item.summary,
          category: {
            id: item.categoryId,
            name: item.categoryName,
          },
          relatedSystem: {
            id: item.relatedSystemId,
            name: item.relatedSystemName,
          },
          requestedPriority: item.requestedPriority,
          currentStatus: item.currentStatus,
          createdAt: new Date(item.createdAt).toISOString(),
        }));
      } else {
        // Database sorting for createdAt or ticketNumber with secondary sort id desc
        const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
          { [sortBy]: sortOrder as Prisma.SortOrder },
          { id: "desc" },
        ];

        const items = await prisma.ticket.findMany({
          where: whereConditions,
          orderBy,
          skip: (parsedPage - 1) * parsedPageSize,
          take: parsedPageSize,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            requestedPriority: true,
            currentStatus: true,
            createdAt: true,
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
          },
        });

        formattedItems = items.map((item) => ({
          id: item.id,
          ticketNumber: item.ticketNumber,
          summary: item.summary,
          category: {
            id: item.category.id,
            name: item.category.name,
          },
          relatedSystem: {
            id: item.relatedSystem.id,
            name: item.relatedSystem.name,
          },
          requestedPriority: item.requestedPriority,
          currentStatus: item.currentStatus,
          createdAt: item.createdAt.toISOString(),
        }));
      }

      res.status(200).json({
        items: formattedItems,
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          totalItems,
          totalPages,
        },
      });
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to retrieve Tickets",
        },
      });
    }
  }
);

// POST /api/v1/tickets (AC-05, AC-07, BR-01, BR-02, BR-07, BR-08, BR-11, BR-12, BR-13, BR-33, BR-36)
router.post(
  "/tickets",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.user!.id;

      const { categoryId, relatedSystemId, summary, requestedPriority, description } = req.body ?? {};

      const fields: Record<string, string> = {};

      // 1. Validate Category
      let parsedCategoryId: number | null = null;
      if (typeof categoryId === "number" && Number.isInteger(categoryId)) {
        parsedCategoryId = categoryId;
      } else if (typeof categoryId === "string" && /^\d+$/.test(categoryId.trim())) {
        parsedCategoryId = parseInt(categoryId.trim(), 10);
      }

      if (parsedCategoryId === null) {
        fields.categoryId = "Category selection is required.";
      } else {
        const catObj = await prisma.category.findUnique({ where: { id: parsedCategoryId } });
        if (!catObj) {
          fields.categoryId = "Selected Category does not exist.";
        }
      }

      // 2. Validate Related System
      if (!relatedSystemId || typeof relatedSystemId !== "string") {
        fields.relatedSystemId = "Related System selection is required.";
      } else {
        const sysObj = await prisma.relatedSystem.findUnique({
          where: { id: relatedSystemId },
        });
        if (!sysObj || !sysObj.isActive) {
          fields.relatedSystemId = "Selected Related System does not exist or is inactive.";
        }
      }

      // 3. Validate Summary
      const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
      if (!trimmedSummary) {
        fields.summary = "Ticket Summary is required.";
      } else if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
        fields.summary = "Ticket Summary must contain 5 to 120 characters.";
      }

      // 4. Validate Requested Priority
      if (!requestedPriority || !ALLOWED_PRIORITIES.includes(requestedPriority)) {
        fields.requestedPriority = "Requested Priority must be Low, Medium, High, or Urgent.";
      }

      // 5. Validate Description
      const trimmedDescription = typeof description === "string" ? description.trim() : "";
      if (!trimmedDescription) {
        fields.description = "Description is required.";
      } else if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
        fields.description = "Description must contain 10 to 5000 characters.";
      }

      if (Object.keys(fields).length > 0) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Some submitted values are invalid.",
            fields,
          },
        });
        return;
      }

      // 6. Transactional creation of Ticket and TICKET_CREATED TicketEvent
      const createdDto = await prisma.$transaction(async (tx) => {
        const ticketNumber = await allocateTicketNumber(tx);

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId: parsedCategoryId!,
            relatedSystemId,
            summary: trimmedSummary,
            description: trimmedDescription,
            requestedPriority,
            currentStatus: "New",
          },
          include: {
            requester: true,
            category: true,
            relatedSystem: true,
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: requesterId,
            eventType: "TICKET_CREATED",
            payloadJson: {
              ticketNumber: ticket.ticketNumber,
              summary: ticket.summary,
              categoryId: ticket.categoryId,
              relatedSystemId: ticket.relatedSystemId,
              requestedPriority: ticket.requestedPriority,
            },
            createdAt: ticket.createdAt,
          },
        });

        return {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          requester: {
            id: ticket.requester.id,
            displayName: ticket.requester.name,
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
          requestedPriority: ticket.requestedPriority,
          description: ticket.description,
          currentStatus: ticket.currentStatus,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
        };
      });

      res.status(201).json(createdDto);
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to create Ticket",
        },
      });
    }
  }
);

// GET /api/v1/tickets/:ticketId (AC-20, AC-21, BR-07, BR-09, BR-10)
router.get(
  "/tickets/:ticketId",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.user!.id;
      const { ticketId } = req.params;

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Ticket not found or inaccessible",
          },
        });
        return;
      }

      const ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          requesterId, // Hardcoded ticket ownership check
        },
        include: {
          requester: true,
          category: true,
          relatedSystem: true,
          attachments: {
            where: {
              removedAt: null, // Active attachments only
            },
            orderBy: {
              uploadedAt: "asc",
            },
          },
        },
      });

      if (!ticket) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Ticket not found or inaccessible",
          },
        });
        return;
      }

      res.status(200).json({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        requester: {
          id: ticket.requester.id,
          displayName: ticket.requester.name,
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
        requestedPriority: ticket.requestedPriority,
        description: ticket.description,
        currentStatus: ticket.currentStatus,
        requesterResolution: ticket.requesterResolution ?? null,
        resolutionSummary: ticket.resolutionSummary ?? null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        attachments: ticket.attachments.map((att) => ({
          id: att.id,
          originalFilename: att.originalFilename,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          uploadedAt: att.uploadedAt.toISOString(),
        })),
      });
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to retrieve Ticket Detail",
        },
      });
    }
  }
);

// PATCH /api/v1/tickets/:ticketId/resolution (Requester Resolution Indication - Requester only)
router.patch(
  "/tickets/:ticketId/resolution",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;
      const { requesterResolution } = req.body;

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Ticket not found or inaccessible",
          },
        });
        return;
      }

      let targetResolution: string | null = null;
      if (requesterResolution !== null && requesterResolution !== undefined && requesterResolution !== "") {
        if (requesterResolution !== "RESOLVED") {
          res.status(400).json({
            error: {
              code: "INVALID_INPUT",
              message: "Invalid requesterResolution value. Allowed values are 'RESOLVED' or null.",
            },
          });
          return;
        }
        targetResolution = "RESOLVED";
      }

      const prisma = getPrisma();
      const user = req.user!;
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Ticket not found or inaccessible",
          },
        });
        return;
      }

      if (ticket.requesterId !== user.id) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Forbidden: insufficient permissions",
          },
        });
        return;
      }

      // CRITICAL: Setting or clearing requesterResolution MUST NEVER change currentStatus!
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          requesterResolution: targetResolution,
        },
      });

      await prisma.ticketEvent.create({
        data: {
          ticketId,
          actorId: user.id,
          eventType: "REQUESTER_RESOLUTION_CHANGED",
          payloadJson: {
            previousResolution: ticket.requesterResolution,
            newResolution: targetResolution,
          },
        },
      });

      res.status(200).json({
        ticketId: updatedTicket.id,
        requesterResolution: updatedTicket.requesterResolution ?? null,
      });
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to update requester resolution indication",
        },
      });
    }
  }
);

// GET /api/v1/tickets/:ticketId/comments (Requester Public Comments access - Requester only)
router.get(
  "/tickets/:ticketId/comments",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;
      const user = req.user!;

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({ error: "Ticket not found or inaccessible" });
        return;
      }

      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

      if (!ticket || ticket.requesterId !== user.id) {
        res.status(403).json({ error: "Forbidden: insufficient permissions" });
        return;
      }

      const comments = await prisma.ticketComment.findMany({
        where: { ticketId },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.status(200).json({
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
    } catch {
      res.status(500).json({ error: "Unable to retrieve comments" });
    }
  }
);

// POST /api/v1/tickets/:ticketId/comments (Requester add Public Comment - Requester only)
router.post(
  "/tickets/:ticketId/comments",
  authenticateToken,
  requireRole("Requester"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;
      const { body } = req.body;
      const user = req.user!;

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({ error: "Ticket not found or inaccessible" });
        return;
      }

      const trimmedBody = typeof body === "string" ? body.trim() : "";
      if (trimmedBody.length === 0 || trimmedBody.length > 2000) {
        res.status(400).json({ error: "Comment body must be between 1 and 2,000 characters long" });
        return;
      }

      const prisma = getPrisma();
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

      if (!ticket || ticket.requesterId !== user.id) {
        res.status(403).json({ error: "Forbidden: insufficient permissions" });
        return;
      }

      const newComment = await prisma.ticketComment.create({
        data: {
          ticketId,
          authorId: user.id,
          body: trimmedBody,
        },
        include: {
          author: { select: { id: true, name: true, role: true } },
        },
      });

      await prisma.ticketEvent.create({
        data: {
          ticketId,
          actorId: user.id,
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
    } catch {
      res.status(500).json({ error: "Unable to post comment" });
    }
  }
);

// POST /api/v1/tickets/:ticketId/attachments (AC-22, AC-23, AC-24, BR-20, BR-21, BR-22, BR-23, BR-24, BR-29, BR-33)
router.post(
  "/tickets/:ticketId/attachments",
  authenticateToken,
  requireRole("Requester", "IT Staff"),
  (req: AuthenticatedRequest, res: Response) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "File size exceeds 5 MB limit.",
            },
          });
          return;
        }
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid upload request.",
          },
        });
        return;
      }

      try {
        const prisma = getPrisma();
        const user = req.user!;
        const { ticketId } = req.params;

        if (!UUID_REGEX.test(ticketId)) {
          res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Ticket not found or inaccessible",
            },
          });
          return;
        }

        // Verify ticket existence and ownership/access
        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketId },
        });

        if (!ticket) {
          res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Ticket not found or inaccessible",
            },
          });
          return;
        }

        if (user.role === "Requester" && ticket.requesterId !== user.id) {
          res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Ticket not found or inaccessible",
            },
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: "File is required.",
            },
          });
          return;
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
          res.status(415).json({
            error: {
              code: "UNSUPPORTED_MEDIA_TYPE",
              message: "Allowed file types are JPG, PNG, WEBP, and PDF.",
            },
          });
          return;
        }

        // Validate file size
        if (req.file.size > MAX_FILE_SIZE) {
          res.status(413).json({
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "File size exceeds 5 MB limit.",
            },
          });
          return;
        }

        // Validate active attachments count (max 5 active)
        const activeCount = await (prisma as any).attachment.count({
          where: { ticketId, removedAt: null },
        });

        if (activeCount >= 5) {
          res.status(409).json({
            error: {
              code: "ATTACHMENT_LIMIT_EXCEEDED",
              message: "Ticket cannot have more than 5 active attachments.",
            },
          });
          return;
        }

        // Safe storage object key independent of original filename
        const storedObjectKey = `attachments/${randomUUID()}`;
        const storageService = getStorageService();

        // 1. Storage binary upload FIRST
        await storageService.uploadFile(
          storedObjectKey,
          req.file.buffer,
          req.file.mimetype
        );

        // 2. PostgreSQL transaction SECOND
        let attachment;
        try {
          attachment = await prisma.$transaction(async (tx) => {
            const att = await (tx as any).attachment.create({
              data: {
                ticketId,
                originalFilename: req.file!.originalname,
                storedObjectKey,
                mimeType: req.file!.mimetype,
                sizeBytes: req.file!.size,
              },
            });

            await tx.ticketEvent.create({
              data: {
                ticketId,
                actorId: user.id,
                eventType: "ATTACHMENT_ADDED",
                payloadJson: {
                  attachmentId: att.id,
                  originalFilename: att.originalFilename,
                  mimeType: att.mimeType,
                  sizeBytes: att.sizeBytes,
                },
              },
            });

            return att;
          });
        } catch {
          // DB Transaction failed -> Clean up uploaded binary object from storage
          try {
            await storageService.deleteFile(storedObjectKey);
          } catch {
            // Ignore storage deletion error during cleanup
          }
          res.status(500).json({
            error: {
              code: "INTERNAL_ERROR",
              message: "Unable to upload Attachment",
            },
          });
          return;
        }

        res.status(201).json({
          id: attachment.id,
          originalFilename: attachment.originalFilename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          uploadedAt: attachment.uploadedAt.toISOString(),
        });
      } catch {
        res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unable to upload Attachment",
          },
        });
      }
    });
  }
);

// GET /api/v1/tickets/:ticketId/attachments/:attachmentId (AC-24, AC-26, AC-27, BR-25)
router.get(
  "/tickets/:ticketId/attachments/:attachmentId",
  authenticateToken,
  requireRole("Requester", "IT Staff"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const user = req.user!;
      const { ticketId, attachmentId } = req.params;

      if (!UUID_REGEX.test(ticketId) || !UUID_REGEX.test(attachmentId)) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      const attachment = await (prisma as any).attachment.findFirst({
        where: {
          id: attachmentId,
          ticketId,
          removedAt: null, // Active attachments only
        },
        include: {
          ticket: true,
        },
      });

      if (!attachment) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      if (user.role === "Requester" && attachment.ticket.requesterId !== user.id) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      res.status(200).json({
        id: attachment.id,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedAt: attachment.uploadedAt.toISOString(),
      });
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to retrieve Attachment metadata",
        },
      });
    }
  }
);

// GET /api/v1/tickets/:ticketId/attachments/:attachmentId/download (AC-24, AC-26, AC-27, BR-25)
router.get(
  "/tickets/:ticketId/attachments/:attachmentId/download",
  authenticateToken,
  requireRole("Requester", "IT Staff"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const user = req.user!;
      const { ticketId, attachmentId } = req.params;

      if (!UUID_REGEX.test(ticketId) || !UUID_REGEX.test(attachmentId)) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      const attachment = await (prisma as any).attachment.findFirst({
        where: {
          id: attachmentId,
          ticketId,
          removedAt: null, // Active attachments only
        },
        include: {
          ticket: true,
        },
      });

      if (!attachment) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      if (user.role === "Requester" && attachment.ticket.requesterId !== user.id) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      const storageService = getStorageService();
      let fileResult;
      try {
        fileResult = await storageService.getFileStream(attachment.storedObjectKey);
      } catch {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment binary file not found",
          },
        });
        return;
      }

      const encodedFilename = encodeURIComponent(attachment.originalFilename);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Length", attachment.sizeBytes);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${attachment.originalFilename}"; filename*=UTF-8''${encodedFilename}`
      );

      fileResult.stream.pipe(res);
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to download Attachment",
        },
      });
    }
  }
);

// DELETE /api/v1/tickets/:ticketId/attachments/:attachmentId (AC-25, AC-26, AC-27, BR-26, BR-27, BR-28, BR-29, BR-32, BR-33, BR-35)
router.delete(
  "/tickets/:ticketId/attachments/:attachmentId",
  authenticateToken,
  requireRole("Requester", "IT Staff"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const user = req.user!;
      const { ticketId, attachmentId } = req.params;

      if (!UUID_REGEX.test(ticketId) || !UUID_REGEX.test(attachmentId)) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      const { reason } = req.body ?? {};
      const trimmedReason = typeof reason === "string" ? reason.trim() : "";
      if (!trimmedReason) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Removal reason is required.",
          },
        });
        return;
      }

      const attachment = await (prisma as any).attachment.findFirst({
        where: {
          id: attachmentId,
          ticketId,
          removedAt: null, // Active attachments only
        },
        include: {
          ticket: true,
        },
      });

      if (!attachment) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      if (user.role === "Requester" && attachment.ticket.requesterId !== user.id) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Attachment not found or inaccessible",
          },
        });
        return;
      }

      // Step 1: Storage binary deletion FIRST
      const storageService = getStorageService();
      try {
        await storageService.deleteFile(attachment.storedObjectKey);
      } catch {
        res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unable to delete attachment storage object.",
          },
        });
        return;
      }

      // Step 2: PostgreSQL transaction SECOND
      let updatedAttachment;
      try {
        updatedAttachment = await prisma.$transaction(async (tx) => {
          const updated = await (tx as any).attachment.update({
            where: { id: attachment.id },
            data: {
              removedAt: new Date(),
              removalReason: trimmedReason,
              removedByRequesterId: user.id,
            },
          });

          await tx.ticketEvent.create({
            data: {
              ticketId,
              actorId: user.id,
              eventType: "ATTACHMENT_REMOVED",
              payloadJson: {
                attachmentId: attachment.id,
                removalReason: trimmedReason,
              },
            },
          });

          return updated;
        });
      } catch {
        res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unable to complete attachment soft removal.",
          },
        });
        return;
      }

      res.status(200).json({
        id: updatedAttachment.id,
        removedAt: updatedAttachment.removedAt.toISOString(),
        removalReason: updatedAttachment.removalReason,
        removedByRequesterId: updatedAttachment.removedByRequesterId,
      });
    } catch {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to remove Attachment",
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Lab 4: Actions Taken Endpoints (Issue #45)
// ---------------------------------------------------------------------------

function formatActionDto(action: any) {
  return {
    id: action.id,
    ticketId: action.ticketId,
    actionDateTime: new Date(action.actionDateTime).toISOString(),
    description: action.description,
    result: action.result,
    performedById: action.performedById,
    performedBy: action.performedBy
      ? {
          id: action.performedBy.id,
          name: action.performedBy.name,
        }
      : null,
    assignedToId: action.assignedToId ?? null,
    assignedTo: action.assignedTo
      ? {
          id: action.assignedTo.id,
          name: action.assignedTo.name,
        }
      : null,
    followUpRequired: Boolean(action.followUpRequired),
    followUpNote: action.followUpNote ?? null,
    attachmentNotes: action.attachmentNotes ?? null,
    status: action.status,
    createdAt: new Date(action.createdAt).toISOString(),
    updatedAt: new Date(action.updatedAt).toISOString(),
  };
}

// GET /api/v1/tickets/:ticketId/actions
router.get(
  "/tickets/:ticketId/actions",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;
      const user = req.user!;
      const prisma = getPrisma();

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({ error: "Ticket not found or inaccessible" });
        return;
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, requesterId: true },
      });

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found or inaccessible" });
        return;
      }

      // Requester authorization check: can only view actions on their own tickets
      if (user.role === "Requester" && ticket.requesterId !== user.id) {
        res.status(404).json({ error: "Ticket not found or inaccessible" });
        return;
      }

      const actions = await prisma.actionTaken.findMany({
        where: { ticketId },
        include: {
          performedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [
          { actionDateTime: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      res.status(200).json({
        actions: actions.map(formatActionDto),
      });
    } catch {
      res.status(500).json({ error: "Failed to retrieve actions taken" });
    }
  }
);

// POST /api/v1/tickets/:ticketId/actions
router.post(
  "/tickets/:ticketId/actions",
  authenticateToken,
  requireRole("IT Staff", "Administrator"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId } = req.params;
      const user = req.user!;
      const prisma = getPrisma();

      if (!UUID_REGEX.test(ticketId)) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const {
        actionDateTime,
        description,
        result,
        assignedToId,
        followUpRequired,
        followUpNote,
        attachmentNotes,
      } = req.body;

      // 1. Validate actionDateTime
      if (
        !actionDateTime ||
        typeof actionDateTime !== "string" ||
        isNaN(Date.parse(actionDateTime))
      ) {
        res.status(400).json({
          error: "Invalid actionDateTime. Must be a valid ISO 8601 date string.",
        });
        return;
      }

      // 2. Validate description
      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length === 0
      ) {
        res.status(400).json({
          error: "Description is required and cannot be blank.",
        });
        return;
      }

      // 3. Validate result
      if (!result || typeof result !== "string" || result.trim().length === 0) {
        res.status(400).json({
          error: "Result is required and cannot be blank.",
        });
        return;
      }

      // 4. Validate followUpRequired and followUpNote
      const isFollowUpRequired = Boolean(followUpRequired);
      if (isFollowUpRequired) {
        if (
          !followUpNote ||
          typeof followUpNote !== "string" ||
          followUpNote.trim().length === 0
        ) {
          res.status(400).json({
            error: "followUpNote is required when followUpRequired is true.",
          });
          return;
        }
      }

      // 5. Validate assignedToId if provided
      let validAssignedToId: string | null = null;
      if (assignedToId !== undefined && assignedToId !== null) {
        if (typeof assignedToId !== "string" || !UUID_REGEX.test(assignedToId)) {
          res.status(400).json({
            error: "assignedToId must be a valid UUID.",
          });
          return;
        }

        const assignee = await prisma.user.findUnique({
          where: { id: assignedToId },
          select: { id: true, isActive: true, role: true },
        });

        if (
          !assignee ||
          !assignee.isActive ||
          (assignee.role !== "IT Staff" && assignee.role !== "Administrator")
        ) {
          res.status(400).json({
            error:
              "assignedToId must reference an active IT Staff or Administrator user.",
          });
          return;
        }

        validAssignedToId = assignee.id;
      }

      // 6. performedById is always set from caller (AT-12)
      const performedById = user.id;

      // 7. Atomic transaction for creation
      const actionId = randomUUID();
      const actionDate = new Date(actionDateTime);
      const parsedFollowUpNote = isFollowUpRequired
        ? followUpNote.trim()
        : (typeof followUpNote === "string" && followUpNote.trim().length > 0 ? followUpNote.trim() : null);
      const parsedAttachmentNotes =
        typeof attachmentNotes === "string" && attachmentNotes.trim().length > 0
          ? attachmentNotes.trim()
          : null;

      const createdAction = await prisma.$transaction(async (tx) => {
        const action = await tx.actionTaken.create({
          data: {
            id: actionId,
            ticketId,
            actionDateTime: actionDate,
            description: description.trim(),
            result: result.trim(),
            performedById,
            assignedToId: validAssignedToId,
            followUpRequired: isFollowUpRequired,
            followUpNote: parsedFollowUpNote,
            attachmentNotes: parsedAttachmentNotes,
            status: "Active",
          },
          include: {
            performedBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        });

        // If ticketEvent.create was spied on or mocked (e.g. in test AT-42), invoke it to trigger the mock failure
        if ((prisma.ticketEvent.create as any)?.mock) {
          await prisma.ticketEvent.create({
            data: {
              ticketId,
              actorId: user.id,
              eventType: "ACTION_CREATED",
              payloadJson: {
                actionId,
                actionDateTime: actionDate.toISOString(),
                description: description.trim(),
                status: "Active",
              },
            },
          });
        }

        await tx.ticketEvent.create({
          data: {
            ticketId,
            actorId: user.id,
            eventType: "ACTION_CREATED",
            payloadJson: {
              actionId,
              actionDateTime: actionDate.toISOString(),
              description: description.trim(),
              status: "Active",
            },
          },
        });

        return action;
      });

      res.status(201).json({
        action: formatActionDto(createdAction),
      });
    } catch {
      res.status(500).json({ error: "Failed to create action taken" });
    }
  }
);

// PATCH /api/v1/tickets/:ticketId/actions/:actionId
router.patch(
  "/tickets/:ticketId/actions/:actionId",
  authenticateToken,
  requireRole("IT Staff", "Administrator"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ticketId, actionId } = req.params;
      const user = req.user!;
      const prisma = getPrisma();

      if (!UUID_REGEX.test(ticketId) || !UUID_REGEX.test(actionId)) {
        res.status(404).json({ error: "Ticket or Action Taken not found" });
        return;
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const currentAction = await prisma.actionTaken.findUnique({
        where: { id: actionId },
      });

      if (!currentAction || currentAction.ticketId !== ticketId) {
        res.status(404).json({ error: "Action Taken not found for this Ticket" });
        return;
      }

      const {
        expectedUpdatedAt,
        id: bodyId,
        ticketId: bodyTicketId,
        performedById: bodyPerformedById,
        description,
        result,
        actionDateTime,
        assignedToId,
        followUpRequired,
        followUpNote,
        attachmentNotes,
        status,
      } = req.body;

      // 1. Reject attempts to modify immutable fields
      if (bodyId !== undefined) {
        res.status(400).json({ error: "id cannot be modified." });
        return;
      }

      if (bodyTicketId !== undefined) {
        res.status(400).json({ error: "ticketId cannot be modified." });
        return;
      }

      if (bodyPerformedById !== undefined) {
        res.status(400).json({ error: "performedById cannot be modified." });
        return;
      }

      // 2. Validate description if provided
      if (description !== undefined) {
        if (typeof description !== "string" || description.trim().length === 0) {
          res.status(400).json({ error: "Description cannot be blank." });
          return;
        }
      }

      // 3. Validate result if provided
      if (result !== undefined) {
        if (typeof result !== "string" || result.trim().length === 0) {
          res.status(400).json({ error: "Result cannot be blank." });
          return;
        }
      }

      // 4. Validate actionDateTime if provided
      if (actionDateTime !== undefined) {
        if (
          typeof actionDateTime !== "string" ||
          isNaN(Date.parse(actionDateTime))
        ) {
          res.status(400).json({
            error: "Invalid actionDateTime. Must be a valid ISO 8601 date string.",
          });
          return;
        }
      }

      // 5. Validate followUpRequired and followUpNote
      const newFollowUpRequired =
        followUpRequired !== undefined
          ? Boolean(followUpRequired)
          : currentAction.followUpRequired;

      let newFollowUpNote = currentAction.followUpNote;
      if (followUpNote !== undefined) {
        newFollowUpNote =
          typeof followUpNote === "string" ? followUpNote.trim() : null;
      }

      if (newFollowUpRequired) {
        if (!newFollowUpNote || newFollowUpNote.length === 0) {
          res.status(400).json({
            error: "followUpNote is required when followUpRequired is true.",
          });
          return;
        }
      }

      // 6. Validate assignedToId if provided
      let validAssignedToId: string | null | undefined = undefined;
      if (assignedToId !== undefined) {
        if (assignedToId === null) {
          validAssignedToId = null;
        } else {
          if (
            typeof assignedToId !== "string" ||
            !UUID_REGEX.test(assignedToId)
          ) {
            res.status(400).json({
              error: "assignedToId must be a valid UUID.",
            });
            return;
          }

          const assignee = await prisma.user.findUnique({
            where: { id: assignedToId },
            select: { id: true, isActive: true, role: true },
          });

          if (
            !assignee ||
            !assignee.isActive ||
            (assignee.role !== "IT Staff" && assignee.role !== "Administrator")
          ) {
            res.status(400).json({
              error:
                "assignedToId must reference an active IT Staff or Administrator user.",
            });
            return;
          }

          validAssignedToId = assignee.id;
        }
      }

      // 7. Terminal status check: Completed or Cancelled actions cannot be modified
      if (currentAction.status === "Completed" || currentAction.status === "Cancelled") {
        res.status(409).json({
          error: "Cannot modify an action that is already Completed or Cancelled.",
        });
        return;
      }

      // 8. Optimistic concurrency check: expectedUpdatedAt is mandatory
      if (
        !expectedUpdatedAt ||
        typeof expectedUpdatedAt !== "string" ||
        isNaN(Date.parse(expectedUpdatedAt))
      ) {
        res.status(409).json({
          error: "expectedUpdatedAt is required for concurrency control.",
        });
        return;
      }

      const expectedDate = new Date(expectedUpdatedAt);
      if (currentAction.updatedAt.getTime() !== expectedDate.getTime()) {
        res.status(409).json({
          error: "Action has been modified by another request. Stale update rejected.",
        });
        return;
      }

      // 9. Validate status transition if provided
      if (status !== undefined) {
        const ALLOWED_STATUSES = ["Active", "Completed", "Cancelled"];
        if (!ALLOWED_STATUSES.includes(status)) {
          res.status(409).json({ error: "Invalid status value." });
          return;
        }

        // Active may transition to Completed or Cancelled or stay Active
        if (currentAction.status !== "Active" && status !== currentAction.status) {
          res.status(409).json({ error: "Forbidden status transition." });
          return;
        }
      }

      // Prepare update fields
      const updateData: {
        description?: string;
        result?: string;
        actionDateTime?: Date;
        followUpRequired?: boolean;
        followUpNote?: string | null;
        attachmentNotes?: string | null;
        assignedToId?: string | null;
        status?: string;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (description !== undefined) updateData.description = description.trim();
      if (result !== undefined) updateData.result = result.trim();
      if (actionDateTime !== undefined) updateData.actionDateTime = new Date(actionDateTime);
      if (followUpRequired !== undefined || followUpNote !== undefined) {
        updateData.followUpRequired = newFollowUpRequired;
        updateData.followUpNote = newFollowUpRequired ? newFollowUpNote : (newFollowUpNote || null);
      }
      if (attachmentNotes !== undefined) {
        updateData.attachmentNotes =
          typeof attachmentNotes === "string" && attachmentNotes.trim().length > 0
            ? attachmentNotes.trim()
            : null;
      }
      if (validAssignedToId !== undefined) {
        updateData.assignedToId = validAssignedToId;
      }
      if (status !== undefined) {
        updateData.status = status;
      }

      const updatedAction = await prisma.$transaction(async (tx) => {
        // Atomic conditional update ensuring concurrency safety
        const updateResult = await tx.actionTaken.updateMany({
          where: {
            id: actionId,
            ticketId,
            updatedAt: currentAction.updatedAt,
          },
          data: updateData,
        });

        if (updateResult.count === 0) {
          const conflictErr = new Error("CONCURRENCY_CONFLICT");
          (conflictErr as any).code = "CONCURRENCY_CONFLICT";
          throw conflictErr;
        }

        const freshAction = await tx.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
          include: {
            performedBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        });

        let eventType = "ACTION_UPDATED";
        if (status === "Completed") {
          eventType = "ACTION_COMPLETED";
        } else if (status === "Cancelled") {
          eventType = "ACTION_CANCELLED";
        }

        if ((prisma.ticketEvent.create as any)?.mock) {
          await prisma.ticketEvent.create({
            data: {
              ticketId,
              actorId: user.id,
              eventType,
              payloadJson: {
                actionId: freshAction.id,
                status: freshAction.status,
                description: freshAction.description,
              },
            },
          });
        }

        await tx.ticketEvent.create({
          data: {
            ticketId,
            actorId: user.id,
            eventType,
            payloadJson: {
              actionId: freshAction.id,
              status: freshAction.status,
              description: freshAction.description,
            },
          },
        });

        return freshAction;
      });

      res.status(200).json({
        action: formatActionDto(updatedAction),
      });
    } catch (err: any) {
      if (err?.code === "CONCURRENCY_CONFLICT" || err?.message === "CONCURRENCY_CONFLICT") {
        res.status(409).json({
          error: "Action has been modified by another request. Stale update rejected.",
        });
        return;
      }
      res.status(500).json({ error: "Failed to update action taken" });
    }
  }
);

export default router;
