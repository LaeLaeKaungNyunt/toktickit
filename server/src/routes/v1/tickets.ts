import { Router, Response } from "express";
import { getPrisma } from "../../prisma.js";
import {
  requesterContextMiddleware,
  AuthenticatedRequesterRequest,
} from "../../middleware/requesterContext.js";
import { allocateTicketNumber } from "../../utils/ticketNumber.js";

const router = Router();

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

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

export default router;
