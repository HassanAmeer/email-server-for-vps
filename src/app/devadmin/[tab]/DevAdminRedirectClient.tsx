"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DevAdminRedirectClient({ tab }: { tab: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/devpanel/${tab || "overview"}`);
  }, [router, tab]);

  return null;
}
