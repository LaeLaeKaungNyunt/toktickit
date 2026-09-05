import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import multer from "multer";
import { getPrisma } from "../../prisma.js";
import {
  requesterContextMiddleware,
  AuthenticatedRequesterRequest,
} from "../../middleware/requesterContext.js";
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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.devRequester!.id;

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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requester = req.devRequester!;

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
            requesterId: requester.id,
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
            actorId: requester.id,
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
            displayName: ticket.requester.displayName,
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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.devRequester!.id;
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
          displayName: ticket.requester.displayName,
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

// POST /api/v1/tickets/:ticketId/attachments (AC-22, AC-23, AC-24, BR-20, BR-21, BR-22, BR-23, BR-24, BR-29, BR-33)
router.post(
  "/tickets/:ticketId/attachments",
  requesterContextMiddleware,
  (req: AuthenticatedRequesterRequest, res: Response) => {
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
        const requesterId = req.devRequester!.id;
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

        // Verify ticket ownership
        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketId, requesterId },
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
                actorId: requesterId,
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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.devRequester!.id;
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
          ticket: {
            requesterId, // Hardcoded ticket ownership
          },
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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.devRequester!.id;
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
          ticket: {
            requesterId, // Hardcoded ticket ownership
          },
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
  requesterContextMiddleware,
  async (req: AuthenticatedRequesterRequest, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.devRequester!.id;
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
          ticket: {
            requesterId, // Hardcoded ticket ownership
          },
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
              removedByRequesterId: requesterId,
            },
          });

          await tx.ticketEvent.create({
            data: {
              ticketId,
              actorId: requesterId,
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

export default router;
