export interface RequesterDashboardMetrics {
  myActiveTickets: number;
  waitingForMe: number;
  resolvedTicketsCount: number;
  totalTicketsCount: number;
  statusCounts: Record<string, number>;
}

export interface RequesterWaitingTicketDto {
  id: string;
  ticketNumber: string;
  summary: string;
  status: string;
  updatedAt: string;
}

export interface RequesterResolvedTicketDto {
  id: string;
  ticketNumber: string;
  summary: string;
  status: string;
  resolutionSummary: string | null;
  resolvedAt: string;
  updatedAt: string;
}

export interface RequesterRecentTicketDto {
  id: string;
  ticketNumber: string;
  summary: string;
  status: string;
  updatedAt: string;
}

export interface RequesterDashboardResponse {
  metrics: RequesterDashboardMetrics;
  waitingForMeTickets: RequesterWaitingTicketDto[];
  recentlyResolvedTickets: RequesterResolvedTicketDto[];
  recentTickets: RequesterRecentTicketDto[];
}
