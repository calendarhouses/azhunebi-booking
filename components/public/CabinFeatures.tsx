import type { ReactNode } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";

const iconWin = (
  <svg viewBox="0 0 24 24">
    <path d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);
const iconBed = (
  <svg viewBox="0 0 24 24">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);
const iconGrill = (
  <svg viewBox="0 0 24 24">
    <path d="M12 3v18M8 7h8M6 11h12" />
  </svg>
);
const iconBath = (
  <svg viewBox="0 0 24 24">
    <path d="M4 17V8a2 2 0 012-2h12a2 2 0 012 2v9m-8-5h.01M6 21h12a2 2 0 002-2v-2H4v2a2 2 0 002 2z" />
  </svg>
);

export function CabinFeatures({ room }: { room: PublicRoom }) {
  const name = room.name.toLowerCase();
  let items: { icon: ReactNode; text: string }[];

  if (name.includes("1") || name.includes("котедж 1")) {
    items = [
      { icon: iconBed, text: "Затишна спальня для солодких снів" },
      { icon: iconWin, text: "Панорамний вид на озеро" },
      { icon: iconGrill, text: "Власна BBQ-зона на терасі" },
    ];
  } else if (name.includes("2") || name.includes("3")) {
    items = [
      { icon: iconWin, text: "Простора та світла вітальня" },
      { icon: iconBed, text: "Дві окремі спальні" },
      { icon: iconGrill, text: "Тераса під навісом із мангалом" },
    ];
  } else {
    items = [
      { icon: iconWin, text: "Вітальня з панорамними вікнами" },
      { icon: iconBed, text: "Спальня з видом на зорі" },
      { icon: iconBath, text: "Ванна кімната з дзеркалом" },
    ];
  }

  return (
    <div className="premium-features">
      {items.map((item) => (
        <div className="feature-item" key={item.text}>
          {item.icon}
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
