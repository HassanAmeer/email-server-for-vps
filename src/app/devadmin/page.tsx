"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DevAdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/devpanel");
  }, [router]);
  return null;
}
