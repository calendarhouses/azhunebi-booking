"use client";

import { useEffect } from "react";
import { applyAdminDocumentTitle } from "@/lib/admin/adminDocumentTitle";

export function AdminDocumentTitleSync({
  siteTitle,
  enabled = true,
}: {
  siteTitle?: string | null;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    applyAdminDocumentTitle(siteTitle);
  }, [siteTitle, enabled]);

  return null;
}
