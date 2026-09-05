import {
  DevelopmentRequester,
  CategoryV1,
  RelatedSystem,
  ApiItemsResponse,
  CreateTicketPayload,
  CreatedTicketDto,
  ApiErrorResponse,
  MyTicketsQueryParams,
  MyTicketsResponseDto,
  TicketDetailDto,
  AttachmentDto,
  SoftRemoveAttachmentPayload,
  SoftRemovedAttachmentDto,
} from "../types/lab02.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchDevelopmentRequesters(): Promise<DevelopmentRequester[]> {
  const res = await fetch(`${API_URL}/api/v1/development-requesters`);
  if (!res.ok) {
    throw new Error("Unable to load Development Requesters");
  }
  const data: ApiItemsResponse<DevelopmentRequester> = await res.json();
  return data.items;
}

export async function fetchCategoriesV1(): Promise<CategoryV1[]> {
  const res = await fetch(`${API_URL}/api/v1/categories`);
  if (!res.ok) {
    throw new Error("Unable to load Categories");
  }
  const data: ApiItemsResponse<CategoryV1> = await res.json();
  return data.items;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/v1/related-systems`);
  if (!res.ok) {
    throw new Error("Unable to load Related Systems");
  }
  const data: ApiItemsResponse<RelatedSystem> = await res.json();
  return data.items;
}

export async function createTicket(
  payload: CreateTicketPayload,
  requesterId: string
): Promise<CreatedTicketDto> {
  const res = await fetch(`${API_URL}/api/v1/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Requester-Id": requesterId,
    },
    body: JSON.stringify({
      categoryId: payload.categoryId,
      relatedSystemId: payload.relatedSystemId,
      summary: payload.summary,
      requestedPriority: payload.requestedPriority,
      description: payload.description,
    }),
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Unable to create Ticket";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    (error as any).fields = errorData?.error?.fields;
    throw error;
  }

  const data: CreatedTicketDto = await res.json();
  return data;
}

export async function fetchMyTickets(
  params: MyTicketsQueryParams = {},
  requesterId: string
): Promise<MyTicketsResponseDto> {
  const query = new URLSearchParams();

  if (params.search && params.search.trim().length > 0) {
    query.set("search", params.search.trim());
  }
  if (params.status && params.status.trim().length > 0) {
    query.set("status", params.status.trim());
  }
  if (params.categoryId !== undefined && params.categoryId !== null) {
    query.set("categoryId", String(params.categoryId));
  }
  if (params.relatedSystemId && params.relatedSystemId.trim().length > 0) {
    query.set("relatedSystemId", params.relatedSystemId.trim());
  }
  if (params.requestedPriority) {
    query.set("requestedPriority", params.requestedPriority);
  }
  if (params.sortBy) {
    query.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    query.set("sortOrder", params.sortOrder);
  }
  if (params.page !== undefined && params.page !== null) {
    query.set("page", String(params.page));
  }
  if (params.pageSize !== undefined && params.pageSize !== null) {
    query.set("pageSize", String(params.pageSize));
  }

  const queryString = query.toString();
  const url = `${API_URL}/api/v1/tickets${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url, {
    headers: {
      "X-Dev-Requester-Id": requesterId,
    },
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Unable to retrieve Tickets";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const data: MyTicketsResponseDto = await res.json();
  return data;
}

export async function fetchTicketDetail(
  ticketId: string,
  requesterId: string
): Promise<TicketDetailDto> {
  const res = await fetch(`${API_URL}/api/v1/tickets/${ticketId}`, {
    headers: {
      "X-Dev-Requester-Id": requesterId,
    },
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Ticket not found or inaccessible";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const data: TicketDetailDto = await res.json();
  return data;
}

export async function uploadAttachment(
  ticketId: string,
  file: File,
  requesterId: string
): Promise<AttachmentDto> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: {
      "X-Dev-Requester-Id": requesterId,
    },
    body: formData,
  });

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Unable to upload Attachment";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const data: AttachmentDto = await res.json();
  return data;
}

export async function fetchAttachmentMetadata(
  ticketId: string,
  attachmentId: string,
  requesterId: string
): Promise<AttachmentDto> {
  const res = await fetch(
    `${API_URL}/api/v1/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      headers: {
        "X-Dev-Requester-Id": requesterId,
      },
    }
  );

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Attachment not found or inaccessible";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const data: AttachmentDto = await res.json();
  return data;
}

export async function downloadAttachment(
  ticketId: string,
  attachmentId: string,
  requesterId: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/tickets/${ticketId}/attachments/${attachmentId}/download`,
    {
      headers: {
        "X-Dev-Requester-Id": requesterId,
      },
    }
  );

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Unable to download Attachment";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const blob = await res.blob();
  if (typeof window !== "undefined" && window.URL && window.URL.createObjectURL) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = "attachment";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^"';]+)['"]?/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
}

export async function softRemoveAttachment(
  ticketId: string,
  attachmentId: string,
  payload: SoftRemoveAttachmentPayload,
  requesterId: string
): Promise<SoftRemovedAttachmentDto> {
  const res = await fetch(
    `${API_URL}/api/v1/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Dev-Requester-Id": requesterId,
      },
      body: JSON.stringify({ reason: payload.reason }),
    }
  );

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Ignored if response is non-JSON
    }

    const message = errorData?.error?.message ?? "Unable to remove Attachment";
    const error = new Error(message);
    (error as any).code = errorData?.error?.code;
    throw error;
  }

  const data: SoftRemovedAttachmentDto = await res.json();
  return data;
}
