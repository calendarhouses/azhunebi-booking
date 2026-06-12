import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вхід | ХАТА",
  description: "Вхід у панель управління",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
