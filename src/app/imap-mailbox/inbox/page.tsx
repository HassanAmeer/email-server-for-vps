"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ImapMailboxInboxRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mailbox/inbox");
  }, [router]);

  return (
    <div className="fixed inset-0 bg-[#05070E] flex items-center justify-center text-gray-400 font-mono text-sm">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin"></div>
        <span>Redirecting to Mailbox Inbox...</span>
      </div>
    </div>
  );
}
