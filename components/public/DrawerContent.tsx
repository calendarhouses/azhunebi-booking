"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DrawerContentProps = {
  children: ReactNode;
  scrollResetKey: string | number;
};

export function DrawerContent({ children, scrollResetKey }: DrawerContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [scrollResetKey]);

  return (
    <div className="drawer-content" ref={ref}>
      {children}
    </div>
  );
}
