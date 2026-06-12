"use client";

import { createContext, useContext } from "react";

const MobileUiContext = createContext(false);

export function MobileUiProvider({
  children,
  value = true,
}: {
  children: React.ReactNode;
  value?: boolean;
}) {
  return <MobileUiContext.Provider value={value}>{children}</MobileUiContext.Provider>;
}

export function useMobileUi() {
  return useContext(MobileUiContext);
}
