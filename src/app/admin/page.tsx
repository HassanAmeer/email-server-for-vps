"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LoginOverlay from "./components/LoginOverlay";
import CredentialsManager from "./components/CredentialsManager";
import LiveLogs from "./components/LiveLogs";
import MailExplorer from "./components/MailExplorer";

const API_BASE = "http://localhost:8081";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("credentials-tab");

  // Stats State
  const [stats, setStats] = useState({
    totalEmails: 0,
    activeMailboxesCount: 0,
    diskUsageBytes: 0,
    liveModeActive: false,
  });

  // Determine API URL on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          ? API_BASE
          : `${window.location.protocol}//${window.location.host}`;
      setApiUrl(url);

      const token = localStorage.getItem("admin_token");
      if (token) {
        setIsAuthenticated(true);
      }
      setLoading(false);
    }
  }, []);

  // Poll Stats when authenticated
  useEffect(() => {
    if (!isAuthenticated || !apiUrl) return;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/admin/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Error loading stats:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated, apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setIsAuthenticated(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="bg-[#070A13] text-gray-100 min-h-screen flex items-center justify-center font-sans">
        <div className="text-sm font-semibold tracking-wider text-gray-400 animate-pulse">
          INITIALIZING SECURE SESSION...
        </div>
      </div>
    );
  }

  return (
    <div className="live-console-theme bg-[#070A13] text-gray-100 min-h-screen relative overflow-x-hidden font-sans">
      {/* Glow Background */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-radial from-[rgba(16,185,129,0.06)] via-[rgba(5,150,105,0.01)] to-transparent pointer-events-none z-0 rounded-full"></div>

      {/* LOGIN OVERLAY */}
      {!isAuthenticated && (
        <LoginOverlay apiUrl={apiUrl} onLoginSuccess={() => setIsAuthenticated(true)} />
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-[1300px] w-full mx-auto p-8 relative z-10 flex flex-col gap-6 min-h-screen">
        {/* Top Navbar */}
        <header className="flex justify-between items-center pb-4 border-b border-white/[0.06] flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors" title="Back to Home">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7 text-emerald-400 animate-pulse">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              <span>TempEmail <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Admin</span></span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Control Panel</span>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={handleLogout}
              className="bg-transparent border border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/20 text-gray-400 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* SYSTEM STATS GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Stat 1 */}
          <div className="bg-slate-900/40 border border-white/[0.05] p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Mail Database</span>
              <strong className="text-2xl font-bold text-white">{stats.totalEmails}</strong>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
          {/* Stat 2 */}
          <div className="bg-slate-900/40 border border-white/[0.05] p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active Mailboxes</span>
              <strong className="text-2xl font-bold text-white">{stats.activeMailboxesCount}</strong>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
          {/* Stat 3 */}
          <div className="bg-slate-900/40 border border-white/[0.05] p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Storage Used</span>
              <strong className="text-2xl font-bold text-white">{formatBytes(stats.diskUsageBytes)}</strong>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
              </svg>
            </div>
          </div>
          {/* Stat 4 */}
          <div className="bg-slate-900/40 border border-white/[0.05] p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">System Mode</span>
              {stats.liveModeActive ? (
                <strong className="text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 w-fit mt-1">
                  Live Mode
                </strong>
              ) : (
                <strong className="text-xs font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full border border-sky-500/20 w-fit mt-1">
                  Local Mode
                </strong>
              )}
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l.406.34a2.203 2.203 0 002.2-.012l.424-.24a1.873 1.873 0 012.506.743l.015.03a2.25 2.25 0 01-.57 2.915l-.35.287a1.25 1.25 0 00-.374.939v.104c0 .3.162.58.423.729l.19.109a2.25 2.25 0 011.06 2.449l-.004.016a2.25 2.25 0 01-1.532 1.628l-.64.195a1.25 1.25 0 00-.787 1.636l.288.692a1.875 1.875 0 01-1.023 2.404l-.03.012a2.25 2.25 0 01-2.237-.056l-.507-.316a1.25 1.25 0 00-1.32 0l-.507.316a2.25 2.25 0 01-2.237.056l-.03-.012a1.875 1.875 0 01-1.022-2.404l.288-.692a1.25 1.25 0 00-.787-1.636l-.64-.195a2.25 2.25 0 01-1.531-1.628l-.004-.016a2.25 2.25 0 011.06-2.449l.19-.109a1.25 1.25 0 00.422-.729v-.104a1.25 1.25 0 00-.374-.94l-.35-.286a2.25 2.25 0 01-.57-2.916l.015-.03a1.875 1.875 0 012.506-.743l.424.24a2.25 2.25 0 002.2-.012l.406-.34a1.25 1.25 0 00.405-.865v-.568a2.25 2.25 0 012.25-2.25h.03a2.25 2.25 0 012.25 2.25z" />
              </svg>
            </div>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <nav className="flex gap-3 bg-white/[0.02] p-1.5 rounded-xl border border-white/[0.06] w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("credentials-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
              activeTab === "credentials-tab"
                ? "text-white bg-white/[0.05]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            <span>SMTP Relay Credentials</span>
          </button>

          <button
            onClick={() => setActiveTab("logs-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
              activeTab === "logs-tab"
                ? "text-white bg-white/[0.05]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <span>Live Server Logs</span>
          </button>

          <button
            onClick={() => setActiveTab("explorer-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${
              activeTab === "explorer-tab"
                ? "text-white bg-white/[0.05]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <span>Global Mail Explorer</span>
          </button>
        </nav>

        {/* CONTENT PANES */}
        <div className="flex-grow min-h-[500px] flex">
          {activeTab === "credentials-tab" && (
            <CredentialsManager apiUrl={apiUrl} />
          )}

          {activeTab === "logs-tab" && (
            <LiveLogs apiUrl={apiUrl} systemMode={stats.liveModeActive ? "Live" : "Local"} />
          )}

          {activeTab === "explorer-tab" && (
            <MailExplorer apiUrl={apiUrl} />
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-4 pt-6 border-t border-white/[0.06] mt-auto">
          <p className="text-xs text-gray-500 font-mono">
            TempEmail Server Console &bull; Security Auth Active &bull; DigitalOcean VPS Ingestion
          </p>
        </footer>
      </main>
    </div>
  );
}
