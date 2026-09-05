import { useState, useEffect, useRef } from "react";
import { checkSystem, Category } from "./api.js";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import RequesterSelector from "./components/RequesterSelector.js";
import CreateTicketForm from "./components/CreateTicketForm.js";
import MyTickets from "./components/MyTickets.js";
import TicketDetail from "./components/TicketDetail.js";

type UiState = "idle" | "loading" | "success" | "error";
type TabState = "create" | "list";

export function AppContent() {
  const { selectedRequester } = useRequester();
  const [activeTab, setActiveTab] = useState<TabState>("create");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

  // Synchronously reset selected ticket detail on requester change (AC-03, BR-06)
  const prevRequesterIdRef = useRef<string | undefined>(selectedRequester?.id);
  if (prevRequesterIdRef.current !== selectedRequester?.id) {
    prevRequesterIdRef.current = selectedRequester?.id;
    setSelectedTicketId(null);
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

  return (
    <div className="container py-5" style={{ maxWidth: 840 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span style={{ color: "#006B3C" }}>IT Service Desk</span>
      </h1>

      <RequesterSelector />

      {selectedRequester && (
        <ul className="nav nav-tabs mb-4">
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
      )}

      {(!selectedRequester || activeTab === "create") && <CreateTicketForm />}

      {selectedRequester && activeTab === "list" && (
        selectedTicketId ? (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => setSelectedTicketId(null)}
          />
        ) : (
          <MyTickets
            onNavigateToCreateTicket={() => {
              setActiveTab("create");
              setSelectedTicketId(null);
            }}
            onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
          />
        )
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
    <RequesterProvider>
      <AppContent />
    </RequesterProvider>
  );
}
