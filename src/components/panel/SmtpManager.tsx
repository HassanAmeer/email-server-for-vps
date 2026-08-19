"use client";

import { useState, useEffect } from "react";

interface SMTPUser {
  id?: string;
  email?: string;
  username: string;
  password?: string;
  domain?: string;
  fromEmail?: string;
  description?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SmtpManagerProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
  isViolet?: boolean;
}

export default function SmtpManager({
  apiUrl,
  apiPrefix = "/api/admin",
  tokenKey = "admin_token",
  isViolet: propIsViolet,
}: SmtpManagerProps) {
  const isViolet =
    propIsViolet !== undefined
      ? propIsViolet
      : apiPrefix.includes("dev") || tokenKey.includes("dev");

  const [credentials, setCredentials] = useState<SMTPUser[]>([]);
  const [attachedDomains, setAttachedDomains] = useState<string[]>([]);
  const [primaryDomain, setPrimaryDomain] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>("all");

  // Top Row Test Email State
  const [topFromPrefix, setTopFromPrefix] = useState("noreply");
  const [topFromDomain, setTopFromDomain] = useState("");
  const [topToEmail, setTopToEmail] = useState("");
  const [topSubject, setTopSubject] = useState("⚡ Test Email via VPS SMTP Relay");
  const [topMessage, setTopMessage] = useState("Hello! This test confirms that your SMTP relay is configured and working perfectly.");
  const [isTopTesting, setIsTopTesting] = useState(false);
  const [topTestResult, setTopTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Modal State for Generating New Address
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPrefix, setNewPrefix] = useState("support");
  const [newDomain, setNewDomain] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Right-Side Slide-Over Sheet State
  const [selectedAccountForSheet, setSelectedAccountForSheet] = useState<SMTPUser | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<"wordpress" | "laravel" | "node" | "python" | "rest_api">("wordpress");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Live Test Email State (Inside Sheet)
  const [sheetTestTo, setSheetTestTo] = useState("");
  const [isSheetTesting, setIsSheetTesting] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token =
      localStorage.getItem(tokenKey) ||
      (isViolet ? localStorage.getItem("dev_admin_token") : "") ||
      "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSmtpData = async () => {
    if (!apiUrl) return;
    try {
      const headers = getAuthHeaders();
      const [credRes, domRes] = await Promise.allSettled([
        fetch(`${apiUrl}${apiPrefix}/smtp`, { headers }),
        fetch(`${apiUrl}${apiPrefix}/domains`, { headers }),
      ]);

      if (credRes.status === "fulfilled" && credRes.value.ok) {
        const data = await credRes.value.json();
        setCredentials(Array.isArray(data) ? data : []);
      } else {
        const fallbackRes = await fetch(`${apiUrl}${apiPrefix}/credentials`, { headers });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setCredentials(Array.isArray(data) ? data : []);
        }
      }

      if (domRes.status === "fulfilled" && domRes.value.ok) {
        const data = await domRes.value.json();
        if (Array.isArray(data)) {
          const dList = data.map((d: any) => (typeof d === "string" ? d : d.domain));
          setAttachedDomains(dList);
          const prim = data.find((d: any) => d.is_primary);
          if (prim) {
            const pDomain = typeof prim === "string" ? prim : prim.domain;
            setPrimaryDomain(pDomain);
            setTopFromDomain((prev) => prev || pDomain);
            setNewDomain((prev) => prev || pDomain);
          } else if (dList.length > 0) {
            setPrimaryDomain(dList[0]);
            setTopFromDomain((prev) => prev || dList[0]);
            setNewDomain((prev) => prev || dList[0]);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching SMTP data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSmtpData();
  }, [apiUrl, apiPrefix, tokenKey]);

  const copyToClipboard = (text: string, keyName: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < 18; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  };

  const handleTopSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testToClean(topToEmail)) {
      setTopTestResult({ success: false, msg: "Please enter a valid recipient email address." });
      return;
    }

    const domain = topFromDomain.trim() || primaryDomain || attachedDomains[0] || "micorna.biz";
    const sender = `${(topFromPrefix.trim() || "noreply")}@${domain}`;

    setIsTopTesting(true);
    setTopTestResult(null);

    try {
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`${apiUrl}${apiPrefix}/smtp/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          toEmail: topToEmail.trim(),
          fromEmail: sender,
          subject: topSubject.trim() || "⚡ Test Email via VPS SMTP Relay",
          text: topMessage.trim() || "Hello from VPS SMTP Relay!",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTopTestResult({
          success: true,
          msg: `Success! Test email queued and dispatched from ${sender} to ${topToEmail}.`,
        });
      } else {
        throw new Error(data.error || "Failed to dispatch test email.");
      }
    } catch (err: any) {
      setTopTestResult({
        success: false,
        msg: err.message || "Error transmitting email through SMTP relay.",
      });
    } finally {
      setIsTopTesting(false);
    }
  };

  const handleSheetSendTestEmail = async (senderEmail: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!testToClean(sheetTestTo)) {
      setSheetTestResult({ success: false, msg: "Please enter a valid recipient email address." });
      return;
    }

    setIsSheetTesting(true);
    setSheetTestResult(null);

    try {
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`${apiUrl}${apiPrefix}/smtp/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          toEmail: sheetTestTo.trim(),
          fromEmail: senderEmail,
          subject: "⚡ Test Email via Dedicated SMTP Address",
          text: `Hello! This test confirms that your SMTP address (${senderEmail}) is connected and relaying successfully.`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSheetTestResult({
          success: true,
          msg: `Success! Test email sent from ${senderEmail} to ${sheetTestTo}.`,
        });
      } else {
        throw new Error(data.error || "Failed to dispatch test email.");
      }
    } catch (err: any) {
      setSheetTestResult({
        success: false,
        msg: err.message || "Error transmitting email through SMTP relay.",
      });
    } finally {
      setIsSheetTesting(false);
    }
  };

  const testToClean = (email: string) => {
    return email && email.includes("@") && email.length > 4;
  };

  const handleCreateSmtpAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = newPrefix.trim().toLowerCase().replace(/@.*$/, "");
    const cleanDomain = newDomain.trim() || primaryDomain || attachedDomains[0] || "micorna.biz";
    const fullEmail = `${cleanPrefix}@${cleanDomain}`;

    if (!cleanPrefix || !newPassword.trim()) {
      setAlert({ type: "error", msg: "Prefix and password are required." });
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const res = await fetch(`${apiUrl}${apiPrefix}/smtp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: fullEmail,
          username: fullEmail,
          password: newPassword.trim(),
          domain: cleanDomain,
          fromEmail: fullEmail,
          description: newDescription.trim() || "Website / App SMTP Connection",
          enabled: true,
        }),
      });

      if (res.ok) {
        setAlert({ type: "success", msg: `SMTP Address ${fullEmail} generated successfully!` });
        setNewPrefix("support");
        setNewPassword("");
        setNewDescription("");
        setShowCreateModal(false);
        fetchSmtpData();
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Address creation failed");
      }
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to generate SMTP credentials." });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setAlert(null), 4000);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Are you sure you want to delete SMTP address "${username}"? Connected websites and apps will lose outbound access.`)) {
      return;
    }
    if (!apiUrl) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${apiUrl}${apiPrefix}/smtp/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        if (selectedAccountForSheet?.username === username) {
          setSelectedAccountForSheet(null);
        }
        fetchSmtpData();
      }
    } catch (err) {
      console.error("Error deleting SMTP credential:", err);
    }
  };

  const getAccountHost = (user: SMTPUser) => {
    const d = user.domain && user.domain !== "*" ? user.domain : primaryDomain || "yourdomain.com";
    return `mail.${d}`;
  };

  // Filtered accounts list
  const filteredCredentials = credentials.filter((user) => {
    if (selectedDomainFilter === "all") return true;
    const userDom = user.domain || (user.username.includes("@") ? user.username.split("@")[1] : "");
    return userDom === selectedDomainFilter;
  });

  return (
    <section className="tab-pane active w-full flex flex-col gap-6 animate-fade-in relative font-sans" id="smtp-tab">
      
      {/* Toast Alert */}
      {alert && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border transition-all animate-bounce ${
            alert.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-300 shadow-emerald-500/20"
              : "bg-rose-950/95 border-rose-500/40 text-rose-300 shadow-rose-500/20"
          }`}
        >
          <span className="text-lg font-bold">{alert.type === "success" ? "✓" : "✕"}</span>
          <span className="text-xs font-semibold">{alert.msg}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel border border-white/[0.04] p-6 rounded-3xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-extrabold text-white tracking-wide font-mono flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className={`w-5 h-5 ${isViolet ? "text-violet-400" : "text-emerald-400"}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
              SMTP Relay & Outbound Accounts
            </h2>
            <span
              className={`text-[10px] ${
                isViolet
                  ? "bg-violet-500/10 border-violet-500/25 text-violet-300"
                  : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              } border px-2.5 py-0.5 rounded-md font-bold font-mono`}
            >
              {credentials.length} Addresses Configured
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Generate separate authenticated SMTP addresses for each domain and connect websites, apps, or services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setNewPrefix("support");
              setNewPassword("");
              setNewDescription("");
              generateSecurePassword();
              setShowCreateModal(true);
            }}
            className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              isViolet
                ? "bg-violet-600 hover:bg-violet-500 shadow-violet-600/25"
                : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Generate SMTP Address
          </button>
        </div>
      </div>

      {/* TOP ROW: Live SMTP Outbound Test Dispatcher */}
      <div className="glass-panel border border-white/[0.05] p-5 rounded-3xl flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isViolet ? "bg-violet-400" : "bg-emerald-400"} animate-pulse`}></span>
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
              Test Live Email Dispatch
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Directly test outbound transmission from any domain to any destination
          </span>
        </div>

        <form onSubmit={handleTopSendTestEmail} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end font-mono text-xs">
          
          {/* 1. From Sender (Prefix + @ + Domain) */}
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold">
              From Sender Address
            </label>
            <div className="flex items-center gap-1 w-full">
              <input
                type="text"
                placeholder="noreply"
                value={topFromPrefix}
                onChange={(e) => setTopFromPrefix(e.target.value.replace(/@.*$/, ""))}
                required
                className="w-2/5 bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-2.5 py-2 text-white outline-none transition-colors font-mono"
              />
              <div className="px-2.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 font-bold text-xs shrink-0 select-none shadow-inner">
                @
              </div>
              <select
                value={topFromDomain || primaryDomain || attachedDomains[0] || ""}
                onChange={(e) => setTopFromDomain(e.target.value)}
                className="w-3/5 bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-2 py-2 text-white outline-none transition-colors font-mono cursor-pointer"
              >
                {attachedDomains.length > 0 ? (
                  attachedDomains.map((d) => (
                    <option key={d} value={d} className="bg-slate-900 text-white">
                      {d}
                    </option>
                  ))
                ) : (
                  <option value={primaryDomain || "micorna.biz"} className="bg-slate-900 text-white">
                    {primaryDomain || "micorna.biz"}
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* 2. To Recipient */}
          <div className="md:col-span-3 flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold">
              To Recipient Email
            </label>
            <input
              type="email"
              placeholder="user@gmail.com"
              value={topToEmail}
              onChange={(e) => setTopToEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3 py-2 text-white outline-none transition-colors font-mono"
            />
          </div>

          {/* 3. Subject & Message */}
          <div className="md:col-span-3 flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold">
              Subject Line
            </label>
            <input
              type="text"
              placeholder="Email subject..."
              value={topSubject}
              onChange={(e) => setTopSubject(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3 py-2 text-white outline-none transition-colors font-mono"
            />
          </div>

          {/* 4. Send Button */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isTopTesting}
              className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isTopTesting
                  ? "opacity-50 cursor-not-allowed bg-gray-700"
                  : isViolet
                  ? "bg-violet-600 hover:bg-violet-500 shadow-violet-600/25"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
              }`}
            >
              {isTopTesting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Relaying...</span>
                </>
              ) : (
                <>
                  <span>🚀</span> Send Test
                </>
              )}
            </button>
          </div>
        </form>

        {/* Message Input Box row (2 lines) */}
        <div className="flex flex-col gap-1 pt-1 font-mono">
          <label className="text-[10px] text-gray-400 uppercase font-bold">
            Message Content (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Type your custom email message text..."
            value={topMessage}
            onChange={(e) => setTopMessage(e.target.value)}
            className="w-full bg-black/30 border border-white/[0.06] focus:border-emerald-500/60 rounded-xl px-3 py-2 text-gray-300 text-xs outline-none resize-none font-mono leading-relaxed"
          />
        </div>

        {/* Live Result Alert */}
        {topTestResult && (
          <div
            className={`p-3 rounded-xl border text-[11px] font-mono flex items-center justify-between mt-1 ${
              topTestResult.success
                ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                : "bg-rose-950/60 border-rose-500/30 text-rose-300"
            }`}
          >
            <span>{topTestResult.msg}</span>
            <button
              type="button"
              onClick={() => setTopTestResult(null)}
              className="text-xs text-gray-400 hover:text-white ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs by Attached Domain (Plain Domain Names, No "Primary" label) */}
      {attachedDomains.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-mono font-bold text-gray-400 uppercase mr-1">
            Filter Domain:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDomainFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              selectedDomainFilter === "all"
                ? isViolet
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-white/[0.03] text-gray-400 hover:text-white border border-white/[0.05]"
            }`}
          >
            All Domains ({credentials.length})
          </button>
          {attachedDomains.map((d) => {
            const count = credentials.filter((u) => {
              const uDom = u.domain || (u.username.includes("@") ? u.username.split("@")[1] : "");
              return uDom === d;
            }).length;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDomainFilter(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                  selectedDomainFilter === d
                    ? isViolet
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-white/[0.03] text-gray-400 hover:text-white border border-white/[0.05]"
                }`}
              >
                <span>🌐 {d}</span>
                <span className="text-[10px] text-gray-400 opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Generated Addresses Table */}
      <div className="glass-panel border border-white/[0.04] p-6 rounded-3xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide flex items-center gap-2">
              <span>📫</span> Generated Outbound Email Accounts
            </h3>
            <p className="text-[11px] text-gray-400">
              Each generated address has its own isolated SMTP credentials. Click "Connect / Setup" to view its connection sheet.
            </p>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            Showing {filteredCredentials.length} of {credentials.length} accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] font-bold text-gray-400 uppercase font-mono">
                <th className="py-3 px-3">Email Address & Purpose</th>
                <th className="py-3 px-3">Domain</th>
                <th className="py-3 px-3">Password / Secret</th>
                <th className="py-3 px-3 text-right">Connection & Setup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    Loading SMTP accounts...
                  </td>
                </tr>
              ) : filteredCredentials.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    No SMTP addresses generated for this domain yet. Click "+ Generate SMTP Address" above.
                  </td>
                </tr>
              ) : (
                filteredCredentials.map((user) => {
                  const displayEmail = user.email || user.fromEmail || user.username;
                  const isVisible = Boolean(showPasswords[user.username]);
                  const userDomain =
                    user.domain && user.domain !== "*"
                      ? user.domain
                      : displayEmail.includes("@")
                      ? displayEmail.split("@")[1]
                      : primaryDomain || "*";

                  const isSelected = selectedAccountForSheet?.username === user.username;

                  return (
                    <tr
                      key={user.username}
                      className={`transition-colors ${
                        isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.015]"
                      }`}
                    >
                      {/* Email & Purpose */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-white text-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            {displayEmail}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400">
                            {user.id && <span className="text-[9px] bg-white/[0.06] px-1.5 py-0.5 rounded text-gray-300">ID: {user.id}</span>}
                            <span>User: {user.username}</span>
                            {user.description && (
                              <span className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] text-gray-300">
                                {user.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Domain Badge */}
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-mono">
                          {userDomain}
                        </span>
                      </td>

                      {/* Password */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2 bg-black/40 border border-white/[0.04] px-2.5 py-1 rounded-lg w-fit">
                          <span className="text-gray-300 select-all font-mono text-[11px]">
                            {isVisible ? user.password || "••••••••" : "••••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswords((prev) => ({
                                ...prev,
                                [user.username]: !prev[user.username],
                              }))
                            }
                            className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                            title={isVisible ? "Hide" : "Show"}
                          >
                            {isVisible ? "🙈" : "👁️"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(user.password || "", user.username)}
                            className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                            title="Copy Password"
                          >
                            {copiedKey === user.username ? "✓" : "📋"}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Connect & Setup Guide Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccountForSheet(user);
                              setSheetTestResult(null);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                              isViolet
                                ? "bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 hover:border-violet-500/50"
                                : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                              stroke="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                              />
                            </svg>
                            <span>Connect / Setup</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(user.username)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
                            title="Delete SMTP Address"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                              stroke="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REST API & Developer Integration Reference Card */}
      <div className="glass-panel border border-white/[0.05] p-6 rounded-3xl flex flex-col gap-4 font-mono text-xs shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isViolet ? "bg-violet-400" : "bg-emerald-400"} animate-pulse`}></span>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              SMTP REST API & Developer Endpoints
            </h3>
            <span className="text-[10px] bg-white/[0.05] border border-white/[0.08] text-gray-300 px-2 py-0.5 rounded-md">
              HTTP REST Interface
            </span>
          </div>
          <a
            href={isViolet ? "/devdoc" : "/doc"}
            target="_blank"
            className={`text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
              isViolet ? "text-violet-400 hover:text-violet-300" : "text-emerald-400 hover:text-emerald-300"
            }`}
          >
            <span>Open Interactive API Playground</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>

        <p className="text-xs text-gray-400 font-sans leading-relaxed">
          You can create SMTP credentials, manage domain senders, and dispatch DKIM-signed outbound emails programmatically using simple HTTP REST requests from your application, website, or backend scripts without maintaining raw SMTP sockets.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          {/* 1. Send Outbound Email API (Single / Test with Attachments) */}
          <div className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  POST
                </span>
                <strong className="text-white text-xs">{apiPrefix}/smtp/send</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey) || "" : "";
                  const txt = `curl -X POST "${apiUrl}${apiPrefix}/smtp/send" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token || "YOUR_TOKEN"}" \\\n  -d '{\n    "from": "support@${primaryDomain || "yourdomain.com"}",\n    "to": "client@example.com",\n    "subject": "Order Confirmation #9401",\n    "text": "Your order has been confirmed!",\n    "html": "<h2>Order Confirmed</h2><p>Thank you!</p>",\n    "attachments": [\n      {\n        "filename": "invoice.pdf",\n        "content": "JVBERi0xLjQK...",\n        "contentType": "application/pdf"\n      }\n    ]\n  }'`;
                  copyToClipboard(txt, "api_send_curl");
                }}
                className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                {copiedKey === "api_send_curl" ? "✓ Copied" : "📋 Copy cURL"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400 font-sans">
              Single / Test email with HTML & attachment support.
            </span>
            <pre className="text-[11px] text-emerald-300/90 bg-black/50 p-2.5 rounded-xl overflow-x-auto leading-relaxed border border-white/[0.04]">
{`{
  "from": "support@${primaryDomain || "yourdomain.com"}",
  "to": "client@example.com",
  "subject": "Order Confirmation",
  "text": "Your order is confirmed!",
  "html": "<p>Thank you!</p>",
  "attachments": [
    { "filename": "doc.pdf", "content": "..." }
  ]
}`}
            </pre>
          </div>

          {/* 2. Bulk Outbound Email API (Min 5s Delay) */}
          <div className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  POST
                </span>
                <strong className="text-white text-xs">{apiPrefix}/smtp/send-bulk</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey) || "" : "";
                  const txt = `curl -X POST "${apiUrl}${apiPrefix}/smtp/send-bulk" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token || "YOUR_TOKEN"}" \\\n  -d '{\n    "from": "newsletter@${primaryDomain || "yourdomain.com"}",\n    "recipients": ["client1@gmail.com", "client2@yahoo.com"],\n    "subject": "System Newsletter",\n    "html": "<h2>Monthly Update</h2>",\n    "delaySeconds": 5\n  }'`;
                  copyToClipboard(txt, "api_bulk_curl");
                }}
                className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                {copiedKey === "api_bulk_curl" ? "✓ Copied" : "📋 Copy cURL"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400 font-sans">
              Bulk dispatch with enforced minimum 5s throttling delay.
            </span>
            <pre className="text-[11px] text-purple-300/90 bg-black/50 p-2.5 rounded-xl overflow-x-auto leading-relaxed border border-white/[0.04]">
{`{
  "from": "news@${primaryDomain || "yourdomain.com"}",
  "recipients": [
    "user1@gmail.com",
    "user2@yahoo.com"
  ],
  "subject": "Updates",
  "html": "<p>Newsletter...</p>",
  "delaySeconds": 5
}`}
            </pre>
          </div>

          {/* 3. Create SMTP Account by Active Domain API */}
          <div className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  POST
                </span>
                <strong className="text-white text-xs">{apiPrefix}/smtp</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey) || "" : "";
                  const txt = `curl -X POST "${apiUrl}${apiPrefix}/smtp" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token || "YOUR_TOKEN"}" \\\n  -d '{\n    "email": "orders@${primaryDomain || "yourdomain.com"}",\n    "password": "your_secure_password",\n    "domain": "${primaryDomain || "yourdomain.com"}",\n    "description": "E-commerce Orders",\n    "enabled": true\n  }'`;
                  copyToClipboard(txt, "api_create_curl");
                }}
                className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                {copiedKey === "api_create_curl" ? "✓ Copied" : "📋 Copy cURL"}
              </button>
            </div>
            <span className="text-[11px] text-gray-400 font-sans">
              Create SMTP address using active domain list (/api/domains).
            </span>
            <pre className="text-[11px] text-emerald-300/90 bg-black/50 p-2.5 rounded-xl overflow-x-auto leading-relaxed border border-white/[0.04]">
{`{
  "email": "orders@${primaryDomain || "yourdomain.com"}",
  "password": "strong_secret_password",
  "domain": "${primaryDomain || "yourdomain.com"}",
  "description": "Store Sender",
  "enabled": true
}`}
            </pre>
          </div>
        </div>

        {/* Quick Route Summary Table */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1 text-[11px]">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <div>
              <span className="text-sky-400 font-bold mr-1.5">GET</span>
              <span className="text-gray-300">{apiPrefix}/smtp</span>
            </div>
            <span className="text-gray-400 text-[10px]">List Accounts</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <div>
              <span className="text-purple-400 font-bold mr-1.5">POST</span>
              <span className="text-gray-300">{apiPrefix}/smtp/send-bulk</span>
            </div>
            <span className="text-gray-400 text-[10px]">Bulk Dispatch (5s)</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
            <div>
              <span className="text-rose-400 font-bold mr-1.5">DELETE</span>
              <span className="text-gray-300">{apiPrefix}/smtp/:identifier</span>
            </div>
            <span className="text-gray-400 text-[10px]">Delete (ID/Email)</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE SLIDE-OVER SHEET (DRAWER) */}
      {selectedAccountForSheet && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in font-sans">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedAccountForSheet(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
          />

          {/* Slide-over Content Drawer */}
          <div className="relative w-full max-w-2xl bg-[#090d16] border-l border-white/[0.08] h-full shadow-2xl flex flex-col justify-between overflow-y-auto z-10 p-6 md:p-8 animate-slide-left font-sans">
            <div className="flex flex-col gap-6">
              
              {/* Sheet Header */}
              <div className="flex justify-between items-start border-b border-white/[0.06] pb-5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h3 className="text-lg font-extrabold text-white font-mono tracking-wide">
                      SMTP Connection Setup
                    </h3>
                  </div>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}
                  </strong>
                  <span className="text-[11px] text-gray-400">
                    Use these separate credentials to connect your Website (WordPress, Shopify), Backend (Laravel, Node.js, Python), or App.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAccountForSheet(null)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Connection Parameters Table in Sheet */}
              <div className="glass-panel border border-white/[0.06] p-4 rounded-2xl bg-black/30 flex flex-col gap-3 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                  <span className="text-gray-400">SMTP Host / Server:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-white">{getAccountHost(selectedAccountForSheet)}</strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getAccountHost(selectedAccountForSheet), "sheet_host")}
                      className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-0.5 rounded text-gray-300 cursor-pointer"
                    >
                      {copiedKey === "sheet_host" ? "✓" : "📋 Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                  <span className="text-gray-400">Port & Encryption:</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                      587 (TLS / STARTTLS)
                    </span>
                    <span className="text-gray-400">or 465 (SSL)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                  <span className="text-gray-400">SMTP Username:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-white">{selectedAccountForSheet.username}</strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedAccountForSheet.username, "sheet_user")}
                      className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-0.5 rounded text-gray-300 cursor-pointer"
                    >
                      {copiedKey === "sheet_user" ? "✓" : "📋 Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-white/[0.04] pb-2">
                  <span className="text-gray-400">SMTP Password:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-white">
                      {showPasswords[selectedAccountForSheet.username]
                        ? selectedAccountForSheet.password
                        : "••••••••••••••••"}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((prev) => ({
                          ...prev,
                          [selectedAccountForSheet.username]: !prev[selectedAccountForSheet.username],
                        }))
                      }
                      className="text-[10px] text-gray-400 hover:text-white cursor-pointer"
                    >
                      {showPasswords[selectedAccountForSheet.username] ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedAccountForSheet.password || "", "sheet_pass")}
                      className="text-[10px] bg-white/[0.05] hover:bg-white/[0.1] px-2 py-0.5 rounded text-gray-300 cursor-pointer"
                    >
                      {copiedKey === "sheet_pass" ? "✓" : "📋 Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Allowed From Sender:</span>
                  <strong className="text-emerald-400">
                    {selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}
                  </strong>
                </div>
              </div>

              {/* Framework Code Tabs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase text-gray-300">
                    Setup Guide By Framework:
                  </span>

                  {/* Pills */}
                  <div className="flex items-center gap-1 bg-black/40 border border-white/[0.06] p-1 rounded-xl flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("wordpress")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCodeTab === "wordpress"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      WordPress
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("laravel")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCodeTab === "laravel"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Laravel / PHP
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("node")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCodeTab === "node"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Node.js
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("python")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCodeTab === "python"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Python
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeTab("rest_api")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCodeTab === "rest_api"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      REST API (cURL / HTTP)
                    </button>
                  </div>
                </div>

                {/* Code Display */}
                <div className="relative bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 overflow-x-auto text-xs font-mono">
                  <div className="absolute top-3 right-3">
                    <button
                      type="button"
                      onClick={() => {
                        const host = getAccountHost(selectedAccountForSheet);
                        const user = selectedAccountForSheet.username;
                        const pass = selectedAccountForSheet.password || "";
                        const from = selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || user;
                        const token = typeof window !== "undefined" ? localStorage.getItem(tokenKey) || "" : "";

                        let txt = "";
                        if (activeCodeTab === "wordpress") {
                          txt = `Mailer: Other SMTP\nSMTP Host: ${host}\nEncryption: TLS\nSMTP Port: 587\nAuthentication: ON\nSMTP Username: ${user}\nSMTP Password: ${pass}\nFrom Email: ${from}`;
                        } else if (activeCodeTab === "laravel") {
                          txt = `MAIL_MAILER=smtp\nMAIL_HOST=${host}\nMAIL_PORT=587\nMAIL_USERNAME=${user}\nMAIL_PASSWORD=${pass}\nMAIL_ENCRYPTION=tls\nMAIL_FROM_ADDRESS="${from}"\nMAIL_FROM_NAME="\${APP_NAME}"`;
                        } else if (activeCodeTab === "node") {
                          txt = `import nodemailer from "nodemailer";\n\nconst transporter = nodemailer.createTransport({\n  host: "${host}",\n  port: 587,\n  secure: false,\n  auth: {\n    user: "${user}",\n    pass: "${pass}",\n  },\n});\n\nawait transporter.sendMail({\n  from: '"App" <${from}>',\n  to: "recipient@example.com",\n  subject: "Notification",\n  html: "<b>Hello World!</b>",\n});`;
                        } else if (activeCodeTab === "python") {
                          txt = `import smtplib\nfrom email.mime.text import MIMEText\n\nmsg = MIMEText("Hello from Python!")\nmsg['Subject'] = "System Alert"\nmsg['From'] = "${from}"\nmsg['To'] = "recipient@example.com"\n\nwith smtplib.SMTP("${host}", 587) as server:\n    server.starttls()\n    server.login("${user}", "${pass}")\n    server.send_message(msg)`;
                        } else if (activeCodeTab === "rest_api") {
                          txt = `curl -X POST "${apiUrl}${apiPrefix}/smtp/send" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token || "YOUR_TOKEN"}" \\\n  -d '{\n    "from": "${from}",\n    "to": "recipient@gmail.com",\n    "subject": "Hello via REST API",\n    "text": "Sent directly via HTTP POST!"\n  }'`;
                        }
                        copyToClipboard(txt, "drawer_code");
                      }}
                      className="text-[10px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-gray-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {copiedKey === "drawer_code" ? "✓ Copied!" : "📋 Copy Snippet"}
                    </button>
                  </div>

                  <pre className="text-emerald-300 leading-relaxed overflow-x-auto pr-24">
                    {activeCodeTab === "wordpress" && (
                      <code>
{`// 1. In WordPress Dashboard -> Install "WP Mail SMTP"
// 2. Fill in these exact settings:
Mailer: Other SMTP
SMTP Host: ${getAccountHost(selectedAccountForSheet)}
Encryption: TLS (STARTTLS)
SMTP Port: 587
Authentication: ON
SMTP Username: ${selectedAccountForSheet.username}
SMTP Password: ${selectedAccountForSheet.password}
From Email: ${selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}`}
                      </code>
                    )}

                    {activeCodeTab === "laravel" && (
                      <code>
{`# Paste into your Laravel / Symfony .env file:
MAIL_MAILER=smtp
MAIL_HOST=${getAccountHost(selectedAccountForSheet)}
MAIL_PORT=587
MAIL_USERNAME=${selectedAccountForSheet.username}
MAIL_PASSWORD=${selectedAccountForSheet.password}
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="${selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}"
MAIL_FROM_NAME="\${APP_NAME}"`}
                      </code>
                    )}

                    {activeCodeTab === "node" && (
                      <code>
{`import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "${getAccountHost(selectedAccountForSheet)}",
  port: 587,
  secure: false, // TLS
  auth: {
    user: "${selectedAccountForSheet.username}",
    pass: "${selectedAccountForSheet.password}",
  },
});

await transporter.sendMail({
  from: '"My SaaS App" <${selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}>',
  to: "customer@gmail.com",
  subject: "Account Confirmation",
  html: "<p>Your account is ready.</p>",
});`}
                      </code>
                    )}

                    {activeCodeTab === "python" && (
                      <code>
{`import smtplib
from email.mime.text import MIMEText

msg = MIMEText("Hello! Outbound test message.")
msg['Subject'] = "Automated Alert"
msg['From'] = "${selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}"
msg['To'] = "recipient@example.com"

with smtplib.SMTP("${getAccountHost(selectedAccountForSheet)}", 587) as server:
    server.starttls()
    server.login("${selectedAccountForSheet.username}", "${selectedAccountForSheet.password}")
    server.send_message(msg)

print("Email sent successfully!")`}
                      </code>
                    )}

                    {activeCodeTab === "rest_api" && (
                      <code>
{`# Send email via HTTP POST (No SMTP socket needed):
curl -X POST "${apiUrl}${apiPrefix}/smtp/send" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -d '{
    "from": "${selectedAccountForSheet.email || selectedAccountForSheet.fromEmail || selectedAccountForSheet.username}",
    "to": "client@gmail.com",
    "subject": "Order Confirmation",
    "text": "Your order #1049 is confirmed!",
    "html": "<h2>Order Confirmed!</h2><p>Thank you for your purchase.</p>"
  }'`}
                      </code>
                    )}
                  </pre>
                </div>
              </div>

              {/* Live Test Sender Tool Inside Sheet */}
              <div className="glass-panel border border-white/[0.06] p-5 rounded-2xl bg-black/40 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-xs font-mono">🚀 Test This SMTP Address</span>
                </div>
                <form
                  onSubmit={(e) =>
                    handleSheetSendTestEmail(
                      selectedAccountForSheet.email ||
                        selectedAccountForSheet.fromEmail ||
                        selectedAccountForSheet.username,
                      e
                    )
                  }
                  className="flex flex-col gap-3 text-xs font-mono"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">To Destination Email</label>
                    <input
                      type="email"
                      placeholder="your.gmail@gmail.com"
                      value={sheetTestTo}
                      onChange={(e) => setSheetTestTo(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSheetTesting}
                    className={`w-full py-2.5 rounded-xl font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                      isSheetTesting
                        ? "opacity-50 cursor-not-allowed bg-gray-700"
                        : isViolet
                        ? "bg-violet-600 hover:bg-violet-500"
                        : "bg-emerald-600 hover:bg-emerald-500"
                    }`}
                  >
                    {isSheetTesting ? "Relaying Test..." : "🚀 Send Test Email via This Address"}
                  </button>

                  {sheetTestResult && (
                    <div
                      className={`p-3 rounded-xl border text-[11px] ${
                        sheetTestResult.success
                          ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                          : "bg-rose-950/50 border-rose-500/30 text-rose-300"
                      }`}
                    >
                      {sheetTestResult.msg}
                    </div>
                  )}
                </form>
              </div>

            </div>

            {/* Sheet Footer */}
            <div className="pt-6 border-t border-white/[0.06] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAccountForSheet(null)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 text-xs font-mono transition-colors cursor-pointer"
              >
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE SMTP ADDRESS MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in font-sans">
          <div className="relative w-full max-w-lg bg-[#0d131f] border border-white/[0.08] rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/[0.06] pb-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base font-extrabold text-white font-mono">
                  Generate SMTP Email Address
                </h3>
                <p className="text-xs text-gray-400">
                  Create an address for any domain with dedicated SMTP credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSmtpAddress} className="flex flex-col gap-4 font-mono text-xs">
              
              {/* Address Builder: Name + @ + Domain */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-gray-300 font-bold">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    {(newPrefix.trim().toLowerCase().replace(/@.*$/, "") || "support")}@{newDomain || primaryDomain || attachedDomains[0] || "domain.com"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    placeholder="e.g. support, billing, noreply"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    required
                    className="w-1/2 bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-white outline-none"
                  />
                  <div className="px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-300 font-mono font-extrabold text-xs shrink-0 select-none shadow-inner">
                    @
                  </div>
                  <select
                    value={newDomain || primaryDomain || attachedDomains[0] || ""}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="w-1/2 bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-white outline-none cursor-pointer"
                  >
                    {attachedDomains.map((d) => (
                      <option key={d} value={d} className="bg-slate-900 text-white">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-gray-300 font-bold">
                    SMTP Password / Secret <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    ⚡ Generate 18-char Key
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Secure password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                />
              </div>

              {/* Purpose */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-300 font-bold">
                  App / Website Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. WooCommerce Store, Next.js Auth, Customer Support"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-white outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end items-center gap-3 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all cursor-pointer ${
                    isViolet
                      ? "bg-violet-600 hover:bg-violet-500 shadow-violet-600/25"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                  }`}
                >
                  {isSubmitting ? "Generating..." : "Save & Generate Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}
