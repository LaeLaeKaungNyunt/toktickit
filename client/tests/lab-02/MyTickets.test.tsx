import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MyTickets from "../../src/components/MyTickets.js";
import { RequesterProvider, useRequester } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api/lab02.js";
import {
  DevelopmentRequester,
  CategoryV1,
  RelatedSystem,
  MyTicketsResponseDto,
} from "../../src/types/lab02.js";

vi.mock("../../src/api/lab02.js");

const mockRequesterA: DevelopmentRequester = {
  id: "req-1111",
  displayName: "Alice Smith",
  email: "alice@university.edu",
};

const mockRequesterB: DevelopmentRequester = {
  id: "req-2222",
  displayName: "Bob Jones",
  email: "bob@university.edu",
};

const mockCategories: CategoryV1[] = [
  { id: 1, name: "General IT Support" },
  { id: 2, name: "Hardware & Equipment" },
];

const mockSystems: RelatedSystem[] = [
  { id: "sys-001", name: "Authentication Portal" },
  { id: "sys-002", name: "Email System" },
];

const mockTicketResponse: MyTicketsResponseDto = {
  items: [
    {
      id: "tkt-id-1",
      ticketNumber: "TKT-2026-00001",
      summary: "Wi-Fi Connection Failure",
      category: { id: 1, name: "General IT Support" },
      relatedSystem: { id: "sys-001", name: "Authentication Portal" },
      requestedPriority: "High",
      currentStatus: "New",
      createdAt: "2026-09-04T10:00:00.000Z",
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
  },
};

const emptyTicketResponse: MyTicketsResponseDto = {
  items: [],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  },
};

function TestWrapper({
  initialRequester = mockRequesterA,
  onNavigateToCreateTicket,
}: {
  initialRequester?: DevelopmentRequester | null;
  onNavigateToCreateTicket?: () => void;
}) {
  const { setSelectedRequester } = useRequester();

  useEffect(() => {
    setSelectedRequester(initialRequester);
  }, [initialRequester?.id]);

  return (
    <div>
      <button
        data-testid="set-requester-a"
        onClick={() => setSelectedRequester(mockRequesterA)}
      >
        Set Requester A
      </button>
      <button
        data-testid="set-requester-b"
        onClick={() => setSelectedRequester(mockRequesterB)}
      >
        Set Requester B
      </button>
      <button
        data-testid="clear-requester"
        onClick={() => setSelectedRequester(null)}
      >
        Clear Requester
      </button>
      <MyTickets onNavigateToCreateTicket={onNavigateToCreateTicket} />
    </div>
  );
}

function renderWithRequester(
  requester: DevelopmentRequester | null = mockRequesterA,
  onNavigateToCreateTicket?: () => void
) {
  return render(
    <RequesterProvider>
      <TestWrapper
        initialRequester={requester}
        onNavigateToCreateTicket={onNavigateToCreateTicket}
      />
    </RequesterProvider>
  );
}

describe("MyTickets Component (Issue #14)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchCategoriesV1).mockResolvedValue(mockCategories);
    vi.mocked(api.fetchRelatedSystems).mockResolvedValue(mockSystems);
    vi.mocked(api.fetchMyTickets).mockResolvedValue(mockTicketResponse);
  });

  describe("Requester Context & Selection Requirements", () => {
    it("displays prompt to select requester if no active requester is set", async () => {
      renderWithRequester(null);
      await waitFor(() => {
        expect(
          screen.getByText(/Please select a Development Requester to view tickets/i)
        ).toBeInTheDocument();
      });
      expect(api.fetchMyTickets).not.toHaveBeenCalled();
    });

    it("AC-12: clears stale ticket data immediately when requester changes", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValueOnce(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      // Prepare delayed promise for Requester B to simulate loading window
      let resolveRequesterB: (val: MyTicketsResponseDto) => void;
      const delayedPromiseB = new Promise<MyTicketsResponseDto>((resolve) => {
        resolveRequesterB = resolve;
      });
      vi.mocked(api.fetchMyTickets).mockReturnValueOnce(delayedPromiseB);

      // Switch to Requester B
      await userEvent.click(screen.getByTestId("set-requester-b"));

      // Stale ticket TKT-2026-00001 must be cleared immediately during loading state
      expect(screen.queryAllByText("TKT-2026-00001")).toHaveLength(0);
      expect(screen.getAllByText(/Loading tickets.../i).length).toBeGreaterThan(0);

      // Resolve Requester B data
      resolveRequesterB!({
        items: [
          {
            id: "tkt-id-2",
            ticketNumber: "TKT-2026-00002",
            summary: "Bob's Printer Issue",
            category: { id: 2, name: "Hardware & Equipment" },
            relatedSystem: { id: "sys-002", name: "Email System" },
            requestedPriority: "Low",
            currentStatus: "New",
            createdAt: "2026-09-04T11:00:00.000Z",
          },
        ],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00002").length).toBeGreaterThan(0);
      });
    });
  });

  describe("AC-11: Populated Ticket List State", () => {
    it("renders ticket list items with all required fields (Ticket Number, Summary, Category, System, Priority, Status, Date)", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValue(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText("Wi-Fi Connection Failure").length).toBeGreaterThan(0);
      expect(screen.getAllByText("General IT Support").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Authentication Portal").length).toBeGreaterThan(0);
      expect(screen.getAllByText("High").length).toBeGreaterThan(0);
      expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    });
  });

  describe("AC-17 vs AC-18: General Empty vs Distinct No-Results States", () => {
    it("AC-17: displays general empty state when requester owns zero tickets overall", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValue(emptyTicketResponse);
      const onNavigateToCreate = vi.fn();

      renderWithRequester(mockRequesterA, onNavigateToCreate);

      await waitFor(() => {
        expect(
          screen.getByText(/You have not submitted any IT support tickets yet/i)
        ).toBeInTheDocument();
      });

      const ctaButton = screen.getByRole("button", { name: /Create a Ticket|Submit Ticket/i });
      expect(ctaButton).toBeInTheDocument();
      fireEvent.click(ctaButton);
      expect(onNavigateToCreate).toHaveBeenCalledTimes(1);
    });

    it("AC-18: displays distinct no-results state with Clear Filters button when search/filter returns zero matches", async () => {
      // 1st call (unfiltered initial check): requester owns 1 ticket overall
      vi.mocked(api.fetchMyTickets).mockResolvedValueOnce(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      // 2nd call (filtered query returns 0 matches)
      vi.mocked(api.fetchMyTickets).mockResolvedValueOnce(emptyTicketResponse);

      // Perform a search query
      const searchInput = screen.getByLabelText(/Search Tickets/i);
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      const searchButton = screen.getByRole("button", { name: /^Search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(
          screen.getByText(/No tickets match your search or filter criteria/i)
        ).toBeInTheDocument();
      });

      // Clear Filters button should be present
      const clearButtons = screen.getAllByRole("button", { name: /Clear Filters|Reset Search/i });
      expect(clearButtons.length).toBeGreaterThan(0);

      // Clicking Clear Filters should reset search and refetch
      vi.mocked(api.fetchMyTickets).mockResolvedValueOnce(mockTicketResponse);
      fireEvent.click(clearButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });
    });
  });

  describe("AC-13: Case-Insensitive Search", () => {
    it("triggers fetchMyTickets with search query parameter and resets page to 1", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValue(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByLabelText(/Search Tickets/i);
      fireEvent.change(searchInput, { target: { value: "printer" } });

      const searchButton = screen.getByRole("button", { name: /^Search$/i });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(api.fetchMyTickets).toHaveBeenLastCalledWith(
          expect.objectContaining({
            search: "printer",
            page: 1,
          }),
          mockRequesterA.id
        );
      });
    });
  });

  describe("AC-14: Filtering", () => {
    it("provides filter controls for status, categoryId, relatedSystemId, requestedPriority and combines them", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValue(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getAllByText("General IT Support").length).toBeGreaterThan(0);
      });

      // Select Category
      const categorySelect = screen.getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: "1" } });

      // Select Priority
      const prioritySelect = screen.getByLabelText(/Requested Priority/i);
      fireEvent.change(prioritySelect, { target: { value: "High" } });

      await waitFor(() => {
        expect(api.fetchMyTickets).toHaveBeenLastCalledWith(
          expect.objectContaining({
            categoryId: 1,
            requestedPriority: "High",
            page: 1,
          }),
          mockRequesterA.id
        );
      });
    });
  });

  describe("AC-15: Sorting Controls", () => {
    it("provides sort controls (sortBy, sortOrder) defaulting to createdAt desc", async () => {
      vi.mocked(api.fetchMyTickets).mockResolvedValue(mockTicketResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(api.fetchMyTickets).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: "createdAt",
            sortOrder: "desc",
          }),
          mockRequesterA.id
        );
      });

      const sortBySelect = screen.getByLabelText(/Sort By/i);
      fireEvent.change(sortBySelect, { target: { value: "requestedPriority" } });

      await waitFor(() => {
        expect(api.fetchMyTickets).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sortBy: "requestedPriority",
            page: 1,
          }),
          mockRequesterA.id
        );
      });
    });
  });

  describe("AC-16: Pagination", () => {
    it("provides accessible Previous/Next controls and handles page navigation", async () => {
      const multiPageResponse: MyTicketsResponseDto = {
        items: [mockTicketResponse.items[0]],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 15,
          totalPages: 2,
        },
      };
      vi.mocked(api.fetchMyTickets).mockResolvedValue(multiPageResponse);

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).not.toBeDisabled();

      const prevButton = screen.getByRole("button", { name: /Previous/i });
      expect(prevButton).toBeDisabled();

      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(api.fetchMyTickets).toHaveBeenLastCalledWith(
          expect.objectContaining({
            page: 2,
          }),
          mockRequesterA.id
        );
      });
    });
  });

  describe("Error Handling & Retry", () => {
    it("displays error message and Retry button when API fails", async () => {
      vi.mocked(api.fetchMyTickets).mockRejectedValueOnce(
        new Error("Unable to retrieve Tickets")
      );

      renderWithRequester(mockRequesterA);

      await waitFor(() => {
        expect(screen.getByText(/Unable to retrieve Tickets/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /Retry/i });
      expect(retryButton).toBeInTheDocument();

      vi.mocked(api.fetchMyTickets).mockResolvedValueOnce(mockTicketResponse);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getAllByText("TKT-2026-00001").length).toBeGreaterThan(0);
      });
    });
  });
});
