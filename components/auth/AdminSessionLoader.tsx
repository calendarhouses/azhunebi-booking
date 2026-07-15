import { AdminPreloader } from "@/components/admin/AdminPreloader";
import { ADMIN_PRELOADER_LOGO_SRC } from "@/lib/admin/adminPreloaderLogo";

export function AdminSessionLoader() {
  return <AdminPreloader visible logoUrl={ADMIN_PRELOADER_LOGO_SRC} />;
}
