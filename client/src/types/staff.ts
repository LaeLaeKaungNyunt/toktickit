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
