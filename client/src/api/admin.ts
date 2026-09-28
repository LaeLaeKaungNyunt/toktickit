const API_BASE = "http://localhost:3000/api/v1";

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: "Requester" | "IT Staff" | "Administrator";
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AdminUsersResponse {
  users: AdminUserDto[];
}

export interface CreateAdminUserParams {
  name: string;
  email: string;
  role: string;
  initialPassword: string;
  isActive?: boolean;
}

export interface UpdateAdminUserParams {
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
}

export async function fetchAdminUsers(
  token: string,
  search?: string,
  role?: string
): Promise<AdminUsersResponse> {
  const query = new URLSearchParams();
  if (search) query.append("search", search);
  if (role) query.append("role", role);

  const queryString = query.toString();
  const url = `${API_BASE}/admin/users${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch users (${res.status})`);
  }

  return res.json();
}

export async function createAdminUser(
  token: string,
  data: CreateAdminUserParams
): Promise<{ user: AdminUserDto }> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create user (${res.status})`);
  }

  return res.json();
}

export async function updateAdminUser(
  token: string,
  userId: string,
  data: UpdateAdminUserParams
): Promise<{ user: AdminUserDto }> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update user (${res.status})`);
  }

  return res.json();
}

export async function resetUserPassword(
  token: string,
  userId: string,
  initialPassword: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ initialPassword }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to reset user password (${res.status})`);
  }
}
