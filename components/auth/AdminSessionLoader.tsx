import { AdminLogo } from "@/components/admin/desktop/AdminLogo";
import "./admin-session-loader.css";

export function AdminSessionLoader() {
  return (
    <div className="admin-session-loader" role="status" aria-label="Завантаження">
      <div className="admin-session-loader__pulse">
        <AdminLogo variant="preloader" />
      </div>
    </div>
  );
}
