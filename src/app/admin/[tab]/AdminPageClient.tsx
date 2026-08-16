"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import LoginOverlay from "../components/LoginOverlay";
import LiveLogs from "../components/LiveLogs";
import MailExplorer from "../components/MailExplorer";
import ApiSettingsManager from "../components/ApiSettingsManager";
import Overview from "../components/Overview";
import ProjectsManager from "../components/ProjectsManager";
import SetupManager from "../components/SetupManager";
import DomainsManager from "../components/DomainsManager";
import PrimaryDomainManager from "../components/PrimaryDomainManager";
import MailboxManager from "../components/MailboxManager";
import DataSeedingManager from "../components/DataSeedingManager";
import { APP_VERSION } from "@/lib/version";

const API_BASE = "http://localhost:8081";

interface AdminPageClientProps {
  tabSegment: string;
}

export function AdminPageClient({ tabSegment }: AdminPageClientProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrl] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isStaticSuperAdmin, setIsStaticSuperAdmin] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();

  // Extract the last segment from the URL pathname, ignoring any trailing slashes
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const currentSegment = pathParts.length > 1 ? pathParts[pathParts.length - 1] : tabSegment;

  // Map route segment to active tab string
  const tabPathMap: Record<string, string> = {
    overview: "overview-tab",
    settings: "api-tab",
    api: "api-tab",
    explorer: "explorer-tab",
    logs: "logs-tab",
    projects: "projects-tab",
    mailbox: "mailbox-tab",
    domains: "domains-tab",
    "primary-domain": "primary-domain-tab",
    "primary-domains": "primary-domain-tab",
    setup: "domains-tab",
    seeding: "seeding-tab",
    "data-seeding": "seeding-tab",
    "seeding-data": "seeding-tab"
  };

  // Map active tab string to default URL path segment
  const tabStateToPath: Record<string, string> = {
    "overview-tab": "overview",
    "api-tab": "settings",
    "explorer-tab": "explorer",
    "logs-tab": "logs",
    "projects-tab": "projects",
    "mailbox-tab": "mailbox",
    "domains-tab": "domains",
    "primary-domain-tab": "primary-domain",
    "setup-tab": "domains",
    "seeding-tab": "seeding"
  };

  const activeTab = tabPathMap[currentSegment] || "overview-tab";

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
      const host = window.location.hostname || "localhost";
      const protocol = window.location.protocol || "http:";
      const url = `${protocol}//${host}:8081`;
      setApiUrl(url);

      const token = localStorage.getItem("admin_token");
      if (token) {
        setIsAuthenticated(true);
        if (localStorage.getItem("admin_static_super") === "1") {
          setIsStaticSuperAdmin(true);
        }
      }
      setLoading(false);
    }
  }, []);

  // Poll Stats when authenticated
  useEffect(() => {
    if (!isAuthenticated || !apiUrl) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const res = await fetch(`${apiUrl}/api/admin/stats`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
          signal: controller.signal
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err: any) {
        // Silently ignore aborted/network drops to prevent Turbopack overlay triggers
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAuthenticated, apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_static_super");
    setIsAuthenticated(false);
    setIsStaticSuperAdmin(false);
  };

  const handleTabClick = (tabState: string) => {
    const path = tabStateToPath[tabState] || "overview";
    router.push(`/admin/${path}/`);
    setSidebarOpen(false);
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
      <div className="flex bg-[#070A13] text-gray-100 h-screen w-screen relative overflow-hidden font-sans">
        {/* Skeleton Sidebar */}
        <aside className="w-[280px] bg-[#090C16]/95 border-r border-white/[0.04] flex flex-col z-30 shrink-0 h-full hidden lg:flex p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] animate-pulse"></div>
            <div className="flex flex-col gap-2">
              <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse"></div>
              <div className="h-2 w-16 bg-white/[0.05] rounded animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 w-full bg-white/[0.03] rounded-lg animate-pulse"></div>
            ))}
          </div>
        </aside>

        {/* Skeleton Right Pane */}
        <div className="flex-grow flex flex-col h-full relative z-10 overflow-hidden bg-[#070A13]">
          {/* Skeleton Header */}
          <header className="p-6 border-b border-white/[0.04] flex justify-between items-center bg-[#090C16]/75">
            <div className="h-4 w-48 bg-white/[0.05] rounded animate-pulse"></div>
            <div className="h-8 w-32 bg-emerald-500/[0.05] rounded-full animate-pulse"></div>
          </header>
          
          {/* Skeleton Content Area */}
          <div className="p-8 flex-grow space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 h-96 bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse"></div>
              <div className="lg:col-span-5 h-96 bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-[#070A13] text-gray-100 h-screen w-screen overflow-hidden relative font-sans">
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
              <span className="font-extrabold text-sm tracking-widest text-white uppercase font-mono bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">Admin Panel</span>
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
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white truncate">Administrator</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Role: Superuser</span>
            {isStaticSuperAdmin && (
              <span className="inline-flex items-center gap-1 w-fit text-[9px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
                  <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75zm4.196 5.954a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.04a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Super Admin
              </span>
            )}
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-grow p-4 flex flex-col gap-1.5 overflow-y-auto">
          <button
            onClick={() => handleTabClick("overview-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "overview-tab" 
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "overview-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
            <span>Overview</span>
          </button>

          <button
            onClick={() => handleTabClick("domains-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "domains-tab" || activeTab === "setup-tab"
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {(activeTab === "domains-tab" || activeTab === "setup-tab") && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <span>Domains</span>
          </button>

          <button
            onClick={() => handleTabClick("primary-domain-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "primary-domain-tab" 
                ? "rounded-none text-amber-400 bg-amber-500/10 shadow-[0_2px_12px_rgba(245,158,11,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "primary-domain-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-amber-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <span>Primary Domain</span>
          </button>

          {/* DEV Section Divider with Horizontal Line and Centered Badge */}
          {isStaticSuperAdmin && (
            <>
              <div className="relative my-4 px-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-white/[0.08]"></div>
                </div>
                <div className="relative flex items-center justify-center">
                  <span className="bg-[#090C16] px-2.5 text-[9px] font-mono font-bold tracking-widest uppercase text-emerald-400/90 border border-emerald-500/20 rounded-full py-0.5 shadow-sm">
                    DEV
                  </span>
                </div>
              </div>

              {/* DEV Section Navigation Buttons */}
              <button
                onClick={() => handleTabClick("projects-tab")}
                className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                  activeTab === "projects-tab"
                    ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]"
                    : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
                }`}
              >
                {activeTab === "projects-tab" && (
                  <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span>Projects & Webhooks</span>
              </button>
            </>
          )}

          <button
            onClick={() => handleTabClick("mailbox-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "mailbox-tab" 
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "mailbox-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span>Users Mailbox</span>
          </button>

          <button
            onClick={() => handleTabClick("logs-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "logs-tab" 
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "logs-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <span>Server Logs</span>
          </button>

          <button
            onClick={() => handleTabClick("api-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "api-tab" 
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "api-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            <span>API Route Manager</span>
          </button>

          {isStaticSuperAdmin && (
            <button
              onClick={() => handleTabClick("seeding-tab")}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                activeTab === "seeding-tab"
                  ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]"
                  : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              {activeTab === "seeding-tab" && (
                <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
              <span>Data Seeding</span>
            </button>
          )}
        </nav>

        {/* Logout section */}
        <div className="p-4 border-t border-white/[0.04] space-y-2.5">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Logout</span>
          </button>
          <div className="flex items-center justify-between px-2 text-[10px] font-mono text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Online</span>
            </span>
            <span className="text-gray-400">{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* Right Content Pane */}
      <div className="flex-grow flex flex-col h-full relative z-10 overflow-y-auto bg-[#070A13]">
        {/* Glow Background */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-radial from-[rgba(16,185,129,0.04)] via-[rgba(5,150,105,0.01)] to-transparent pointer-events-none z-0 rounded-full"></div>

        {/* Top Navbar - Only visible on mobile for sidebar toggle */}
        <header className="lg:hidden p-4 border-b border-white/[0.04] flex items-center relative z-10 bg-[#090C16]/75 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-2 rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        {/* Page Content Body */}
        <div className="p-8 flex-grow relative z-10">
          {activeTab === "overview-tab" && (
            <Overview apiUrl={apiUrl} stats={stats} />
          )}

          {activeTab === "logs-tab" && (
            <LiveLogs apiUrl={apiUrl} systemMode={stats.liveModeActive ? "Live" : "Local"} />
          )}

          {activeTab === "projects-tab" && (
            <ProjectsManager apiUrl={apiUrl} />
          )}

          {activeTab === "mailbox-tab" && (
            <MailboxManager apiUrl={apiUrl} />
          )}

          {(activeTab === "domains-tab" || activeTab === "setup-tab") && (
            <DomainsManager apiUrl={apiUrl} />
          )}

          {activeTab === "primary-domain-tab" && (
            <PrimaryDomainManager apiUrl={apiUrl} />
          )}

          {activeTab === "api-tab" && (
            <ApiSettingsManager apiUrl={apiUrl} />
          )}

          {activeTab === "seeding-tab" && (
            <DataSeedingManager apiUrl={apiUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
