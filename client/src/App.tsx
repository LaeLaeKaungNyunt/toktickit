import { useState } from "react";
import { checkSystem, Category } from "./api.js";
import { RequesterProvider } from "./context/RequesterContext.js";
import RequesterSelector from "./components/RequesterSelector.js";
import CreateTicketForm from "./components/CreateTicketForm.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export function AppContent() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);

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
    <div className="container py-5" style={{ maxWidth: 680 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span style={{ color: "#006B3C" }}>IT Service Desk</span>
      </h1>

      <RequesterSelector />

      <CreateTicketForm />

      <div className="mt-4 border-top pt-4">
        <button
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
