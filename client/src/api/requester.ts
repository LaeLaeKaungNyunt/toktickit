import { RequesterDashboardResponse } from "../types/requester";

const API_BASE = "http://localhost:3000/api/v1";

export async function fetchRequesterDashboard(token: string): Promise<RequesterDashboardResponse> {
  const url = `${API_BASE}/dashboard/requester`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch requester dashboard (${res.status})`);
  }

  return res.json();
}
