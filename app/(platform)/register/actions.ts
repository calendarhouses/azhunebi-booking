"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GAS_AUTH_TOKEN_KEY, registerAccount } from "@/lib/gas-api";

export type RegisterActionState = {
  error: string | null;
};

function cleanEmail(v: unknown): string {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function cleanTenantName(v: unknown): string {
  return String(v || "").trim().replace(/\s+/g, " ");
}

export async function registerAction(
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const tenantName = cleanTenantName(formData.get("tenantName"));
  const email = cleanEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (tenantName.length < 2) return { error: "Вкажіть назву комплексу" };
  if (!email || !email.includes("@")) return { error: "Вкажіть коректний email" };
  if (password.length < 8) return { error: "Пароль має містити мінімум 8 символів" };

  const result = await registerAccount({ email, password, tenantName });

  if (!result.success) {
    return { error: result.error || "Помилка реєстрації" };
  }

  if (result.accessToken) {
    const cookieStore = await cookies();
    cookieStore.set(GAS_AUTH_TOKEN_KEY, result.accessToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  redirect("/admin");
}
