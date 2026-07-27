"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AdminAuthGate } from "@/components/auth/AdminAuthGate";
import { AdminBootProvider } from "@/components/admin/AdminBootContext";
import { AdminBootPreloader } from "@/components/admin/AdminBootPreloader";
import { BrandFavicon } from "@/components/ui/BrandFavicon";
import { useAuth } from "@/components/auth/AuthProvider";

function AdminBrandFavicon() {
  const { preloaderLogoUrl } = useAuth();
  return <BrandFavicon logoUrl={preloaderLogoUrl} />;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminBootProvider>
        <AdminBrandFavicon />
        <AdminBootPreloader />
        <AdminAuthGate>{children}</AdminAuthGate>
      </AdminBootProvider>
    </AuthProvider>
  );
}
