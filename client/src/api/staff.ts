import { StaffQueueQueryParams, StaffQueueResponse } from "../types/staff";

const API_BASE = "http://localhost:3000/api/v1";

export async function fetchStaffTickets(
  token: string,
  params: StaffQueueQueryParams = {}
): Promise<StaffQueueResponse> {
  const query = new URLSearchParams();

  if (params.search) query.append("search", params.search);
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.assignment) query.append("assignment", params.assignment);
  if (params.sortBy) query.append("sortBy", params.sortBy);
  if (params.sortOrder) query.append("sortOrder", params.sortOrder);
  if (params.page !== undefined) query.append("page", String(params.page));
  if (params.pageSize !== undefined) query.append("pageSize", String(params.pageSize));

  const queryString = query.toString();
  const url = `${API_BASE}/staff/tickets${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch staff tickets (${res.status})`);
  }

  return res.json();
}

export interface StaffTicketDetailResponse {
  ticket: {
    id: string;
    ticketNumber: string;
    requester: { id: string; name: string; email?: string };
    category: { id: number; name: string };
    relatedSystem: { id: string; name: string };
    summary: string;
    description: string;
    requestedPriority: string;
    status: string;
    itPriority: string | null;
    assignee: { id: string; name: string; email?: string } | null;
    createdAt: string;
    updatedAt: string;
    attachments: Array<{
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
    }>;
  };
}

export async function fetchStaffTicketDetail(
  token: string,
  ticketId: string
): Promise<StaffTicketDetailResponse> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch ticket detail (${res.status})`);
  }

  return res.json();
}
