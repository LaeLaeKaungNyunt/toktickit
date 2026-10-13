import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTicketActions,
  createTicketAction,
  updateTicketAction,
  updateStaffTicketStatus,
} from "../../src/api/staff";

describe("Lab 4 Actions Taken & Resolution API Client Contract (Issue #46)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchTicketActions calls the canonical /api/v1/tickets/:ticketId/actions endpoint (NOT /staff/)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ actions: [] }),
    } as Response);

    const res = await fetchTicketActions("test-token", "ticket-123");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/tickets/ticket-123/actions",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer test-token",
        },
      })
    );
    expect(res).toEqual({ actions: [] });
  });

  it("createTicketAction calls the canonical /api/v1/tickets/:ticketId/actions POST endpoint", async () => {
    const mockPayload = {
      actionDateTime: "2026-10-13T10:00:00.000Z",
      description: "Replaced faulty switch",
      result: "Switch active",
      assignedToId: "staff-2",
      followUpRequired: false,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        action: { id: "act-1", ...mockPayload, status: "Active" },
      }),
    } as Response);

    const res = await createTicketAction("test-token", "ticket-123", mockPayload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/tickets/ticket-123/actions",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockPayload),
      })
    );
    expect(res.action.id).toBe("act-1");
  });

  it("updateTicketAction calls the canonical /api/v1/tickets/:ticketId/actions/:actionId PATCH endpoint", async () => {
    const mockPayload = {
      description: "Replaced faulty switch port",
      result: "Gigabit active",
      expectedUpdatedAt: "2026-10-13T10:05:00.000Z",
      status: "Completed" as const,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        action: { id: "act-1", ...mockPayload },
      }),
    } as Response);

    const res = await updateTicketAction("test-token", "ticket-123", "act-1", mockPayload);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/tickets/ticket-123/actions/act-1",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockPayload),
      })
    );
    expect(res.action.status).toBe("Completed");
  });

  it("updateStaffTicketStatus calls /api/v1/staff/tickets/:ticketId/status with expectedUpdatedAt and resolutionSummary", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ticket: { id: "ticket-123", status: "Resolved", resolutionSummary: "Resolved by replacing switch." },
      }),
    } as Response);

    const res = await updateStaffTicketStatus(
      "test-token",
      "ticket-123",
      "Resolved",
      "2026-10-13T10:00:00.000Z",
      "Resolved by replacing switch."
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/staff/tickets/ticket-123/status",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Resolved",
          expectedUpdatedAt: "2026-10-13T10:00:00.000Z",
          resolutionSummary: "Resolved by replacing switch.",
        }),
      })
    );
    expect(res.ticket.status).toBe("Resolved");
  });
});
