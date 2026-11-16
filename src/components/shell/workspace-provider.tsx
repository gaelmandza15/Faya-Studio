"use client";

import { createContext, useContext, useMemo } from "react";
import type { WorkspaceData } from "@/lib/types";

const WorkspaceContext = createContext<WorkspaceData | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceData;
  children: React.ReactNode;
}) {
  const memoized = useMemo(() => value, [value]);

  return (
    <WorkspaceContext.Provider value={memoized}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceData {
  const value = useContext(WorkspaceContext);

  if (!value) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }

  return value;
}
