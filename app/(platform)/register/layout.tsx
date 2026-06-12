import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Реєстрація | ХАТА",
  description: "Реєстрація нового комплексу",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

