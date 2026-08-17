"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function DevAdminTabRedirect() {
  const router = useRouter();
  const params = useParams();
  const tab = params?.tab || "overview";

  useEffect(() => {
    router.replace(`/devpanel/${tab}`);
  }, [router, tab]);

  return null;
}
