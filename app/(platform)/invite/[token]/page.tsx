import type { Metadata } from "next";
import InvitePageClient from "./InvitePageClient";

export const metadata: Metadata = {
  title: "Запрошення | АЖ У НЕБІ",
  description: "Прийняти запрошення до команди",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  return <InvitePageClient token={token} />;
}
