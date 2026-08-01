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
import MailboxManager from "../components/MailboxManager";

const API_BASE = "http://localhost:8081";

interface AdminPageClientProps {
  tabSegment: string;
}

export function AdminPageClient({ tabSegment }: AdminPageClientProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrl] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

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
    setup: "setup-tab"
  };

  // Map active tab string to default URL path segment
  const tabStateToPath: Record<string, string> = {
    "overview-tab": "overview",
    "api-tab": "settings",
    "explorer-tab": "explorer",
    "logs-tab": "logs",
    "projects-tab": "projects",
    "mailbox-tab": "mailbox",
    "setup-tab": "setup"
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
            <span>mailbox Users</span>
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
            onClick={() => handleTabClick("setup-tab")}
            className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              activeTab === "setup-tab" 
                ? "rounded-none text-emerald-400 bg-emerald-500/10 shadow-[0_2px_12px_rgba(16,185,129,0.03)]" 
                : "rounded-none text-gray-400 hover:text-white hover:bg-white/[0.02]"
            }`}
          >
            {activeTab === "setup-tab" && (
              <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400"></span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143-.854-.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>System Setup</span>
          </button>

          {/* Separator before advanced sections */}
          <div className="mx-4 my-2 border-t border-white/[0.04]"></div>

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

          {activeTab === "setup-tab" && (
            <SetupManager apiUrl={apiUrl} />
          )}

          {activeTab === "api-tab" && (
            <ApiSettingsManager apiUrl={apiUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
