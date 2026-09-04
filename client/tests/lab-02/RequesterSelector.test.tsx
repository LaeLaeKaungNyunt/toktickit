import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import RequesterSelector from "../../src/components/RequesterSelector.js";
import * as lab02Api from "../../src/api/lab02.js";

const mockRequesters = [
  {
    id: "req-1",
    displayName: "Alice Smith",
    email: "alice.smith@university.edu",
  },
  {
    id: "req-2",
    displayName: "Bob Jones",
    email: "bob.jones@university.edu",
  },
];

function TestAppConsumer() {
  const { selectedRequester } = useRequester();
  return (
    <div>
      <RequesterSelector />
      <div data-testid="current-requester-id">
        {selectedRequester ? selectedRequester.id : "NONE"}
      </div>
    </div>
  );
}

describe("RequesterSelector Component (Issue #12)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state while fetching requesters", () => {
    vi.spyOn(lab02Api, "fetchDevelopmentRequesters").mockReturnValue(
      new Promise(() => {}) // never resolves
    );

    render(
      <RequesterProvider>
        <RequesterSelector />
      </RequesterProvider>
    );

    expect(screen.getByText(/loading requesters/i)).toBeInTheDocument();
  });

  it("renders active requesters in dropdown and allows selection (AC-01)", async () => {
    vi.spyOn(lab02Api, "fetchDevelopmentRequesters").mockResolvedValue(mockRequesters);

    render(
      <RequesterProvider>
        <TestAppConsumer />
      </RequesterProvider>
    );

    expect(await screen.findByText(/select a development requester/i)).toBeInTheDocument();

    const selectEl = screen.getByRole("combobox", { name: /select requester/i });
    expect(selectEl).toBeInTheDocument();
    expect(screen.getByText("Alice Smith (alice.smith@university.edu)")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones (bob.jones@university.edu)")).toBeInTheDocument();

    await userEvent.selectOptions(selectEl, "req-1");
    await userEvent.click(screen.getByRole("button", { name: /confirm selection/i }));

    expect(screen.getByTestId("current-requester-id")).toHaveTextContent("req-1");
    expect(screen.getByText(/alice smith/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change requester/i })).toBeInTheDocument();
  });

  it("clears and reloads requester state when Change Requester is clicked (AC-03)", async () => {
    vi.spyOn(lab02Api, "fetchDevelopmentRequesters").mockResolvedValue(mockRequesters);

    render(
      <RequesterProvider>
        <TestAppConsumer />
      </RequesterProvider>
    );

    const selectEl = await screen.findByRole("combobox", { name: /select requester/i });
    await userEvent.selectOptions(selectEl, "req-2");
    await userEvent.click(screen.getByRole("button", { name: /confirm selection/i }));

    expect(screen.getByTestId("current-requester-id")).toHaveTextContent("req-2");

    const changeBtn = screen.getByRole("button", { name: /change requester/i });
    await userEvent.click(changeBtn);

    expect(screen.getByTestId("current-requester-id")).toHaveTextContent("NONE");
    expect(screen.getByRole("combobox", { name: /select requester/i })).toBeInTheDocument();
  });

  it("displays safe retryable error state when API fails", async () => {
    vi.spyOn(lab02Api, "fetchDevelopmentRequesters")
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(mockRequesters);

    render(
      <RequesterProvider>
        <RequesterSelector />
      </RequesterProvider>
    );

    expect(await screen.findByText(/unable to load development requesters/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retryBtn);

    expect(await screen.findByRole("combobox", { name: /select requester/i })).toBeInTheDocument();
  });
});
