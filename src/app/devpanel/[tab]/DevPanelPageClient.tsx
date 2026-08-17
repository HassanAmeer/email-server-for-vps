"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoginOverlay from "../../admin/components/LoginOverlay";
import LiveLogs from "../../admin/components/LiveLogs";
import ApiSettingsManager from "../../admin/components/ApiSettingsManager";
import Overview from "../../admin/components/Overview";
import ProjectsManager from "../../admin/components/ProjectsManager";
import DomainsManager from "../../admin/components/DomainsManager";
import PrimaryDomainManager from "../../admin/components/PrimaryDomainManager";
import DataSeedingManager from "../../admin/components/DataSeedingManager";
import CredentialsManager from "../../admin/components/CredentialsManager";
import MailExplorer from "../../admin/components/MailExplorer";
import { APP_VERSION } from "@/lib/version";

// DevPanel constants
const DEVPANEL_TOKEN_KEY = "devpanel_token";
const DEVPANEL_API_PREFIX = "/api/devpanel";

interface DevPanelPageClientProps {
  tabSegment: string;
}

export function DevPanelPageClient({ tabSegment }: DevPanelPageClientProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiUrl, setApiUrl] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();

  const pathParts = (pathname || "").split("/").filter(Boolean);
  const currentSegment = pathParts.length > 1 ? pathParts[pathParts.length - 1] : tabSegment;

  const tabPathMap: Record<string, string> = {
    overview: "overview-tab",
    logs: "logs-tab",
    domains: "domains-tab",
    "primary-domain": "primary-domain-tab",
    "primary-domains": "primary-domain-tab",
    mailbox: "primary-domain-tab",
    mailboxes: "primary-domain-tab",
    "users-mailbox": "primary-domain-tab",
    "user-mailbox": "primary-domain-tab",
    webmail: "primary-domain-tab",
    projects: "projects-tab",
    settings: "api-tab",
    api: "api-tab",
    seeding: "seeding-tab",
    "data-seeding": "seeding-tab",
    credentials: "credentials-tab",
    smtp: "credentials-tab",
    explorer: "explorer-tab",
    mails: "explorer-tab",
  };

  const tabStateToPath: Record<string, string> = {
    "overview-tab": "overview",
    "logs-tab": "logs",
    "domains-tab": "domains",
    "primary-domain-tab": "primary-domain",
    "projects-tab": "projects",
    "api-tab": "settings",
    "seeding-tab": "seeding",
    "credentials-tab": "credentials",
    "explorer-tab": "explorer",
  };

  const activeTab = tabPathMap[currentSegment] || "overview-tab";

  const [stats, setStats] = useState({
    totalEmails: 0,
    activeMailboxesCount: 0,
    diskUsageBytes: 0,
    liveModeActive: false,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname || "localhost";
      const protocol = window.location.protocol || "http:";
      const url = `${protocol}//${host}:8081`;
      setApiUrl(url);
      const token = localStorage.getItem(DEVPANEL_TOKEN_KEY) || localStorage.getItem("dev_admin_token");
      if (token) {
        if (!localStorage.getItem(DEVPANEL_TOKEN_KEY)) {
          localStorage.setItem(DEVPANEL_TOKEN_KEY, token);
        }
        setIsAuthenticated(true);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !apiUrl) return;
    let isMounted = true;
    const controller = new AbortController();
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem(DEVPANEL_TOKEN_KEY) || localStorage.getItem("dev_admin_token");
        const res = await fetch(`${apiUrl}${DEVPANEL_API_PREFIX}/stats`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err: any) {}
    };
    fetchStats();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAuthenticated, apiUrl]);

  const handleLogout = () => {
    localStorage.removeItem(DEVPANEL_TOKEN_KEY);
    localStorage.removeItem("dev_admin_token");
    setIsAuthenticated(false);
  };

  const handleTabClick = (tabState: string) => {
    const path = tabStateToPath[tabState] || "overview";
    router.push(`/devpanel/${path}/`);
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
      <div className="flex bg-[#080810] text-gray-100 h-screen w-screen relative overflow-hidden font-sans">
        <aside className="w-[280px] bg-[#0A0A1A]/95 border-r border-white/[0.04] flex flex-col z-30 shrink-0 h-full hidden lg:flex p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] animate-pulse"></div>
            <div className="flex flex-col gap-2">
              <div className="h-3 w-24 bg-white/[0.05] rounded animate-pulse"></div>
              <div className="h-2 w-16 bg-white/[0.05] rounded animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="h-11 w-full bg-white/[0.03] rounded-lg animate-pulse"></div>
            ))}
          </div>
        </aside>
        <div className="flex-grow flex flex-col h-full relative z-10 overflow-hidden bg-[#080810]">
          <header className="p-6 border-b border-white/[0.04] flex justify-between items-center bg-[#0A0A1A]/75">
            <div className="h-4 w-48 bg-white/[0.05] rounded animate-pulse"></div>
            <div className="h-8 w-32 bg-amber-500/[0.05] rounded-full animate-pulse"></div>
          </header>
          <div className="p-8 flex-grow space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-[#080810] text-gray-100 h-screen w-screen overflow-hidden relative font-sans">
        <LoginOverlay
          apiUrl={apiUrl}
          onLoginSuccess={() => setIsAuthenticated(true)}
          loginEndpoint={`${DEVPANEL_API_PREFIX}/login`}
          tokenKey={DEVPANEL_TOKEN_KEY}
          superTokenKey={undefined}
          panelLabel="DEV PANEL"
          accentColor="violet"
          defaultUsername="devpanel"
        />
      </div>
    );
  }

  // Sidebar navigation sections (ALL tabs always visible for devpanel)
  const coreNavItems = [
    {
      tab: "overview-tab",
      label: "Overview",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
        </svg>
      ),
    },
    {
      tab: "domains-tab",
      label: "Domains",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
    },
    {
      tab: "primary-domain-tab",
      label: "Primary Domain",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
  ];

  const devNavItems = [
    {
      tab: "projects-tab",
      label: "Projects & Webhooks",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      tab: "seeding-tab",
      label: "Data Seeding",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
    },
    {
      tab: "api-tab",
      label: "API Route Manager",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      ),
    },
    {
      tab: "credentials-tab",
      label: "SMTP Relay Users",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
    },
    {
      tab: "logs-tab",
      label: "Server Logs",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
    },
    {
      tab: "explorer-tab",
      label: "Mail Explorer",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex bg-[#080810] text-gray-100 h-screen w-screen relative overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[280px] bg-[#0A0A1A]/95 border-r border-violet-500/[0.12] flex flex-col z-50 shrink-0 h-full transition-transform duration-300 ease-in-out fixed lg:static top-0 bottom-0 left-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-violet-500/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-purple-400 flex items-center justify-center shadow-lg shadow-violet-500/25 ring-1 ring-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block">DEV PANEL</span>
              <span className="text-[10px] text-violet-400 font-mono tracking-widest block uppercase font-bold">Developer Center</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-grow p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          {/* Core Section */}
          <div className="px-3 pt-1 pb-1 text-[9px] font-bold uppercase tracking-widest font-mono text-gray-500">
            Core Management
          </div>
          {coreNavItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-200 relative group overflow-hidden rounded-lg ${
                activeTab === tab
                  ? "text-violet-300 bg-violet-500/15 border border-violet-500/30 shadow-[0_2px_12px_rgba(139,92,246,0.08)]"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {activeTab === tab && (
                <span className="absolute left-0 inset-y-0 w-[3px] bg-violet-400 rounded-r"></span>
              )}
              {icon}
              <span>{label}</span>
            </button>
          ))}

          {/* Dev Tools Section Divider */}
          <div className="relative my-3 px-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-violet-500/[0.12]"></div>
            </div>
            <div className="relative flex items-center justify-center">
              <span className="bg-[#0A0A1A] px-2.5 text-[8px] font-mono font-bold tracking-widest uppercase text-violet-400 border border-violet-500/30 rounded-full py-0.5 shadow-sm">
                DEV TOOLS & SERVICES
              </span>
            </div>
          </div>

          {/* Dev Tools Nav Items */}
          {devNavItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`w-full flex items-center gap-3.5 px-4 py-2.5 text-xs font-bold tracking-wide cursor-pointer transition-all duration-200 relative group overflow-hidden rounded-lg ${
                activeTab === tab
                  ? "text-violet-300 bg-violet-500/15 border border-violet-500/30 shadow-[0_2px_12px_rgba(139,92,246,0.08)]"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {activeTab === tab && (
                <span className="absolute left-0 inset-y-0 w-[3px] bg-violet-400 rounded-r"></span>
              )}
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer: Stats + Logout */}
        <div className="p-4 border-t border-violet-500/[0.08] space-y-3">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-violet-400 font-mono">{stats.totalEmails}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">Emails</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-violet-400 font-mono">{stats.activeMailboxesCount}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">Boxes</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className="text-[10px] font-bold text-violet-400 font-mono">{formatBytes(stats.diskUsageBytes).split(" ")[0]}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">{formatBytes(stats.diskUsageBytes).split(" ")[1] || "KB"}</div>
            </div>
          </div>

          <a
            href="/devdoc"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/5 text-center no-underline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-amber-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <span>Developer API Docs ↗</span>
          </a>

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
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              <span>DevPanel</span>
            </span>
            <span className="text-gray-400">{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* Right Content Pane */}
      <div className="flex-grow flex flex-col h-full relative z-10 overflow-y-auto bg-[#080810]">
        {/* Violet Glow Background */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-radial from-[rgba(139,92,246,0.04)] via-[rgba(109,40,217,0.01)] to-transparent pointer-events-none z-0 rounded-full"></div>

        {/* Mobile Header */}
        <header className="lg:hidden p-4 border-b border-violet-500/[0.08] flex items-center relative z-10 bg-[#0A0A1A]/75 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-2 rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="ml-3 text-xs font-bold text-violet-400 font-mono uppercase tracking-widest">Dev Panel</span>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-grow relative z-10">
          {activeTab === "overview-tab" && (
            <Overview apiUrl={apiUrl} stats={stats} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "logs-tab" && (
            <LiveLogs apiUrl={apiUrl} systemMode={stats.liveModeActive ? "Live" : "Local"} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "projects-tab" && (
            <ProjectsManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "domains-tab" && (
            <DomainsManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "primary-domain-tab" && (
            <PrimaryDomainManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "api-tab" && (
            <ApiSettingsManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "seeding-tab" && (
            <DataSeedingManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "credentials-tab" && (
            <CredentialsManager apiUrl={apiUrl} apiPrefix={DEVPANEL_API_PREFIX} tokenKey={DEVPANEL_TOKEN_KEY} />
          )}
          {activeTab === "explorer-tab" && (
            <MailExplorer apiUrl={apiUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
