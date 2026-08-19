"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginOverlay from "@/components/panel/LoginOverlay";

export default function DevLoginPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname || "localhost";
      const protocol = window.location.protocol || "http:";
      const url = `${protocol}//${host}:8081`;
      setApiUrl(url);

      const token = localStorage.getItem("devpanel_token") || localStorage.getItem("dev_admin_token");
      const expiry = localStorage.getItem("devpanel_token_expiry") || localStorage.getItem("dev_admin_token_expiry");

      if (token) {
        if (!expiry || Date.now() < Number(expiry)) {
          // Token is valid and unexpired -> redirect straight to Dev Panel
          router.replace("/devpanel");
          return;
        } else {
          // Token expired -> clean up
          localStorage.removeItem("devpanel_token");
          localStorage.removeItem("devpanel_token_expiry");
          localStorage.removeItem("dev_admin_token");
          localStorage.removeItem("dev_admin_token_expiry");
        }
      }
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#05070E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-gray-400 tracking-wider">INITIALIZING DEV PORTAL...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070E] text-white flex flex-col justify-between">
      <LoginOverlay
        apiUrl={apiUrl}
        onLoginSuccess={() => {
          router.push("/devpanel");
        }}
        loginEndpoint="/api/devpanel/login"
        tokenKey="devpanel_token"
        superTokenKey=""
        panelLabel="DEVELOPER CONSOLE"
        accentColor="violet"
        defaultUsername="dev"
      />
    </main>
  );
}
