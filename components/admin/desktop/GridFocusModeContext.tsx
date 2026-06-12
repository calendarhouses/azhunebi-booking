"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadAdminNav, patchAdminNav } from "@/lib/admin/adminNavPersistence";

type GridFocusModeContextValue = {
  isCompactMode: boolean;
  toggleCompactMode: () => void;
  setCompactMode: (value: boolean) => void;
};

const GridFocusModeContext = createContext<GridFocusModeContextValue | null>(null);

export function GridFocusModeProvider({
  tenantId,
  children,
}: {
  tenantId?: string;
  children: ReactNode;
}) {
  const [isCompactMode, setIsCompactMode] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const saved = loadAdminNav(tenantId);
    if (saved?.gridFocusMode) setIsCompactMode(true);
  }, [tenantId]);

  const persist = useCallback(
    (next: boolean) => {
      if (tenantId) patchAdminNav(tenantId, { gridFocusMode: next });
    },
    [tenantId]
  );

  const toggleCompactMode = useCallback(() => {
    setIsCompactMode((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  const setCompactMode = useCallback(
    (value: boolean) => {
      setIsCompactMode(value);
      persist(value);
    },
    [persist]
  );

  const value = useMemo(
    () => ({ isCompactMode, toggleCompactMode, setCompactMode }),
    [isCompactMode, toggleCompactMode, setCompactMode]
  );

  return (
    <GridFocusModeContext.Provider value={value}>{children}</GridFocusModeContext.Provider>
  );
}

export function useGridFocusMode(): GridFocusModeContextValue {
  const ctx = useContext(GridFocusModeContext);
  if (!ctx) {
    throw new Error("useGridFocusMode must be used within GridFocusModeProvider");
  }
  return ctx;
}

const GRID_FOCUS_MODE_IDLE: GridFocusModeContextValue = {
  isCompactMode: false,
  toggleCompactMode: () => {},
  setCompactMode: () => {},
};

export function useGridFocusModeOptional(): GridFocusModeContextValue {
  return useContext(GridFocusModeContext) ?? GRID_FOCUS_MODE_IDLE;
}
