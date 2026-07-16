"use client";

import { createContext, useContext, useEffect } from "react";

const MobileUiContext = createContext(false);

const BODY_CLASS = "boso-admin-mobile-active";

export function MobileUiProvider({
  children,
  value = true,
}: {
  children: React.ReactNode;
  value?: boolean;
}) {
  useEffect(() => {
    if (!value || typeof document === "undefined") return;
    document.body.classList.add(BODY_CLASS);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [value]);

  return <MobileUiContext.Provider value={value}>{children}</MobileUiContext.Provider>;
}

export function useMobileUi() {
  return useContext(MobileUiContext);
}
