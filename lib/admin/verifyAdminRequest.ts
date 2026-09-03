import { NextResponse } from "next/server";
import { extractBearerToken } from "@/lib/admin/adminDbClient";
import { verifyToken } from "@/lib/db/auth";

function adminUnauthorizedResponse(reason?: string) {
  if (reason) {
    console.warn("[verifyAdminRequest] 401:", reason);
  }
  return NextResponse.json(
    { error: "UNAUTHORIZED", message: "У доступі відмовлено" },
    { status: 401 }
  );
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}

export type VerifiedAdmin = {
  userId: string;
  email: string | undefined;
  name?: string;
  role?: string;
};

/** Перевіряє admin session token (Supabase team sessions). */
export async function verifyAdminRequest(
  request: Request,
  tenantId: string | null
): Promise<VerifiedAdmin | NextResponse> {
  if (isDevelopment() && process.env.ADMIN_SKIP_AUTH === "true") {
    return { userId: "dev", email: "dev@local", name: "dev", role: "owner" };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return adminUnauthorizedResponse("missing Bearer token");
  }

  if (!tenantId) {
    return NextResponse.json(
      { error: "MISSING_TENANT", message: "Потрібен tenant_id" },
      { status: 400 }
    );
  }

  const verified = await verifyToken(token);
  if (!verified.valid || !verified.userId) {
    return adminUnauthorizedResponse("invalid or expired token");
  }

  return {
    userId: verified.userId,
    email: verified.email,
    name: verified.name,
    role: verified.role,
  };
}
