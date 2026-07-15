export const ADMIN_DOCUMENT_TITLE_SUFFIX = "Панель Управління";

export function formatAdminDocumentTitle(siteTitle?: string | null): string {
  const name = String(siteTitle || "").trim();
  if (!name) return ADMIN_DOCUMENT_TITLE_SUFFIX;
  return `${name} | ${ADMIN_DOCUMENT_TITLE_SUFFIX}`;
}

export function applyAdminDocumentTitle(siteTitle?: string | null): void {
  if (typeof document === "undefined") return;
  const title = formatAdminDocumentTitle(siteTitle);
  document.title = title;

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) {
    appleTitle.setAttribute("content", String(siteTitle || "").trim() || ADMIN_DOCUMENT_TITLE_SUFFIX);
  }
}
