import "@/components/admin/admin-tokens.css";
import "@/components/admin/desktop/admin-desktop.css";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="boso-admin-page">
      <AdminDashboard />
    </div>
  );
}
