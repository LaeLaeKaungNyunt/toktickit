import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.js";
import {
  AdminUserDto,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetUserPassword,
} from "../api/admin.js";

export function UserManagement() {
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUserDto | null>(null);

  // Form States — Create
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState("Requester");
  const [createPassword, setCreatePassword] = useState("");
  const [createIsActive, setCreateIsActive] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  // Form States — Edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("Requester");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // Form States — Reset Password
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(token, search, roleFilter);
      setUsers(data.users);
    } catch (err: any) {
      setError(err.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, [token, search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle Create Submit
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!createName.trim()) {
      setCreateError("Name is required.");
      return;
    }

    if (!createEmail.trim() || !createEmail.includes("@")) {
      setCreateError("A valid email address is required.");
      return;
    }

    if (!createPassword || createPassword.length < 8) {
      setCreateError("Initial password must be at least 8 characters long.");
      return;
    }

    setCreateBusy(true);
    try {
      await createAdminUser(token!, {
        name: createName.trim(),
        email: createEmail.trim(),
        role: createRole,
        initialPassword: createPassword,
        isActive: createIsActive,
      });

      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreateRole("Requester");
      setCreatePassword("");
      setCreateIsActive(true);
      setSuccessMsg("User created successfully. The user must change their password at first login.");
      await loadUsers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user");
    } finally {
      setCreateBusy(false);
    }
  }

  // Open Edit Modal
  function openEditModal(target: AdminUserDto) {
    setEditingUser(target);
    setEditName(target.name);
    setEditEmail(target.email);
    setEditRole(target.role);
    setEditIsActive(target.isActive);
    setEditError(null);
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError("Name is required.");
      return;
    }

    if (!editEmail.trim() || !editEmail.includes("@")) {
      setEditError("A valid email address is required.");
      return;
    }

    // Client-side self-deactivation warning check
    if (editingUser.id === currentUser?.id && !editIsActive) {
      setEditError("An Administrator cannot deactivate their own account.");
      return;
    }

    setEditBusy(true);
    try {
      await updateAdminUser(token!, editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        isActive: editIsActive,
      });

      setEditingUser(null);
      setSuccessMsg(`User ${editName.trim()} updated successfully.`);
      await loadUsers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update user");
    } finally {
      setEditBusy(false);
    }
  }

  // Open Reset Password Modal
  function openResetModal(target: AdminUserDto) {
    setResettingUser(target);
    setResetPasswordVal("");
    setResetError(null);
  }

  // Handle Reset Password Submit
  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingUser) return;
    setResetError(null);

    if (!resetPasswordVal || resetPasswordVal.length < 8) {
      setResetError("Initial password must be at least 8 characters long.");
      return;
    }

    setResetBusy(true);
    try {
      await resetUserPassword(token!, resettingUser.id, resetPasswordVal);
      setResettingUser(null);
      setSuccessMsg(`Password reset for ${resettingUser.name}. User must change password at next login.`);
      await loadUsers();
    } catch (err: any) {
      setResetError(err.message || "Failed to reset user password");
    } finally {
      setResetBusy(false);
    }
  }

  if (currentUser?.role !== "Administrator") {
    return (
      <div className="alert alert-danger my-4" role="alert">
        Forbidden: You do not have permission to access User Management.
      </div>
    );
  }

  const hasActiveFilters = Boolean(search.trim() || roleFilter);

  return (
    <div className="user-management">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="h4 mb-1">User Management</h2>
          <p className="text-muted small mb-0">Create, view, and maintain user accounts and permissions.</p>
        </div>
        <div>
          <button
            type="button"
            className="btn text-white"
            style={{ backgroundColor: "#006B3C" }}
            onClick={() => {
              setIsCreateOpen(true);
              setCreateError(null);
              setCreateName("");
              setCreateEmail("");
              setCreateRole("Requester");
              setCreatePassword("");
              setCreateIsActive(true);
            }}
          >
            + Create User
          </button>
        </div>
      </div>

      {/* Inline Global Success Alert */}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          {successMsg}
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setSuccessMsg(null)}
          ></button>
        </div>
      )}

      {/* Inline Global Error Alert */}
      {error && (
        <div className="alert alert-danger mb-4 d-flex justify-content-between align-items-center" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadUsers}>
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="card mb-4 border shadow-sm">
        <div className="card-body p-3">
          <div className="row g-3">
            <div className="col-12 col-md-8">
              <label htmlFor="user-search-input" className="form-label small text-muted mb-1">
                Search Users
              </label>
              <input
                id="user-search-input"
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4">
              <label htmlFor="user-role-filter" className="form-label small text-muted mb-1">
                Role Filter
              </label>
              <select
                id="user-role-filter"
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="Requester">Requester</option>
                <option value="IT Staff">IT Staff</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="text-center py-5 text-muted card border shadow-sm">
          <div className="spinner-border text-success mb-2" role="status"></div>
          <p className="mb-0">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-5 border shadow-sm">
          <div className="card-body text-muted">
            <p className="fw-bold mb-1">
              {hasActiveFilters ? "No users match the search or filter criteria." : "No users found."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none"
                style={{ color: "#006B3C" }}
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                }}
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table Presentation */}
          <div className="table-responsive d-none d-md-block card border shadow-sm mb-4">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="badge bg-info text-dark ms-2">You</span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === "Administrator"
                            ? "bg-dark"
                            : u.role === "IT Staff"
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.isActive ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-danger">Inactive</span>
                      )}
                      {u.mustChangePassword && (
                        <span className="badge bg-warning text-dark ms-1" title="Password change required at next login">
                          Pwd Reset
                        </span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => openEditModal(u)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-warning text-dark"
                          onClick={() => openResetModal(u)}
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Presentation */}
          <div className="d-md-none d-flex flex-column gap-3 mb-4">
            {users.map((u) => (
              <div key={u.id} className="card border shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h3 className="h6 fw-bold mb-0">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="badge bg-info text-dark ms-1">You</span>
                        )}
                      </h3>
                      <span className="text-muted small">{u.email}</span>
                    </div>
                    {u.isActive ? (
                      <span className="badge bg-success">Active</span>
                    ) : (
                      <span className="badge bg-danger">Inactive</span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span
                      className={`badge ${
                        u.role === "Administrator"
                          ? "bg-dark"
                          : u.role === "IT Staff"
                          ? "bg-primary"
                          : "bg-secondary"
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.mustChangePassword && (
                      <span className="badge bg-warning text-dark">Pwd Reset Required</span>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm flex-fill"
                      onClick={() => openEditModal(u)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-warning text-dark btn-sm flex-fill"
                      onClick={() => openResetModal(u)}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title h5">Create New User</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createBusy}
                ></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  {createError && <div className="alert alert-danger small mb-3">{createError}</div>}

                  <div className="mb-3">
                    <label htmlFor="create-user-name" className="form-label small fw-bold">
                      Full Name *
                    </label>
                    <input
                      id="create-user-name"
                      type="text"
                      className="form-control"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-user-email" className="form-label small fw-bold">
                      Email Address *
                    </label>
                    <input
                      id="create-user-email"
                      type="email"
                      className="form-control"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="e.g. jane.doe@university.edu"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-user-role" className="form-label small fw-bold">
                      Role *
                    </label>
                    <select
                      id="create-user-role"
                      className="form-select"
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value)}
                    >
                      <option value="Requester">Requester</option>
                      <option value="IT Staff">IT Staff</option>
                      <option value="Administrator">Administrator</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="create-user-password" className="form-label small fw-bold">
                      Initial Password *
                    </label>
                    <input
                      id="create-user-password"
                      type="password"
                      className="form-control"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                    />
                    <div className="form-text small">User will be required to change this password at first login.</div>
                  </div>

                  <div className="form-check mb-2">
                    <input
                      id="create-user-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={createIsActive}
                      onChange={(e) => setCreateIsActive(e.target.checked)}
                    />
                    <label htmlFor="create-user-active" className="form-check-label small">
                      Active Account
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={createBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white"
                    style={{ backgroundColor: "#006B3C" }}
                    disabled={createBusy}
                  >
                    {createBusy ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title h5">Edit User: {editingUser.name}</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setEditingUser(null)}
                  disabled={editBusy}
                ></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  {editError && <div className="alert alert-danger small mb-3">{editError}</div>}

                  <div className="mb-3">
                    <label htmlFor="edit-user-name" className="form-label small fw-bold">
                      Full Name *
                    </label>
                    <input
                      id="edit-user-name"
                      type="text"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="edit-user-email" className="form-label small fw-bold">
                      Email Address *
                    </label>
                    <input
                      id="edit-user-email"
                      type="email"
                      className="form-control"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="edit-user-role" className="form-label small fw-bold">
                      Role *
                    </label>
                    <select
                      id="edit-user-role"
                      className="form-select"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                    >
                      <option value="Requester">Requester</option>
                      <option value="IT Staff">IT Staff</option>
                      <option value="Administrator">Administrator</option>
                    </select>
                  </div>

                  <div className="form-check mb-2">
                    <input
                      id="edit-user-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      disabled={editingUser.id === currentUser?.id}
                    />
                    <label htmlFor="edit-user-active" className="form-check-label small">
                      Active Account
                    </label>
                    {editingUser.id === currentUser?.id && (
                      <div className="form-text text-warning small">You cannot deactivate your own account.</div>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingUser(null)}
                    disabled={editBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white"
                    style={{ backgroundColor: "#006B3C" }}
                    disabled={editBusy}
                  >
                    {editBusy ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title h5">Reset Password: {resettingUser.name}</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setResettingUser(null)}
                  disabled={resetBusy}
                ></button>
              </div>
              <form onSubmit={handleResetSubmit}>
                <div className="modal-body">
                  {resetError && <div className="alert alert-danger small mb-3">{resetError}</div>}

                  <p className="small text-muted mb-3">
                    Target account: <strong>{resettingUser.email}</strong>
                  </p>

                  <div className="mb-3">
                    <label htmlFor="reset-password-input" className="form-label small fw-bold">
                      New Initial Password *
                    </label>
                    <input
                      id="reset-password-input"
                      type="password"
                      className="form-control"
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                    />
                    <div className="form-text small">
                      The user will be required to change this password at their next login.
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setResettingUser(null)}
                    disabled={resetBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning text-dark fw-semibold"
                    disabled={resetBusy}
                  >
                    {resetBusy ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
