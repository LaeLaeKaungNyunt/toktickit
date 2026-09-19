import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserManagement } from "../../src/components/UserManagement";
import * as adminApi from "../../src/api/admin";
import * as authContext from "../../src/context/AuthContext";

vi.mock("../../src/api/admin");

const mockAdminUser = {
  id: "admin-9999",
  name: "Admin User",
  email: "admin@university.edu",
  role: "Administrator" as const,
  mustChangePassword: false,
};

const mockUserList: adminApi.AdminUserDto[] = [
  {
    id: "admin-9999",
    name: "Admin User",
    email: "admin@university.edu",
    role: "Administrator",
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: "user-0001",
    name: "Alice Smith",
    email: "alice.smith@university.edu",
    role: "Requester",
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: "user-0002",
    name: "Sam Staff",
    email: "staff1@university.edu",
    role: "IT Staff",
    isActive: true,
    mustChangePassword: false,
  },
];

describe("UserManagement Component (Issue #27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: mockAdminUser,
      token: "mock-admin-token",
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      clearError: vi.fn(),
    });

    vi.mocked(adminApi.fetchAdminUsers).mockResolvedValue({
      users: mockUserList,
    });
  });

  it("1. Renders user management header and user list for Administrator", async () => {
    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "User Management" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    expect(screen.getAllByText("alice.smith@university.edu").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sam Staff").length).toBeGreaterThan(0);
  });

  it("2. Filters user list by role", async () => {
    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    });

    const roleSelect = screen.getByLabelText("Role Filter");
    fireEvent.change(roleSelect, { target: { value: "IT Staff" } });

    await waitFor(() => {
      expect(adminApi.fetchAdminUsers).toHaveBeenCalledWith("mock-admin-token", "", "IT Staff");
    });
  });

  it("3. Displays no-results state when search returns no matching users", async () => {
    vi.mocked(adminApi.fetchAdminUsers).mockImplementation(async (_token, search) => {
      if (search === "NonExistentName") return { users: [] };
      return { users: mockUserList };
    });

    render(<UserManagement />);

    const searchInput = screen.getByPlaceholderText("Search by name or email...");
    fireEvent.change(searchInput, { target: { value: "NonExistentName" } });

    await waitFor(() => {
      expect(screen.getByText("No users match the search or filter criteria.")).toBeInTheDocument();
    });
  });

  it("4. Create User modal validates required inputs and submits successfully", async () => {
    vi.mocked(adminApi.createAdminUser).mockResolvedValueOnce({
      user: {
        id: "new-001",
        name: "Jane Doe",
        email: "jane.doe@university.edu",
        role: "Requester",
        isActive: true,
        mustChangePassword: true,
      },
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Create User" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Create User" }));

    expect(screen.getByRole("heading", { name: "Create New User" })).toBeInTheDocument();

    const modal = screen.getByText("Create New User").closest(".modal-content")!;
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Full Name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Email Address/i), { target: { value: "jane.doe@university.edu" } });
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Initial Password/i), { target: { value: "Password123!" } });

    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "Create User" }));

    await waitFor(() => {
      expect(adminApi.createAdminUser).toHaveBeenCalledWith("mock-admin-token", {
        name: "Jane Doe",
        email: "jane.doe@university.edu",
        role: "Requester",
        initialPassword: "Password123!",
        isActive: true,
      });
    });
  });

  it("5. Handles duplicate email error gracefully during user creation", async () => {
    vi.mocked(adminApi.createAdminUser).mockRejectedValueOnce(
      new Error("User with this email already exists")
    );

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Create User" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Create User" }));

    const modal = screen.getByText("Create New User").closest(".modal-content")!;
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Full Name/i), { target: { value: "Duplicate User" } });
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Email Address/i), { target: { value: "alice.smith@university.edu" } });
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Initial Password/i), { target: { value: "Password123!" } });

    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "Create User" }));

    await waitFor(() => {
      expect(screen.getByText("User with this email already exists")).toBeInTheDocument();
    });
  });

  it("6. Edit User modal submits updated information and shows self-deactivation warning", async () => {
    vi.mocked(adminApi.updateAdminUser).mockResolvedValueOnce({
      user: {
        id: "user-0001",
        name: "Alice Smith Updated",
        email: "alice.smith@university.edu",
        role: "IT Staff",
        isActive: true,
        mustChangePassword: false,
      },
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    });

    const editBtns = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editBtns[0]); // Click first edit button

    const modalHeading = await screen.findByRole("heading", { name: /Edit User:/i });
    expect(modalHeading).toBeInTheDocument();

    const modal = modalHeading.closest(".modal-content")!;
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Full Name/i), { target: { value: "Alice Smith Updated" } });
    fireEvent.change(within(modal as HTMLElement).getByLabelText(/Role/i), { target: { value: "IT Staff" } });

    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(adminApi.updateAdminUser).toHaveBeenCalled();
    });
  });

  it("7. Reset Password modal validates min length and submits", async () => {
    vi.mocked(adminApi.resetUserPassword).mockResolvedValueOnce();

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    });

    const resetBtns = screen.getAllByRole("button", { name: "Reset Password" });
    fireEvent.click(resetBtns[0]); // Click first Reset Password button

    const modalHeading = await screen.findByRole("heading", { name: /Reset Password:/i });
    expect(modalHeading).toBeInTheDocument();

    const modal = modalHeading.closest(".modal-content")!;
    const passInput = within(modal as HTMLElement).getByPlaceholderText("At least 8 characters");
    fireEvent.change(passInput, { target: { value: "NewResetPass123!" } });

    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "Reset Password" }));

    await waitFor(() => {
      expect(adminApi.resetUserPassword).toHaveBeenCalledWith("mock-admin-token", expect.any(String), "NewResetPass123!");
    });
  });

  it("8. Non-Administrator receives forbidden message", async () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: { id: "req-1", name: "Alice", email: "alice@test.com", role: "Requester", mustChangePassword: false },
      token: "req-token",
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      clearError: vi.fn(),
    });

    render(<UserManagement />);

    expect(screen.getByText(/Forbidden: You do not have permission to access User Management/i)).toBeInTheDocument();
  });
});
