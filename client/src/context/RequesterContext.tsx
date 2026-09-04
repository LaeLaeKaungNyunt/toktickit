import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { DevelopmentRequester } from "../types/lab02.js";

interface RequesterContextType {
  selectedRequester: DevelopmentRequester | null;
  setSelectedRequester: (requester: DevelopmentRequester | null) => void;
  changeRequester: () => void;
  getRequesterHeaders: () => Record<string, string>;
}

const RequesterContext = createContext<RequesterContextType | undefined>(
  undefined
);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [selectedRequester, setSelectedRequester] =
    useState<DevelopmentRequester | null>(null);

  function changeRequester() {
    setSelectedRequester(null);
  }

  function getRequesterHeaders(): Record<string, string> {
    if (!selectedRequester) return {};
    return {
      "X-Dev-Requester-Id": selectedRequester.id,
    };
  }

  return (
    <RequesterContext.Provider
      value={{
        selectedRequester,
        setSelectedRequester,
        changeRequester,
        getRequesterHeaders,
      }}
    >
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester(): RequesterContextType {
  const context = useContext(RequesterContext);
  if (!context) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return context;
}
