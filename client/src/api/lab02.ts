import {
  DevelopmentRequester,
  CategoryV1,
  RelatedSystem,
  ApiItemsResponse,
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
