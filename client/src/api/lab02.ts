import {
  DevelopmentRequester,
  CategoryV1,
  RelatedSystem,
  ApiItemsResponse,
  CreateTicketPayload,
  CreatedTicketDto,
  ApiErrorResponse,
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
