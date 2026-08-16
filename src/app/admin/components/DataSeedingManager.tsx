"use client";

import { useState, useEffect } from "react";

interface DataSeedingManagerProps {
  apiUrl: string;
}

interface SeedStatus {
  totalEmails: number;
  localEmailsCount: number;
  liveEmailsCount: number;
  logsCount: number;
  projectsCount: number;
  domainsCount: number;
  primaryDomain: string | null;
  mailboxUsersCount: number;
  apiHitsCount: number;
  diskUsageBytes: number;
  liveModeActive: boolean;
}

interface ActivityLogItem {
  id: string;
  time: string;
  type: "success" | "info" | "warn" | "error";
  message: string;
}

export default function DataSeedingManager({ apiUrl }: DataSeedingManagerProps) {
  const [status, setStatus] = useState<SeedStatus>({
    totalEmails: 0,
    localEmailsCount: 0,
    liveEmailsCount: 0,
    logsCount: 0,
    projectsCount: 0,
    domainsCount: 0,
    primaryDomain: null,
    mailboxUsersCount: 0,
    apiHitsCount: 0,
    diskUsageBytes: 0,
    liveModeActive: false,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modular Seeding Configs
  const [emailCount, setEmailCount] = useState<number>(10);
  const [logCount, setLogCount] = useState<number>(100);

  // Confirm Modal state for Reset
  const [confirmResetModal, setConfirmResetModal] = useState<"emails" | "logs" | "all" | null>(null);

  // Activity Logs
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: "init",
      time: new Date().toLocaleTimeString(),
      type: "info",
      message: "Data Seeding Manager ready. Select any module or use Quick Seed All.",
    },
  ]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const addLog = (message: string, type: "success" | "info" | "warn" | "error" = "info") => {
    setActivityLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const fetchStatus = async () => {
    if (!apiUrl) return;
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
      const res = await fetch(`${apiUrl}/api/admin/seed/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.warn("Failed to fetch seed status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const runSeedAction = async (action: string, payload: Record<string, any> = {}) => {
    if (!apiUrl) return;
    setActionLoading(action);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
      const res = await fetch(`${apiUrl}/api/admin/seed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || "Operation completed successfully!", "success");
        addLog(data.message || `Action ${action} succeeded`, "success");
        fetchStatus();
      } else {
        const errMsg = data.error || "Failed to execute seed operation";
        showToast(errMsg, "error");
        addLog(`Error: ${errMsg}`, "error");
      }
    } catch (err: any) {
      const errMsg = err.message || "Network error occurred";
      showToast(errMsg, "error");
      addLog(`Network Error: ${errMsg}`, "error");
    } finally {
      setActionLoading(null);
      setConfirmResetModal(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all transform animate-slide-in ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300 shadow-emerald-950/50"
              : toast.type === "error"
              ? "bg-red-950/90 border-red-500/40 text-red-300 shadow-red-950/50"
              : "bg-cyan-950/90 border-cyan-500/40 text-cyan-300 shadow-cyan-950/50"
          }`}
        >
          {toast.type === "success" && (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === "error" && (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === "info" && (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/80 via-[#0B0F19]/90 to-slate-900/80 p-6 md:p-8 rounded-3xl border border-white/[0.06] backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Developer Toolkit
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Data Seeding & Demo Generator
          </h1>
          <p className="text-xs md:text-sm text-gray-400 max-w-2xl leading-relaxed">
            Quickly populate or reset your system with realistic mock emails, server audit logs, domains, projects, and 7-day traffic analytics for testing and demonstration.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-gray-300 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Live System Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] p-4.5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/30 transition-all group">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Seeded Emails</span>
            <span className="text-emerald-400/80 group-hover:text-emerald-400 transition-colors">✉</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{status.totalEmails}</span>
            <span className="text-[10px] font-mono text-gray-500">
              ({status.liveEmailsCount} live, {status.localEmailsCount} local)
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] p-4.5 rounded-2xl flex flex-col justify-between hover:border-cyan-500/30 transition-all group">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>System Logs</span>
            <span className="text-cyan-400/80 group-hover:text-cyan-400 transition-colors">📋</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{status.logsCount}</span>
            <span className="text-[10px] font-mono text-gray-500">events logged</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] p-4.5 rounded-2xl flex flex-col justify-between hover:border-amber-500/30 transition-all group">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Active Domains</span>
            <span className="text-amber-400/80 group-hover:text-amber-400 transition-colors">🌐</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{status.domainsCount}</span>
            <span className="text-[10px] font-mono text-amber-400/80 truncate max-w-[90px]">
              {status.primaryDomain || "None"}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] p-4.5 rounded-2xl flex flex-col justify-between hover:border-purple-500/30 transition-all group">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>API Projects</span>
            <span className="text-purple-400/80 group-hover:text-purple-400 transition-colors">💼</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{status.projectsCount}</span>
            <span className="text-[10px] font-mono text-gray-500">{status.apiHitsCount} hits</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] p-4.5 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 transition-all group">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Disk Storage</span>
            <span className="text-blue-400/80 group-hover:text-blue-400 transition-colors">💾</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{formatBytes(status.diskUsageBytes)}</span>
            <span className="text-[10px] font-mono text-gray-500">JSON + Media</span>
          </div>
        </div>
      </div>

      {/* Quick Master Seed (One-Click Banner) */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-500/30 p-6 md:p-8 rounded-3xl backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1.5 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold font-mono tracking-wider uppercase border border-emerald-500/30">
            <span>⚡ Recommended Instant Setup</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">
            Seed Complete Demo Environment
          </h2>
          <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
            One-click population: seeds <strong className="text-emerald-400">10 rich inbox emails</strong> (Stripe, GitHub, AWS OTPs), <strong className="text-emerald-400">100 system audit logs</strong>, primary domain (<code className="text-amber-300">micorna.biz</code>), secondary domain (<code className="text-amber-300">visakara.org</code>), <strong className="text-emerald-400">3 demo projects</strong> with API keys, and <strong className="text-emerald-400">7-day traffic analytics</strong> for the overview chart.
          </p>
        </div>

        <button
          onClick={() => runSeedAction("all")}
          disabled={actionLoading !== null}
          className="w-full md:w-auto shrink-0 px-8 py-4 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] border border-emerald-400/40 flex items-center justify-center gap-3 cursor-pointer relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading === "all" ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Seeding All Data...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
              <span>Seed All Demo Data</span>
            </>
          )}
        </button>
      </div>

      {/* Modular Seeding Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Demo Emails */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-emerald-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Demo Inbox Emails</h3>
                  <span className="text-[11px] text-gray-400">Max 10 realistic emails</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                Count: {emailCount}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Generates rich mock messages from Stripe, GitHub, AWS (with OTP 849210), PayPal receipts, Google Cloud alerts, and PDF invoices.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-gray-400 font-mono">
                <span>1 email</span>
                <span className="text-emerald-400 font-bold">{emailCount} emails</span>
                <span>10 emails</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={emailCount}
                onChange={(e) => setEmailCount(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">Stripe Invoice</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">AWS OTP Code</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">GitHub Alert</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">PDF Attachments</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => runSeedAction("emails", { count: emailCount })}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "emails" ? (
                <span className="animate-spin text-emerald-400">⏳</span>
              ) : (
                <span>📧</span>
              )}
              <span>Seed {emailCount} Demo Emails</span>
            </button>
          </div>
        </div>

        {/* Card 2: Server Logs */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-cyan-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">System & Audit Logs</h3>
                  <span className="text-[11px] text-gray-400">Max 100 realistic entries</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20">
                Count: {logCount}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Generates historical system events spanning the last 48 hours across SMTP Inbound, DKIM verify, SPF checks, API requests, and Auth logins.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-gray-400 font-mono">
                <span>10 logs</span>
                <span className="text-cyan-400 font-bold">{logCount} logs</span>
                <span>100 logs</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={logCount}
                onChange={(e) => setLogCount(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">SMTP_RECEIVE</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">DKIM_VERIFY</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">API_AUTH</span>
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">SUCCESS/WARN</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => runSeedAction("logs", { count: logCount })}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "logs" ? (
                <span className="animate-spin text-cyan-400">⏳</span>
              ) : (
                <span>📝</span>
              )}
              <span>Seed {logCount} System Logs</span>
            </button>
          </div>
        </div>

        {/* Card 3: Domains & Primary Domain */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-amber-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Primary & Attached Domains</h3>
                  <span className="text-[11px] text-gray-400">micorna.biz & visakara.org</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                2 Domains
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Configures <strong className="text-amber-400">micorna.biz</strong> as Primary Domain with prefix <code className="text-amber-300">admin</code> and <strong className="text-gray-300">visakara.org</strong> as secondary attached domain.
            </p>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono">micorna.biz</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">PRIMARY (admin)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-mono">visakara.org</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">ATTACHED (my)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => runSeedAction("domains")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "domains" ? (
                <span className="animate-spin text-amber-400">⏳</span>
              ) : (
                <span>🌐</span>
              )}
              <span>Seed & Sync Domains</span>
            </button>
          </div>
        </div>

        {/* Card 4: Projects & API Keys */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-purple-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Projects & API Keys</h3>
                  <span className="text-[11px] text-gray-400">Scoped API integration</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20">
                3 Projects
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Creates realistic applications with unique API keys (<code className="text-purple-300">pk_live_...</code>), webhook listeners, and active retention settings.
            </p>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04] space-y-1.5 text-[11px] font-mono text-gray-400">
              <div>• Enterprise Notification Gateway</div>
              <div>• Mobile Auth & OTP Verification</div>
              <div>• E-Commerce Storefront Bot</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => runSeedAction("projects")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "projects" ? (
                <span className="animate-spin text-purple-400">⏳</span>
              ) : (
                <span>💼</span>
              )}
              <span>Seed 3 Demo Projects</span>
            </button>
          </div>
        </div>

        {/* Card 5: Traffic Analytics & Overview */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-blue-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">7-Day Traffic Analytics</h3>
                  <span className="text-[11px] text-gray-400">Overview Dashboard Curve</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                7 Days
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Populates 7 days of generated & received mail traffic data and API route hit counters so the Admin Overview SVG charts and route manager tables look active and dynamic.
            </p>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04] space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Avg Daily Inbound:</span>
                <span className="text-blue-400 font-bold">~45 emails/day</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Daily Generated:</span>
                <span className="text-cyan-400 font-bold">~32 emails/day</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => runSeedAction("analytics")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "analytics" ? (
                <span className="animate-spin text-blue-400">⏳</span>
              ) : (
                <span>📈</span>
              )}
              <span>Seed Traffic & Hit Counts</span>
            </button>
          </div>
        </div>

        {/* Card 6: Danger Zone / Reset Controls */}
        <div className="bg-[#0D121F]/90 border border-red-500/20 hover:border-red-500/40 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-300">Purge / Reset Data</h3>
                  <span className="text-[11px] text-gray-400">Clean up seeded records</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                Danger
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Safely clear test emails, wipe SQLite system logs, or perform a full clean reset to bring the database back to clean state.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setConfirmResetModal("emails")}
                disabled={actionLoading !== null}
                className="py-2 px-3 rounded-xl text-[11px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
              >
                Clear Emails
              </button>
              <button
                onClick={() => setConfirmResetModal("logs")}
                disabled={actionLoading !== null}
                className="py-2 px-3 rounded-xl text-[11px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => setConfirmResetModal("all")}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/40"
            >
              <span>🗑️</span>
              <span>Full Environment Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Activity & Console Log Output */}
      <div className="bg-[#090C16] border border-white/[0.06] rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <h3 className="text-sm font-bold text-white tracking-wide">Seeding Activity Console</h3>
            <span className="text-[10px] font-mono text-gray-500">Live Terminal Stream</span>
          </div>
          <button
            onClick={() =>
              setActivityLogs([
                {
                  id: "cleared",
                  time: new Date().toLocaleTimeString(),
                  type: "info",
                  message: "Console log cleared.",
                },
              ])
            }
            className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
          >
            Clear Console
          </button>
        </div>

        <div className="font-mono text-xs space-y-2 max-h-56 overflow-y-auto pr-2">
          {activityLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-gray-300 hover:bg-white/[0.02] p-1 rounded transition-colors">
              <span className="text-gray-500 shrink-0 select-none">[{log.time}]</span>
              <span
                className={`font-bold shrink-0 ${
                  log.type === "success"
                    ? "text-emerald-400"
                    : log.type === "error"
                    ? "text-red-400"
                    : log.type === "warn"
                    ? "text-amber-400"
                    : "text-cyan-400"
                }`}
              >
                {log.type === "success" ? "✓" : log.type === "error" ? "✗" : log.type === "warn" ? "!" : "ℹ"}
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal for Reset Actions */}
      {confirmResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0F1422] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Data Reset</h3>
                <span className="text-xs text-gray-400">Irreversible operation</span>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {confirmResetModal === "emails" && "Are you sure you want to delete all demo emails and wipe temporary mailbox JSON files from disk?"}
              {confirmResetModal === "logs" && "Are you sure you want to clear all SQLite system audit logs and project API logs?"}
              {confirmResetModal === "all" && "Are you sure you want to completely purge all demo emails, system logs, and reset API hit counters?"}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmResetModal(null)}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmResetModal === "emails") runSeedAction("clear_emails");
                  else if (confirmResetModal === "logs") runSeedAction("clear_logs");
                  else if (confirmResetModal === "all") runSeedAction("clear_all");
                }}
                disabled={actionLoading !== null}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-600/30 cursor-pointer flex items-center gap-2"
              >
                {actionLoading ? <span className="animate-spin">⏳</span> : <span>Proceed & Purge</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
