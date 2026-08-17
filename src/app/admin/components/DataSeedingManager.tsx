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

interface DataCategory {
  id: string;
  name: string;
  icon: string;
  desc: string;
  countKey: string;
  badge: string;
  color: string;
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

  // Multi-select targets for selective deletion
  const [selectedTargets, setSelectedTargets] = useState<string[]>([
    "emails",
    "logs",
    "domains",
    "primary_domain",
    "mailboxes",
    "projects",
    "hits",
  ]);

  // Confirm Modal state for Reset Actions
  const [confirmModal, setConfirmModal] = useState<{
    type: "selective" | "all" | "single";
    target?: string;
    targetName?: string;
  } | null>(null);

  // Activity Logs
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: "init",
      time: new Date().toLocaleTimeString(),
      type: "info",
      message: "Data Seeding & Cleanup Manager ready. Select items to seed or selectively delete any category.",
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
      setConfirmModal(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Available Data Categories for Selective Deletion
  const dataCategories: DataCategory[] = [
    {
      id: "emails",
      name: "Inbox & Temp Emails",
      icon: "✉️",
      desc: "All incoming & temporary mailbox JSON files on disk + received_emails & generated_emails in database.",
      countKey: `${status.totalEmails} emails (${formatBytes(status.diskUsageBytes)})`,
      badge: status.totalEmails > 0 ? "Active" : "Empty",
      color: "emerald",
    },
    {
      id: "logs",
      name: "System & Audit Logs",
      icon: "📋",
      desc: "All SQLite system audit events (SMTP receive, DKIM verification, Auth events, system cron).",
      countKey: `${status.logsCount} log events`,
      badge: status.logsCount > 0 ? "Active" : "Empty",
      color: "cyan",
    },
    {
      id: "primary_domain",
      name: "Primary Domain Configuration",
      icon: "⭐",
      desc: "Primary active email domain configuration (micorna.biz with admin prefix).",
      countKey: status.primaryDomain || "None configured",
      badge: status.primaryDomain ? "Configured" : "None",
      color: "amber",
    },
    {
      id: "domains",
      name: "Secondary Attached Domains",
      icon: "🌐",
      desc: "All secondary custom attached domains (e.g. visakara.org with prefix routing).",
      countKey: `${status.domainsCount} total domains`,
      badge: status.domainsCount > 0 ? "Active" : "Empty",
      color: "blue",
    },
    {
      id: "mailboxes",
      name: "Permanent Mailbox Users",
      icon: "📬",
      desc: "Permanent registered IMAP user accounts stored in SQLite mailbox_users.",
      countKey: `${status.mailboxUsersCount} mailbox users`,
      badge: status.mailboxUsersCount > 0 ? "Active" : "Empty",
      color: "indigo",
    },
    {
      id: "projects",
      name: "API Projects & Webhooks",
      icon: "💼",
      desc: "Client API integration projects with scoped API keys (pk_live_...) and webhook listeners.",
      countKey: `${status.projectsCount} active projects`,
      badge: status.projectsCount > 0 ? "Active" : "Empty",
      color: "purple",
    },
    {
      id: "hits",
      name: "API Traffic & Hit Counters",
      icon: "📊",
      desc: "Aggregate API endpoint hit counters in api_settings and 7-day traffic activity logs.",
      countKey: `${status.apiHitsCount} recorded hits`,
      badge: status.apiHitsCount > 0 ? "Active" : "0 Hits",
      color: "teal",
    },
  ];

  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectAllTargets = () => {
    setSelectedTargets(dataCategories.map((c) => c.id));
  };

  const deselectAllTargets = () => {
    setSelectedTargets([]);
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            Data Seeding & Data Cleaner
          </h1>
          <p className="text-xs md:text-sm text-gray-400 max-w-2xl leading-relaxed">
            Seed realistic demo data (emails, logs, projects, traffic stats) or selectively choose which data categories to delete (emails, domains, logs, primary domains, mailbox accounts).
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
            <span>Total Emails</span>
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
            <span>⚡ Instant Demo Generator</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">
            Seed Complete Demo Environment
          </h2>
          <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
            One-click population: seeds <strong className="text-emerald-400">10 rich inbox emails</strong>, <strong className="text-emerald-400">100 system audit logs</strong>, primary domain (<code className="text-amber-300">micorna.biz</code>), secondary domain (<code className="text-amber-300">visakara.org</code>), <strong className="text-emerald-400">3 demo projects</strong> with API keys, and <strong className="text-emerald-400">7-day traffic analytics</strong> for the charts.
          </p>
        </div>

        <button
          onClick={() => runSeedAction("all")}
          disabled={actionLoading !== null}
          className="w-full md:w-auto shrink-0 px-8 py-4 rounded-2xl font-extrabold text-sm text-emerald-400 hover:text-white bg-transparent hover:bg-emerald-500/15 active:scale-95 transition-all border border-emerald-500/60 hover:border-emerald-400 flex items-center justify-center gap-3 cursor-pointer relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <h3 className="text-base font-bold text-white">Inbox Emails</h3>
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
              <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded border border-white/[0.04]">PDF Files</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => runSeedAction("emails", { count: emailCount })}
              disabled={actionLoading !== null}
              className="flex-grow py-2.5 px-3 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "emails" ? <span className="animate-spin">⏳</span> : <span>📧</span>}
              <span>Seed {emailCount} Emails</span>
            </button>
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_emails", targetName: "Inbox Emails" })}
              disabled={actionLoading !== null}
              title="Clear all stored emails"
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🗑️ Clear</span>
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
              Generates historical system events spanning SMTP Inbound, DKIM verify, SPF checks, API requests, and Auth logins.
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
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => runSeedAction("logs", { count: logCount })}
              disabled={actionLoading !== null}
              className="flex-grow py-2.5 px-3 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "logs" ? <span className="animate-spin">⏳</span> : <span>📝</span>}
              <span>Seed {logCount} Logs</span>
            </button>
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_logs", targetName: "System Logs" })}
              disabled={actionLoading !== null}
              title="Clear all system logs"
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🗑️ Clear</span>
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
                  <h3 className="text-base font-bold text-white">Primary & Domains</h3>
                  <span className="text-[11px] text-gray-400">{status.domainsCount} Active Domains</span>
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

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => runSeedAction("domains")}
              disabled={actionLoading !== null}
              className="flex-grow py-2.5 px-3 rounded-xl text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "domains" ? <span className="animate-spin text-amber-400">⏳</span> : <span>🌐</span>}
              <span>Seed Domains</span>
            </button>
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_domains", targetName: "Attached Domains" })}
              disabled={actionLoading !== null}
              title="Clear attached domains"
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🗑️ Clear</span>
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
                  <span className="text-[11px] text-gray-400">{status.projectsCount} Active Projects</span>
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

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => runSeedAction("projects")}
              disabled={actionLoading !== null}
              className="flex-grow py-2.5 px-3 rounded-xl text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "projects" ? <span className="animate-spin">⏳</span> : <span>💼</span>}
              <span>Seed Projects</span>
            </button>
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_projects", targetName: "API Projects" })}
              disabled={actionLoading !== null}
              title="Clear all API projects"
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🗑️ Clear</span>
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
                  <h3 className="text-base font-bold text-white">7-Day Traffic Stats</h3>
                  <span className="text-[11px] text-gray-400">{status.apiHitsCount} API Hits</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                7 Days
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Populates 7 days of generated & received mail traffic data and API route hit counters so the Admin Overview SVG charts look active and dynamic.
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

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => runSeedAction("analytics")}
              disabled={actionLoading !== null}
              className="flex-grow py-2.5 px-3 rounded-xl text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading === "analytics" ? <span className="animate-spin">⏳</span> : <span>📈</span>}
              <span>Seed Traffic Stats</span>
            </button>
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_hits", targetName: "Traffic & Hits" })}
              disabled={actionLoading !== null}
              title="Reset all API route hit counts"
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>🔄 Reset Hits</span>
            </button>
          </div>
        </div>

        {/* Card 6: Mailboxes & Accounts */}
        <div className="bg-[#0D121F]/90 border border-white/[0.06] hover:border-indigo-500/30 p-6 rounded-3xl backdrop-blur-xl flex flex-col justify-between transition-all group relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Mailbox Users</h3>
                  <span className="text-[11px] text-gray-400">{status.mailboxUsersCount} Permanent Users</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                Accounts
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Permanent mailbox accounts used for IMAP mail storage and third-party email client integrations.
            </p>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/[0.04] space-y-1 text-xs text-gray-400 font-mono">
              <div className="flex justify-between">
                <span>IMAP Accounts:</span>
                <span className="text-indigo-400 font-bold">{status.mailboxUsersCount} users</span>
              </div>
              <div className="flex justify-between">
                <span>Auth Protocol:</span>
                <span className="text-gray-300">Mailbox SQL / Passwd</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => setConfirmModal({ type: "single", target: "clear_mailboxes", targetName: "Permanent Mailboxes" })}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>🗑️</span>
              <span>Clear Permanent Mailbox Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Activity & Console Log Output */}
      <div className="bg-[#090C16] border border-white/[0.06] rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <h3 className="text-sm font-bold text-white tracking-wide">Seeding & Cleanup Activity Console</h3>
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

      {/* ========================================================================= */}
      {/* SELECTIVE DATA DELETION MATRIX — compact, bottom of page                  */}
      {/* ========================================================================= */}
      <div className="bg-[#0F1220]/80 border border-red-500/15 rounded-2xl p-4 md:p-6 backdrop-blur-xl relative overflow-hidden shadow-xl space-y-4">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-red-500/8 rounded-full blur-3xl pointer-events-none"></div>

        {/* Compact Header & Bulk Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">🧹 Data Cleaner</span>
            <p className="text-xs text-gray-500 hidden md:block">Select categories to permanently delete</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={selectAllTargets}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              All
            </button>
            <button
              onClick={deselectAllTargets}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.08] text-gray-500 hover:text-white transition-all cursor-pointer"
            >
              None
            </button>
            <button
              onClick={() => setConfirmModal({ type: "selective" })}
              disabled={selectedTargets.length === 0 || actionLoading !== null}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow shadow-red-600/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete ({selectedTargets.length})
            </button>
            <button
              onClick={() => setConfirmModal({ type: "all" })}
              disabled={actionLoading !== null}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-red-300 bg-red-600/15 hover:bg-red-600/40 border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              💥 Wipe All
            </button>
          </div>
        </div>

        {/* Compact Category Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 relative z-10">
          {dataCategories.map((cat) => {
            const isSelected = selectedTargets.includes(cat.id);
            return (
              <div
                key={cat.id}
                onClick={() => toggleTarget(cat.id)}
                className={`px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                  isSelected
                    ? "bg-red-950/25 border-red-500/40"
                    : "bg-[#090C16]/60 border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 shrink-0 rounded text-red-600 bg-slate-800 border-white/[0.1] cursor-pointer accent-red-500"
                  />
                  <span className="text-sm shrink-0">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate group-hover:text-red-300 transition-colors">{cat.name}</p>
                    <p className="text-[10px] font-mono text-gray-500 truncate">{cat.countKey}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmModal({ type: "single", target: `clear_${cat.id}`, targetName: cat.name });
                  }}
                  disabled={actionLoading !== null}
                  title={`Delete ${cat.name}`}
                  className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/30 border border-red-500/15 transition-all cursor-pointer"
                >
                  Del
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal for Reset Actions */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0F1422] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scale-up">
            <div className="flex items-center gap-3.5 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {confirmModal.type === "all"
                    ? "Confirm Complete Server Reset"
                    : confirmModal.type === "selective"
                    ? `Confirm Deletion of ${selectedTargets.length} Categories`
                    : `Confirm Deletion: ${confirmModal.targetName}`}
                </h3>
                <span className="text-xs text-gray-400">Permanent and irreversible action</span>
              </div>
            </div>

            <div className="text-xs text-gray-300 leading-relaxed space-y-3">
              {confirmModal.type === "selective" && (
                <div className="space-y-2">
                  <p>You have selected the following <strong className="text-red-400">{selectedTargets.length} data categories</strong> to permanently delete:</p>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/[0.06] space-y-1.5 font-mono text-[11px]">
                    {selectedTargets.map((t) => {
                      const matched = dataCategories.find((c) => c.id === t);
                      return (
                        <div key={t} className="flex items-center justify-between text-gray-300">
                          <span className="flex items-center gap-1.5">
                            <span>{matched?.icon}</span>
                            <span>{matched?.name || t}</span>
                          </span>
                          <span className="text-red-400 font-bold">{matched?.countKey}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {confirmModal.type === "single" && (
                <p>
                  Are you sure you want to permanently delete all data records for <strong className="text-red-400">{confirmModal.targetName}</strong>?
                </p>
              )}

              {confirmModal.type === "all" && (
                <div className="space-y-2">
                  <p className="font-bold text-red-300">This will completely wipe all 7 data layers on the server:</p>
                  <ul className="list-disc pl-4 space-y-1 text-gray-400">
                    <li>All email JSON files, attachments, and disk folders</li>
                    <li>All SQLite audit logs and project API logs</li>
                    <li>All secondary attached domains</li>
                    <li>All client API projects and scoped keys</li>
                    <li>All API route hit counts and 7-day traffic points</li>
                    <li>Run database VACUUM to reclaim storage space</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.type === "selective") {
                    runSeedAction("clear_selective", { targets: selectedTargets });
                  } else if (confirmModal.type === "single" && confirmModal.target) {
                    runSeedAction(confirmModal.target);
                  } else if (confirmModal.type === "all") {
                    runSeedAction("clear_all");
                  }
                }}
                disabled={actionLoading !== null}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-600/30 cursor-pointer flex items-center gap-2"
              >
                {actionLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>Proceed & Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
