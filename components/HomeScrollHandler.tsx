"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function HomeScrollHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const section = searchParams.get("section");
    if (!section) return;
    const el = document.getElementById(`section-${section}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [searchParams]);

  return null;
}
