"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LoginOverlay from "./components/LoginOverlay";
import CredentialsManager from "./components/CredentialsManager";
import LiveLogs from "./components/LiveLogs";
import MailExplorer from "./components/MailExplorer";
import ApiSettingsManager from "./components/ApiSettingsManager";
import Overview from "./components/Overview";

const API_BASE = "http://localhost:8081";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("overview-tab");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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

  if (!isAuthenticated) {
    return (
      <div className="bg-[#070A13] text-gray-100 min-h-screen relative overflow-x-hidden font-sans">
        <LoginOverlay apiUrl={apiUrl} onLoginSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="flex bg-[#070A13] text-gray-100 h-screen w-screen relative overflow-hidden font-sans">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Left Sidebar (Desktop permanent, Mobile overlay drawer) */}
      <aside className={`w-[280px] bg-[#090C16]/95 backdrop-blur-xl border-r border-white/[0.04] flex flex-col z-30 shrink-0 h-full transition-transform duration-300
        fixed inset-y-0 left-0 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        
        {/* Sidebar Brand Logo */}
        <div className="p-6 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5.5 h-5.5 text-black">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-widest text-white uppercase font-mono bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">TempEmail</span>
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider font-mono">Control Panel</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1.5 rounded-lg border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Admin profile crest */}
        <div className="p-5 border-b border-white/[0.04] bg-white/[0.01] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            AD
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Administrator</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Role: Superuser</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-grow p-4 flex flex-col gap-1.5 overflow-y-auto">
          <button
            onClick={() => {
              setActiveTab("overview-tab");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "overview-tab" 
                ? "text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("api-tab");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "api-tab" 
                ? "text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            <span>API Route Manager</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("credentials-tab");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "credentials-tab" 
                ? "text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            <span>SMTP Relay Credentials</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("explorer-tab");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "explorer-tab" 
                ? "text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <span>Global Mail Explorer</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("logs-tab");
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "logs-tab" 
                ? "text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <span>Live Server Logs</span>
          </button>
        </nav>

        {/* Logout section */}
        <div className="p-4 border-t border-white/[0.04]">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 px-4 py-3 rounded-2xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Right Content Pane */}
      <div className="flex-grow flex flex-col h-full relative z-10 overflow-y-auto bg-[#070A13]">
        {/* Glow Background */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-radial from-[rgba(16,185,129,0.04)] via-[rgba(5,150,105,0.01)] to-transparent pointer-events-none z-0 rounded-full"></div>

        {/* Top Navbar */}
        <header className="p-6 border-b border-white/[0.04] flex justify-between items-center relative z-10 flex-wrap gap-4 bg-[#090C16]/75 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-white p-2 rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <Link href="/" className="text-gray-400 hover:text-white transition-colors" title="Back to Home">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <h1 className="text-xs font-extrabold text-white uppercase tracking-widest font-mono">
              {activeTab === "overview-tab" && "System Ingestion Dashboard"}
              {activeTab === "api-tab" && "API Endpoint Router Settings"}
              {activeTab === "credentials-tab" && "Outbound SMTP Credentials"}
              {activeTab === "explorer-tab" && "Global Mail Database Explorer"}
              {activeTab === "logs-tab" && "Live SMTP Server Logs"}
            </h1>
          </div>
          
          <div className="flex gap-3 items-center">
            <div className="bg-emerald-500/5 border border-emerald-500/15 px-4 py-2 rounded-full flex items-center gap-2.5 text-xs text-emerald-400 font-bold uppercase tracking-wider font-mono shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Uptime Status: <strong className="font-mono text-white">100%</strong></span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="p-8 flex-grow relative z-10">
          {activeTab === "overview-tab" && (
            <Overview apiUrl={apiUrl} stats={stats} />
          )}

          {activeTab === "credentials-tab" && (
            <CredentialsManager apiUrl={apiUrl} />
          )}

          {activeTab === "logs-tab" && (
            <LiveLogs apiUrl={apiUrl} systemMode={stats.liveModeActive ? "Live" : "Local"} />
          )}

          {activeTab === "explorer-tab" && (
            <MailExplorer apiUrl={apiUrl} />
          )}

          {activeTab === "api-tab" && (
            <ApiSettingsManager apiUrl={apiUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
