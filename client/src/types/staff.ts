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
  assignedToMe?: boolean;
  sortBy?: "ticketNumber" | "createdAt" | "status" | "requestedPriority" | "itPriority" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface StaffDashboardMetrics {
  unassignedTickets: number;
  myAssignedTickets: number;
  urgentTickets: number;
  myActiveActionsCount: number;
  statusCounts: Record<string, number>;
}

export interface DashboardActionDto {
  id: string;
  ticketId: string;
  ticketNumber: string;
  ticketSummary: string;
  description: string;
  status: string;
  followUpRequired: boolean;
  actionDateTime: string;
  createdAt: string;
}

export interface DashboardRecentTicketDto {
  id: string;
  ticketNumber: string;
  summary: string;
  status: string;
  requestedPriority: string;
  itPriority: string | null;
  updatedAt: string;
}

export interface DashboardUrgentTicketDto {
  id: string;
  ticketNumber: string;
  summary: string;
  status: string;
  itPriority: string;
  assignee: {
    id: string;
    name: string;
  } | null;
  updatedAt: string;
}

export interface StaffDashboardResponse {
  metrics: StaffDashboardMetrics;
  myActions: DashboardActionDto[];
  recentTickets: DashboardRecentTicketDto[];
  urgentTickets: DashboardUrgentTicketDto[];
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
