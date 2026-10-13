import {
  StaffQueueQueryParams,
  StaffQueueResponse,
  StaffDashboardResponse,
  ActionTakenDto,
  CreateActionTakenPayload,
  UpdateActionTakenPayload,
} from "../types/staff";

const API_BASE = "http://localhost:3000/api/v1";

export async function fetchStaffDashboard(token: string): Promise<StaffDashboardResponse> {
  const url = `${API_BASE}/dashboard/staff`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch staff dashboard (${res.status})`);
  }

  return res.json();
}

export async function fetchStaffTickets(
  token: string,
  params: StaffQueueQueryParams = {}
): Promise<StaffQueueResponse> {
  const query = new URLSearchParams();

  if (params.search) query.append("search", params.search);
  if (params.status) query.append("status", params.status);
  if (params.priority) query.append("priority", params.priority);
  if (params.assignment) query.append("assignment", params.assignment);
  if (params.assignedToMe !== undefined) query.append("assignedToMe", String(params.assignedToMe));
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
    requesterResolution: string | null;
    resolutionSummary?: string | null;
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

export interface TicketCommentDto {
  id: string;
  body: string;
  author: { id: string; name: string; role: string };
  createdAt: string;
}

export interface InternalNoteDto {
  id: string;
  body: string;
  author: { id: string; name: string; role: string };
  createdAt: string;
}

export interface StaffUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
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

export async function claimStaffTicket(
  token: string,
  ticketId: string
): Promise<{ ticket: { id: string; assignee: { id: string; name: string; email?: string } | null } }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/claim`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to claim ticket (${res.status})`);
  }

  return res.json();
}

export async function reassignStaffTicket(
  token: string,
  ticketId: string,
  assigneeId: string | null
): Promise<{ ticket: { id: string; assignee: { id: string; name: string; email?: string } | null } }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/assignment`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assigneeId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to reassign ticket (${res.status})`);
  }

  return res.json();
}

export async function updateStaffTicketPriority(
  token: string,
  ticketId: string,
  itPriority: string
): Promise<{ ticket: { id: string; itPriority: string } }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/priority`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ itPriority }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update IT Priority (${res.status})`);
  }

  return res.json();
}

export async function updateStaffTicketStatus(
  token: string,
  ticketId: string,
  status: string,
  expectedUpdatedAt?: string,
  resolutionSummary?: string
): Promise<{ ticket: { id: string; status: string; resolutionSummary?: string | null; updatedAt?: string } }> {
  const payload: Record<string, any> = { status };
  if (expectedUpdatedAt !== undefined) {
    payload.expectedUpdatedAt = expectedUpdatedAt;
  }
  if (resolutionSummary !== undefined) {
    payload.resolutionSummary = resolutionSummary;
  }

  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || `Failed to update status (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}

export async function fetchStaffTicketComments(
  token: string,
  ticketId: string
): Promise<{ comments: TicketCommentDto[] }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/comments`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch comments (${res.status})`);
  }

  return res.json();
}

export async function addStaffTicketComment(
  token: string,
  ticketId: string,
  body: string
): Promise<{ comment: TicketCommentDto }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to add comment (${res.status})`);
  }

  return res.json();
}

export async function fetchStaffTicketNotes(
  token: string,
  ticketId: string
): Promise<{ notes: InternalNoteDto[] }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/notes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch internal notes (${res.status})`);
  }

  return res.json();
}

export async function addStaffTicketNote(
  token: string,
  ticketId: string,
  body: string
): Promise<{ note: InternalNoteDto }> {
  const res = await fetch(`${API_BASE}/staff/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to add internal note (${res.status})`);
  }

  return res.json();
}

export async function fetchStaffUsers(
  token: string
): Promise<{ users: StaffUserDto[] }> {
  const res = await fetch(`${API_BASE}/staff/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch staff users (${res.status})`);
  }

  return res.json();
}

export async function fetchTicketActions(
  token: string,
  ticketId: string
): Promise<{ actions: ActionTakenDto[] }> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/actions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || `Failed to fetch actions (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}

export async function createTicketAction(
  token: string,
  ticketId: string,
  payload: CreateActionTakenPayload
): Promise<{ action: ActionTakenDto }> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/actions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || `Failed to create action (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}

export async function updateTicketAction(
  token: string,
  ticketId: string,
  actionId: string,
  payload: UpdateActionTakenPayload
): Promise<{ action: ActionTakenDto }> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/actions/${actionId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(errorData.error || `Failed to update action (${res.status})`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}
