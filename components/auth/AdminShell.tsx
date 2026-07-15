"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";
import { AdminBootProvider } from "@/components/admin/AdminBootContext";
import { AdminBootPreloader } from "@/components/admin/AdminBootPreloader";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminBootProvider>
        <AdminBootPreloader />
        <AdminAuthGate>{children}</AdminAuthGate>
      </AdminBootProvider>
    </AuthProvider>
  );
}
