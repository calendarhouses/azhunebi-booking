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

export type AdminBootReport = {
  isLoading: boolean;
  appVisible: boolean;
  loadError: string | null;
  logoUrl: string | null;
};

const idleBootReport: AdminBootReport = {
  isLoading: false,
  appVisible: false,
  loadError: null,
  logoUrl: null,
};

const initialBootReport: AdminBootReport = {
  isLoading: true,
  appVisible: false,
  loadError: null,
  logoUrl: null,
};

type AdminBootContextValue = {
  report: AdminBootReport;
  setReport: (patch: Partial<AdminBootReport>) => void;
};

const AdminBootContext = createContext<AdminBootContextValue | null>(null);

export function AdminBootProvider({ children }: { children: ReactNode }) {
  const [report, setReportState] = useState<AdminBootReport>(initialBootReport);

  const setReport = useCallback((patch: Partial<AdminBootReport>) => {
    setReportState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ report, setReport }), [report, setReport]);

  return <AdminBootContext.Provider value={value}>{children}</AdminBootContext.Provider>;
}

export function useAdminBootState(): AdminBootReport {
  return useContext(AdminBootContext)?.report ?? initialBootReport;
}

export function useAdminBootReport(state: AdminBootReport) {
  const setReport = useContext(AdminBootContext)?.setReport;

  useEffect(() => {
    if (!setReport) return;
    setReport(state);
    return () => {
      setReport(idleBootReport);
    };
  }, [
    setReport,
    state.isLoading,
    state.appVisible,
    state.loadError,
    state.logoUrl,
  ]);
}
