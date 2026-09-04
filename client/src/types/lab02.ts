export interface DevelopmentRequester {
  id: string;
  displayName: string;
  email: string;
}

export interface CategoryV1 {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: string;
  name: string;
}

export interface ApiItemsResponse<T> {
  items: T[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type RequestedPriority = "Low" | "Medium" | "High" | "Urgent";

export interface CreateTicketPayload {
  categoryId: number;
  relatedSystemId: string;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
}

export interface CreatedTicketDto {
  id: string;
  ticketNumber: string;
  requester: {
    id: string;
    displayName: string;
  };
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: string;
    name: string;
  };
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketSortBy = "createdAt" | "ticketNumber" | "requestedPriority";
export type SortOrder = "asc" | "desc";

export interface MyTicketsQueryParams {
  search?: string;
  status?: string;
  categoryId?: number;
  relatedSystemId?: string;
  requestedPriority?: RequestedPriority;
  sortBy?: TicketSortBy;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface TicketListItemDto {
  id: string;
  ticketNumber: string;
  summary: string;
  category: {
    id: number;
    name: string;
  };
  relatedSystem: {
    id: string;
    name: string;
  };
  requestedPriority: RequestedPriority;
  currentStatus: string;
  createdAt: string;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface MyTicketsResponseDto {
  items: TicketListItemDto[];
  pagination: PaginationMetadata;
}
