"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the server data so new sales appear without a page reload
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
}
