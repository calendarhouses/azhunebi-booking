import { redirect } from "next/navigation";

/** Головна = публічний сайт бронювання (демо «ХАТА» прибрано). */
export default function Home() {
  redirect("/book/default");
}
