const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "Requester" | "IT Staff" | "Administrator";
  mustChangePassword: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Authentication failed");
  }

  return data;
}

export async function getMeApi(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to retrieve user");
  }

  return data.user;
}

export async function changePasswordApi(
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword, confirmPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to change password");
  }

  return data;
}

export async function logoutApi(token: string): Promise<void> {
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Issue 2 + Issue 4 — call the backend.
export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);

  if (!healthResponse.ok) {
    throw new Error("Backend is unavailable");
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);

  if (!categoriesResponse.ok) {
    throw new Error("Unable to load categories");
  }

  const categories: Category[] = await categoriesResponse.json();

  return {
    online: true,
    categories,
  };
}
