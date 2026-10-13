import { useState, useRef } from "react";
import { checkSystem, Category } from "./api.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import CreateTicketForm from "./components/CreateTicketForm.js";
import MyTickets from "./components/MyTickets.js";
import TicketDetail from "./components/TicketDetail.js";
import Login from "./components/Login.js";
import ChangePassword from "./components/ChangePassword.js";
import { StaffTicketQueue, StaffQueueFilters } from "./components/StaffTicketQueue.js";
import { StaffTicketDetail } from "./components/StaffTicketDetail.js";
import { UserManagement } from "./components/UserManagement.js";
import { StaffDashboard } from "./components/StaffDashboard.js";
import { RequesterDashboard } from "./components/RequesterDashboard.js";

type UiState = "idle" | "loading" | "success" | "error";
type TabState = "dashboard" | "create" | "list";
type StaffTabState = "dashboard" | "queue" | "users";

export function AppContent() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabState>("dashboard");
  const [staffTab, setStaffTab] = useState<StaffTabState>("dashboard");
  const [queueFilters, setQueueFilters] = useState<StaffQueueFilters | undefined>(undefined);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  // Synchronously reset selected ticket detail on user change
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  if (prevUserIdRef.current !== user?.id) {
    prevUserIdRef.current = user?.id;
    setSelectedTicketId(null);
    setActiveTab("dashboard");
    setStaffTab("dashboard");
    setQueueFilters(undefined);
  }

  async function handleCheck() {
    setState("loading");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  if (loading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 840 }}>
        <p className="text-muted">Loading TokTickIT...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-5" style={{ maxWidth: 840 }}>
        <h1 className="h3 mb-4 text-center">
          TokTickIT <span style={{ color: "#006B3C" }}>IT Service Desk</span>
        </h1>
        <Login />
      </div>
    );
  }

  if (user.mustChangePassword) {
    return (
      <div className="container py-5" style={{ maxWidth: 840 }}>
        <h1 className="h3 mb-4 text-center">
          TokTickIT <span style={{ color: "#006B3C" }}>IT Service Desk</span>
        </h1>
        <ChangePassword />
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 960 }}>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1 className="h3 mb-0">
          TokTickIT <span style={{ color: "#006B3C" }}>IT Service Desk</span>
        </h1>
        <div className="d-flex align-items-center gap-3">
          <div className="text-end">
            <span className="fw-bold d-block">{user.name}</span>
            <span className="badge bg-secondary">{user.role}</span>
          </div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>

      {user.role === "Requester" ? (
        <>
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === "dashboard" ? "active fw-bold" : ""}`}
                style={activeTab === "dashboard" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setActiveTab("dashboard");
                  setSelectedTicketId(null);
                }}
              >
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === "create" ? "active fw-bold" : ""}`}
                style={activeTab === "create" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setActiveTab("create");
                  setSelectedTicketId(null);
                }}
              >
                Create Ticket
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === "list" ? "active fw-bold" : ""}`}
                style={activeTab === "list" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setActiveTab("list");
                  setSelectedTicketId(null);
                }}
              >
                My Tickets
              </button>
            </li>
          </ul>

          {selectedTicketId ? (
            <TicketDetail
              ticketId={selectedTicketId}
              onBack={() => setSelectedTicketId(null)}
            />
          ) : (
            <>
              {activeTab === "dashboard" && (
                <RequesterDashboard
                  onNavigateToMyTickets={() => {
                    setActiveTab("list");
                    setSelectedTicketId(null);
                  }}
                  onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
                />
              )}

              {activeTab === "create" && <CreateTicketForm />}

              {activeTab === "list" && (
                <MyTickets
                  onNavigateToCreateTicket={() => {
                    setActiveTab("create");
                    setSelectedTicketId(null);
                  }}
                  onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
                />
              )}
            </>
          )}
        </>
      ) : user.role === "IT Staff" ? (
        <>
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${staffTab === "dashboard" ? "active fw-bold" : ""}`}
                style={staffTab === "dashboard" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setStaffTab("dashboard");
                  setSelectedTicketId(null);
                }}
              >
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${staffTab === "queue" ? "active fw-bold" : ""}`}
                style={staffTab === "queue" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setStaffTab("queue");
                  setSelectedTicketId(null);
                  setQueueFilters(undefined);
                }}
              >
                Queue
              </button>
            </li>
          </ul>

          {staffTab === "dashboard" && (
            <StaffDashboard
              onNavigateToQueue={(filters) => {
                setQueueFilters(filters);
                setSelectedTicketId(null);
                setStaffTab("queue");
              }}
              onSelectTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setStaffTab("queue");
              }}
            />
          )}

          {staffTab === "queue" && (
            selectedTicketId ? (
              <StaffTicketDetail
                ticketId={selectedTicketId}
                onBack={() => setSelectedTicketId(null)}
              />
            ) : (
              <StaffTicketQueue
                initialFilters={queueFilters}
                onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
              />
            )
          )}
        </>
      ) : user.role === "Administrator" ? (
        <>
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${staffTab === "dashboard" ? "active fw-bold" : ""}`}
                style={staffTab === "dashboard" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setStaffTab("dashboard");
                  setSelectedTicketId(null);
                }}
              >
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${staffTab === "queue" ? "active fw-bold" : ""}`}
                style={staffTab === "queue" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setStaffTab("queue");
                  setSelectedTicketId(null);
                  setQueueFilters(undefined);
                }}
              >
                Queue
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${staffTab === "users" ? "active fw-bold" : ""}`}
                style={staffTab === "users" ? { color: "#006B3C" } : {}}
                onClick={() => {
                  setStaffTab("users");
                  setSelectedTicketId(null);
                }}
              >
                User Management
              </button>
            </li>
          </ul>

          {staffTab === "dashboard" && (
            <StaffDashboard
              onNavigateToQueue={(filters) => {
                setQueueFilters(filters);
                setSelectedTicketId(null);
                setStaffTab("queue");
              }}
              onSelectTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setStaffTab("queue");
              }}
            />
          )}

          {staffTab === "queue" && (
            selectedTicketId ? (
              <StaffTicketDetail
                ticketId={selectedTicketId}
                onBack={() => setSelectedTicketId(null)}
              />
            ) : (
              <StaffTicketQueue
                initialFilters={queueFilters}
                onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
              />
            )
          )}

          {staffTab === "users" && <UserManagement />}
        </>
      ) : (
        <div className="card mb-4 border shadow-sm">
          <div className="card-body py-4 text-center">
            <h2 className="h5 fw-bold mb-2">Welcome, {user.name}</h2>
            <p className="text-muted mb-0">
              You are logged in with the <strong>{user.role}</strong> role. Dashboard features for {user.role}s will be available in upcoming increments.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 border-top pt-4">
        <button
          type="button"
          className="btn text-white"
          style={{ backgroundColor: "#006B3C" }}
          onClick={handleCheck}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Loading…" : "Check System"}
        </button>

        {state === "success" && (
          <div className="mt-3">
            <p>System Status: Online</p>

            <h2 className="h5">Supported Request Categories</h2>

            <ol>
              {categories.map((category) => (
                <li key={category.id}>{category.name}</li>
              ))}
            </ol>
          </div>
        )}

        {state === "error" && (
          <div className="mt-3">
            <p>System Status: Offline</p>
            <p>Unable to connect to TokTickIT API</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
