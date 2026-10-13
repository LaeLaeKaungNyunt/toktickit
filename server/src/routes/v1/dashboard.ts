import { Router, Request, Response } from "express";
import { getPrisma } from "../../prisma.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(authenticateToken);

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

dashboardRouter.get(
  "/staff",
  requireRole("IT Staff", "Administrator"),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const prisma = getPrisma();
    const userId = (req as AuthenticatedRequest).user!.id;

    // 1. Authoritative Metrics (calculated concurrently from database queries)
    const [
      unassignedTickets,
      myAssignedTickets,
      urgentTickets,
      myActiveActionsCount,
      ...statusCountResults
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          assigneeId: null,
        },
      }),
      prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          assigneeId: userId,
        },
      }),
      prisma.ticket.count({
        where: {
          currentStatus: { notIn: ["Closed", "Cancelled"] },
          itPriority: { in: ["Urgent", "High"] },
        },
      }),
      prisma.actionTaken.count({
        where: {
          status: "Active",
          assignedToId: userId,
        },
      }),
      ...ALL_STATUSES.map((status) =>
        prisma.ticket.count({ where: { currentStatus: status } })
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    ALL_STATUSES.forEach((status, idx) => {
      statusCounts[status] = statusCountResults[idx];
    });

    // 2. Previews (capped at 5 records each)
    // 2.1 My Actions Taken: Active, assigned to caller, ordered by actionDateTime ASC, createdAt ASC, id ASC
    const myActionsDb = await prisma.actionTaken.findMany({
      where: {
        status: "Active",
        assignedToId: userId,
      },
      orderBy: [
        { actionDateTime: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: 5,
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            summary: true,
          },
        },
      },
    });

    const myActions = myActionsDb.map((a) => ({
      id: a.id,
      ticketId: a.ticketId,
      ticketNumber: a.ticket.ticketNumber,
      ticketSummary: a.ticket.summary,
      description: a.description,
      status: a.status,
      followUpRequired: a.followUpRequired,
      actionDateTime: a.actionDateTime.toISOString(),
      createdAt: a.createdAt.toISOString(),
    }));

    // 2.2 Recent Tickets: system-wide, ordered by updatedAt DESC, id DESC
    const recentTicketsDb = await prisma.ticket.findMany({
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      take: 5,
    });

    const recentTickets = recentTicketsDb.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      status: t.currentStatus,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority ?? null,
      updatedAt: t.updatedAt.toISOString(),
    }));

    // 2.3 Urgent Tickets: non-terminal, itPriority Urgent or High, Urgent before High, then updatedAt DESC, id DESC
    const urgentTicketsDb = await prisma.ticket.findMany({
      where: {
        currentStatus: { notIn: ["Closed", "Cancelled"] },
        itPriority: { in: ["Urgent", "High"] },
      },
      orderBy: [
        { itPriority: "desc" }, // Alphabetical: 'Urgent' > 'High'
        { updatedAt: "desc" },
        { id: "desc" },
      ],
      take: 5,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const urgentTicketsList = urgentTicketsDb.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      status: t.currentStatus,
      itPriority: t.itPriority,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name,
          }
        : null,
      updatedAt: t.updatedAt.toISOString(),
    }));

    res.json({
      metrics: {
        unassignedTickets,
        myAssignedTickets,
        urgentTickets,
        myActiveActionsCount,
        statusCounts,
      },
      myActions,
      recentTickets,
      urgentTickets: urgentTicketsList,
    });
  } catch (error) {
    console.error("Failed to load staff dashboard:", error);
    res.status(500).json({ error: "Failed to load staff dashboard" });
  }
});

dashboardRouter.get(
  "/requester",
  requireRole("Requester"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const prisma = getPrisma();
      const userId = (req as AuthenticatedRequest).user!.id;

      // 1. Authoritative Metrics (calculated concurrently from database queries)
      const [
        myActiveTickets,
        waitingForMe,
        resolvedTicketsCount,
        totalTicketsCount,
        ...statusCountResults
      ] = await Promise.all([
        prisma.ticket.count({
          where: {
            requesterId: userId,
            currentStatus: { notIn: ["Closed", "Cancelled"] },
          },
        }),
        prisma.ticket.count({
          where: {
            requesterId: userId,
            currentStatus: "Waiting for Requester",
          },
        }),
        prisma.ticket.count({
          where: {
            requesterId: userId,
            currentStatus: "Resolved",
          },
        }),
        prisma.ticket.count({
          where: {
            requesterId: userId,
          },
        }),
        ...ALL_STATUSES.map((status) =>
          prisma.ticket.count({
            where: {
              requesterId: userId,
              currentStatus: status,
            },
          })
        ),
      ]);

      const statusCounts: Record<string, number> = {};
      ALL_STATUSES.forEach((status, idx) => {
        statusCounts[status] = statusCountResults[idx];
      });

      // 2. Previews (capped at 5 records each)
      // 2.1 Waiting for Me Tickets: owned, status "Waiting for Requester", ordered by updatedAt DESC, id DESC
      const waitingForMeDb = await prisma.ticket.findMany({
        where: {
          requesterId: userId,
          currentStatus: "Waiting for Requester",
        },
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        take: 5,
      });

      const waitingForMeTickets = waitingForMeDb.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        summary: t.summary,
        status: t.currentStatus,
        updatedAt: t.updatedAt.toISOString(),
      }));

      // 2.2 Recently Resolved Tickets: owned, currently in "Resolved", ordered by latest STATUS_CHANGED event with newStatus = 'Resolved' DESC (fallback to updatedAt DESC), then id DESC
      const resolvedTicketsDb = await prisma.ticket.findMany({
        where: {
          requesterId: userId,
          currentStatus: "Resolved",
        },
        include: {
          ticketEvents: {
            where: {
              eventType: "STATUS_CHANGED",
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      const resolvedTicketsWithResolvedAt = resolvedTicketsDb.map((t) => {
        const resolutionEvent = t.ticketEvents.find((e) => {
          const payload = e.payloadJson as any;
          return payload && payload.newStatus === "Resolved";
        });

        const resolvedAt = resolutionEvent ? resolutionEvent.createdAt : t.updatedAt;
        const resolutionSummary =
          t.resolutionSummary ??
          (resolutionEvent?.payloadJson as any)?.resolutionSummary ??
          null;

        return {
          id: t.id,
          ticketNumber: t.ticketNumber,
          summary: t.summary,
          status: t.currentStatus,
          resolutionSummary,
          resolvedAt,
          updatedAt: t.updatedAt,
        };
      });

      resolvedTicketsWithResolvedAt.sort((a, b) => {
        const diff = b.resolvedAt.getTime() - a.resolvedAt.getTime();
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });

      const recentlyResolvedTickets = resolvedTicketsWithResolvedAt
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          ticketNumber: t.ticketNumber,
          summary: t.summary,
          status: t.status,
          resolutionSummary: t.resolutionSummary,
          resolvedAt: t.resolvedAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        }));

      // 2.3 Recent Tickets: all owned tickets, ordered by updatedAt DESC, id DESC
      const recentTicketsDb = await prisma.ticket.findMany({
        where: {
          requesterId: userId,
        },
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" },
        ],
        take: 5,
      });

      const recentTickets = recentTicketsDb.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        summary: t.summary,
        status: t.currentStatus,
        updatedAt: t.updatedAt.toISOString(),
      }));

      res.json({
        metrics: {
          myActiveTickets,
          waitingForMe,
          resolvedTicketsCount,
          totalTicketsCount,
          statusCounts,
        },
        waitingForMeTickets,
        recentlyResolvedTickets,
        recentTickets,
      });
    } catch (error) {
      console.error("Failed to load requester dashboard:", error);
      res.status(500).json({ error: "Failed to load requester dashboard" });
    }
  }
);

export default dashboardRouter;
