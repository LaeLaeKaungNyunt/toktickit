export interface StaffQueueTicket {
  id: string;
  ticketNumber: string;
  requester: {
    id: string;
    name: string;
  };
  category: {
    id: number;
    name: string;
  };
  summary: string;
  requestedPriority: string;
  status: string;
  itPriority: string | null;
  assignee: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffQueuePagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface StaffQueueResponse {
  items: StaffQueueTicket[];
  pagination: StaffQueuePagination;
}

export interface StaffQueueQueryParams {
  search?: string;
  status?: string;
  priority?: string;
  assignment?: string;
  sortBy?: "ticketNumber" | "createdAt" | "status" | "requestedPriority" | "itPriority" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ActionPerformerDto {
  id: string;
  name: string;
}

export interface ActionAssigneeDto {
  id: string;
  name: string;
}

export interface ActionTakenDto {
  id: string;
  ticketId: string;
  actionDateTime: string;
  description: string;
  result: string;
  performedById: string;
  performedBy: ActionPerformerDto;
  assignedToId: string | null;
  assignedTo: ActionAssigneeDto | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: "Active" | "Completed" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionTakenPayload {
  actionDateTime: string;
  description: string;
  result: string;
  assignedToId?: string | null;
  followUpRequired: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
}

export interface UpdateActionTakenPayload {
  description?: string;
  result?: string;
  assignedToId?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  status?: "Active" | "Completed" | "Cancelled";
  expectedUpdatedAt: string;
}
