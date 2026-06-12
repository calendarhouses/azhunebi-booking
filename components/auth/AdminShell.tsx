"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminAuthGate>{children}</AdminAuthGate>
    </AuthProvider>
  );
}
