import type { ReactNode } from "react";
import "@/components/public/pay-page.css";

/** Ensures pay styles are in the initial HTML — no FOUC (cat flash). */
export default function PayLayout({ children }: { children: ReactNode }) {
  return children;
}
