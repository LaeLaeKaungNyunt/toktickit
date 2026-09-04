export interface DevelopmentRequester {
  id: string;
  displayName: string;
  email: string;
}

export interface CategoryV1 {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: string;
  name: string;
}

export interface ApiItemsResponse<T> {
  items: T[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
