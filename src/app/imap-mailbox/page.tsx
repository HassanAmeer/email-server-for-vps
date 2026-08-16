"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-config";

interface ImapInfo {
  primaryDomain: string;
  catchAll: boolean;
  imap: {
    host: string;
    sslPort: number;
    plainPort: number;
    status: string;
  };
  defaultCredentials?: {
    email: string;
    password?: string;
  };
}

export default function ImapMailboxLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<ImapInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("imap_mailbox_token");
    if (token) {
      router.push("/imap-mailbox/inbox");
      return;
    }

    const apiBase = getApiBaseUrl();

    // Fetch primary domain & default IMAP credentials info
    fetch(`${apiBase}/api/imap-mailbox/info`)
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then(data => {
        if (data && data.success) {
          setInfo(data);
          if (data.defaultCredentials?.email) {
            setEmail(data.defaultCredentials.email);
          }
          if (data.defaultCredentials?.password) {
            setPassword(data.defaultCredentials.password);
          }
        }
      })
      .catch(err => {
        console.warn("Could not load IMAP info:", err);
      })
      .finally(() => {
        setLoadingInfo(false);
      });
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/imap-mailbox/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 404
            ? "API endpoint not found. Please ensure backend server (port 8081) is running."
            : "Server returned non-JSON response. Please verify backend service."
        );
      }

      if (res.ok && data.token) {
        localStorage.setItem("imap_mailbox_token", data.token);
        localStorage.setItem("imap_mailbox_user", JSON.stringify(data.user || { email, is_primary: true }));
        router.push("/imap-mailbox/inbox");
      } else {
        setError(data.error || "Login failed. Check your credentials.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickMasterLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/imap-mailbox/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMasterQuickLogin: true })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 404
            ? "API endpoint not found. Please ensure backend server (port 8081) is running."
            : "Server returned non-JSON response. Please verify backend service."
        );
      }

      if (res.ok && data.token) {
        localStorage.setItem("imap_mailbox_token", data.token);
        localStorage.setItem("imap_mailbox_user", JSON.stringify(data.user || { email: "master@primary", is_primary: true, is_master: true }));
        router.push("/imap-mailbox/inbox");
      } else {
        setError(data.error || "Master login failed.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during master sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* Background glowing effects to match theme */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[150px] pointer-events-none rounded-full animate-pulse" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-black to-black opacity-80" />

      <div className="w-full max-w-lg relative z-10">
        {/* Main Card */}
        <div className="bg-[#0b0f19]/90 border border-white/[0.08] backdrop-blur-2xl p-8 rounded-3xl shadow-2xl shadow-blue-950/40 relative overflow-hidden">
          {/* Subtle top light highlight */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

          {/* Header Icon & Title */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-[0_0_25px_rgba(59,130,246,0.25)] relative">
              <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-sm"></div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-8 h-8 relative z-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <h1 className="text-3xl font-black text-white tracking-tight">IMAP <span className="text-blue-400">Mailbox</span></h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wider">
                Catch-All Active
              </span>
            </div>
            <p className="text-gray-400 text-xs max-w-sm">
              Central Master Webmail & Dovecot IMAP Live Stream
            </p>
          </div>

          {/* Primary Domain Status Banner */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/40 border border-blue-500/20 rounded-2xl p-4 mb-6 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Primary Server Domain</span>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {info?.primaryDomain || "mailserver10.com"}
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] text-blue-400 font-bold block">IMAPS Port</span>
                <span className="text-xs text-white font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">993 (SSL)</span>
              </div>
            </div>
          </div>

          {/* 1-Click Master Instant Access */}
          <div className="mb-6">
            <button
              onClick={handleQuickMasterLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:shadow-[0_0_35px_rgba(59,130,246,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-200 group-hover:scale-110 transition-transform">
                <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
              </svg>
              <span>1-Click Master IMAP Access (All Inbound)</span>
            </button>
          </div>

          <div className="relative flex py-2 items-center mb-5">
            <div className="flex-grow border-t border-white/[0.08]"></div>
            <span className="flex-shrink mx-4 text-xs font-mono uppercase text-gray-500 tracking-wider">or sign in with credentials</span>
            <div className="flex-grow border-t border-white/[0.08]"></div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-xs flex items-start gap-3 animate-shake">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Email Address / Username</label>
                {info?.defaultCredentials?.email && (
                  <span className="text-[10px] text-blue-400 font-mono">Primary Domain Account</span>
                )}
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-gray-600 font-mono"
                placeholder="admin@micorna.biz"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Password</label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all placeholder:text-gray-600 font-mono"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to IMAP Mailbox</span>
              )}
            </button>
          </form>

          {/* Quick links footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-400">
            <a href="/admin/imap" className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Admin IMAP Tab
            </a>
            <a href="/mailbox" className="hover:text-violet-400 transition-colors">
              User Mailbox &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
