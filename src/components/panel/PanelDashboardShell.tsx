"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoginOverlay from "./LoginOverlay";
import LiveLogs from "./LiveLogs";
import MailExplorer from "./MailExplorer";
import ApiSettingsManager from "./ApiSettingsManager";
import Overview from "./Overview";
import ProjectsManager from "./ProjectsManager";
import DomainsManager from "./DomainsManager";
import PrimaryDomainManager from "./PrimaryDomainManager";
import DataSeedingManager from "./DataSeedingManager";
import CredentialsManager from "./CredentialsManager";
import MenuSetManager from "./MenuSetManager";
import { APP_VERSION } from "@/lib/version";

export interface PanelDashboardShellProps {
  mode: "admin" | "dev";
  basePath: string; // e.g. "/admin" or "/devpanel"
  tabSegment: string;
  loginEndpoint: string;
  statsEndpoint: string;
  tokenKey: string;
  superTokenKey?: string;
  panelLabel: string;
  accentColor: "emerald" | "violet";
  defaultUsername: string;
}

export function PanelDashboardShell({
  mode,
  basePath,
  tabSegment,
  loginEndpoint,
  statsEndpoint,
  tokenKey,
  superTokenKey,
  panelLabel,
  accentColor,
  defaultUsername,
}: PanelDashboardShellProps) {
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
    apisetting: "api-tab",
    apisettings: "api-tab",
    "api-setting": "api-tab",
    "api-settings": "api-tab",
    settings: "api-tab",
    api: "api-tab",
    seeding: "seeding-tab",
    "data-seeding": "seeding-tab",
    "seeding-data": "seeding-tab",
    credentials: "credentials-tab",
    smtp: "credentials-tab",
    explorer: "explorer-tab",
    mails: "explorer-tab",
    setup: "domains-tab",
    "menu-set": "menu-set-tab",
    "menu-settings": "menu-set-tab",
    "admin-menu": "menu-set-tab",
  };

  // Map active tab string to default URL path segment
  const tabStateToPath: Record<string, string> = {
    "overview-tab": "overview",
    "logs-tab": "logs",
    "domains-tab": "domains",
    "primary-domain-tab": "primary-domain",
    "projects-tab": "projects",
    "api-tab": "apisetting",
    "seeding-tab": "seeding",
    "credentials-tab": "credentials",
    "explorer-tab": "explorer",
    "menu-set-tab": "menu-set",
  };

  const rawActiveTab = tabPathMap[currentSegment] || "overview-tab";
  const activeTab = (mode === "admin" && (rawActiveTab === "explorer-tab" || rawActiveTab === "menu-set-tab" || rawActiveTab === "seeding-tab")) ? "overview-tab" : rawActiveTab;

  // Admin Sidebar Menu Visibility Config (Synced from DevPanel)
  const [adminMenuConfig, setAdminMenuConfig] = useState<Array<{ id: string; tab: string; path: string; enabled: boolean }>>([]);

  // Stats State
  const [stats, setStats] = useState({
    totalEmails: 0,
    totalReceivedEmails: 0,
    localEmailsCount: 0,
    liveEmailsCount: 0,
    domainsCount: 0,
    attachedDomainsCount: 0,
    primaryDomain: "",
    primaryDomainsCount: 0,
    activeDomainsCount: 0,
    pausedDomainsCount: 0,
    diskUsageBytes: 0,
    totalSentEmails: 0,
    sentEmailsCount: 0,
    activeMailboxesCount: 0,
    liveModeActive: false,
  });

  const handleLogout = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(`${tokenKey}_expiry`);
    if (superTokenKey) {
      localStorage.removeItem(superTokenKey);
    }
    if (mode === "dev") {
      localStorage.removeItem("dev_admin_token");
      localStorage.removeItem("dev_admin_token_expiry");
    }
    setIsAuthenticated(false);
    setIsStaticSuperAdmin(false);
  };

  // Determine API URL on client side & validate 24-hour session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname || "localhost";
      const protocol = window.location.protocol || "http:";
      const url = `${protocol}//${host}:8081`;
      setApiUrl(url);

      const token = localStorage.getItem(tokenKey) || (mode === "dev" ? localStorage.getItem("dev_admin_token") : null);
      const expiry = localStorage.getItem(`${tokenKey}_expiry`) || (mode === "dev" ? localStorage.getItem("dev_admin_token_expiry") : null);

      if (token) {
        if (expiry && Date.now() > Number(expiry)) {
          handleLogout();
        } else {
          if (!localStorage.getItem(tokenKey)) {
            localStorage.setItem(tokenKey, token);
          }
          setIsAuthenticated(true);
          if (superTokenKey && localStorage.getItem(superTokenKey) === "true") {
            setIsStaticSuperAdmin(true);
          }
        }
      }
      setLoading(false);
    }
  }, [tokenKey, superTokenKey, mode]);

  // Fetch Dashboard Stats on load / change
  useEffect(() => {
    if (!isAuthenticated || !apiUrl) return;
    let isMounted = true;
    const controller = new AbortController();

    const fetchStats = async () => {
      try {
        const token = localStorage.getItem(tokenKey) || (mode === "dev" ? localStorage.getItem("dev_admin_token") : null);
        const res = await fetch(`${apiUrl}${statsEndpoint}`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (res.status === 401 && isMounted) {
          handleLogout();
          return;
        }

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
  }, [isAuthenticated, apiUrl, tokenKey, statsEndpoint, mode]);

  // Fetch Admin Sidebar Menu configuration (for live sidebar visibility sync)
  useEffect(() => {
    if (!apiUrl) return;
    let isMounted = true;
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/admin-menu/config`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success && Array.isArray(data.menu)) {
            setAdminMenuConfig(data.menu);
          }
        }
      } catch (e) {}
    };
    fetchMenu();
    return () => { isMounted = false; };
  }, [apiUrl]);

  // Ensure Admin panel immediately redirects if someone navigates to a dev-only route
  useEffect(() => {
    if (mode === "admin" && (currentSegment === "seeding" || currentSegment === "data-seeding" || currentSegment === "seeding-data" || currentSegment === "menu-set" || currentSegment === "menu-settings" || currentSegment === "admin-menu")) {
      router.replace(`${basePath}/overview/`);
    }
  }, [mode, currentSegment, basePath, router]);

  const handleTabClick = (tabState: string) => {
    const path = tabStateToPath[tabState] || "overview";
    router.push(`${basePath}/${path}/`);
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
      <div className={`flex text-gray-100 h-screen w-screen relative overflow-hidden font-sans ${mode === "dev" ? "bg-[#080810]" : "bg-[#05070E]"}`}>
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
        <div className="flex-grow flex flex-col h-full relative z-10 overflow-hidden">
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
      <main className={`min-h-screen text-white flex flex-col justify-between ${mode === "dev" ? "bg-[#080810]" : "bg-[#05070E]"}`}>
        <LoginOverlay
          apiUrl={apiUrl}
          onLoginSuccess={() => setIsAuthenticated(true)}
          loginEndpoint={loginEndpoint}
          tokenKey={tokenKey}
          superTokenKey={superTokenKey}
          panelLabel={panelLabel}
          accentColor={accentColor}
          defaultUsername={defaultUsername}
        />
      </main>
    );
  }

  // Complete Navigation Items definition for Admin mode
  const allAdminNavItems = [
    {
      tab: "overview-tab",
      id: "overview-tab",
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
      id: "domains-tab",
      label: "Domains",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
    },
    {
      tab: "primary-domain-tab",
      id: "primary-domain-tab",
      label: "Primary Domain",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      tab: "projects-tab",
      id: "projects-tab",
      label: "Projects",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      tab: "credentials-tab",
      id: "credentials-tab",
      label: "SMTP / IMAP Auth",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
    },
    {
      tab: "explorer-tab",
      id: "explorer-tab",
      label: "Mail Explorer",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
    },
    {
      tab: "api-tab",
      id: "api-tab",
      label: "API Settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      tab: "logs-tab",
      id: "logs-tab",
      label: "Live Logs",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
  ];

  // Dynamically filter admin tabs based on DevPanel SuperAdmin toggle configuration
  const adminNavItems = allAdminNavItems.filter((item) => {
    if (adminMenuConfig.length === 0) {
      // Default: show standard tabs
      return !["credentials-tab", "explorer-tab"].includes(item.tab);
    }
    const found = adminMenuConfig.find((m) => m.id === item.id || m.tab === item.tab || m.path === item.tab.replace("-tab", ""));
    return found ? Boolean(found.enabled) : true;
  });

  // Navigation items for Dev mode
  const devCoreNavItems = [
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

  const devToolsNavItems = [
    {
      tab: "menu-set-tab",
      label: "Menu Set",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      ),
    },
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      ),
    },
    {
      tab: "api-tab",
      label: "Dev API Settings",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
    },
    {
      tab: "credentials-tab",
      label: "SMTP / IMAP Auth",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      ),
    },
    {
      tab: "logs-tab",
      label: "Live Logs Stream",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      tab: "explorer-tab",
      label: "Mail Explorer",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      ),
    },
  ];

  const isViolet = accentColor === "violet";
  const apiPrefix = mode === "dev" ? "/api/devpanel" : "/api/admin";

  return (
    <div className={`flex text-gray-100 h-screen w-screen relative overflow-hidden font-sans ${isViolet ? "bg-[#080810]" : "bg-[#05070E]"}`}>
      
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[280px] border-r flex flex-col z-50 shrink-0 h-full fixed lg:static top-0 bottom-0 left-0 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${
          isViolet
            ? "bg-[#0A0A1A]/95 border-violet-500/[0.08]"
            : "bg-[#070A13]/95 border-white/[0.04]"
        }`}
      >
        {/* Brand Header */}
        <div className={`p-6 border-b flex items-center justify-between ${isViolet ? "border-violet-500/[0.08]" : "border-white/[0.04]"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
              isViolet
                ? "bg-violet-500/15 border border-violet-500/30 text-violet-400 shadow-[0_0_18px_rgba(139,92,246,0.3)]"
                : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                <span>{isViolet ? "Dev Panel" : "Admin Panel"}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isViolet
                    ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>VPS</span>
              </span>
              <span className="text-[9px] font-semibold text-gray-400 tracking-wider font-mono mt-1">
                {isViolet ? "DEVELOPER CONTROL PANEL" : "ENTERPRISE CONTROL PANEL"}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-grow p-4 space-y-1 overflow-y-auto font-sans">
          {mode === "admin" ? (
            adminNavItems.map(({ tab, label, icon }) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 text-xs font-bold tracking-wide cursor-pointer transition-all duration-200 relative group overflow-hidden rounded-lg ${
                  activeTab === tab
                    ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_2px_12px_rgba(16,185,129,0.08)]"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                {activeTab === tab && (
                  <span className="absolute left-0 inset-y-0 w-[3px] bg-emerald-400 rounded-r"></span>
                )}
                {icon}
                <span>{label}</span>
              </button>
            ))
          ) : (
            <>
              {/* Dev Core Items */}
              {devCoreNavItems.map(({ tab, label, icon }) => (
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
              {devToolsNavItems.map(({ tab, label, icon }) => (
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
            </>
          )}
        </nav>

        {/* Footer: Stats + Quick Links + Logout */}
        <div className={`p-4 border-t space-y-3 ${isViolet ? "border-violet-500/[0.08]" : "border-white/[0.04]"}`}>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className={`text-[10px] font-bold font-mono ${isViolet ? "text-violet-400" : "text-emerald-400"}`}>
                {stats.totalReceivedEmails ?? stats.totalEmails ?? 0}
              </div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">Recv</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className={`text-[10px] font-bold font-mono ${isViolet ? "text-violet-400" : "text-emerald-400"}`}>
                {stats.domainsCount ?? 0}
              </div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">Domains</div>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
              <div className={`text-[10px] font-bold font-mono ${isViolet ? "text-violet-400" : "text-emerald-400"}`}>
                {stats.totalSentEmails ?? stats.sentEmailsCount ?? 0}
              </div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">Sent</div>
            </div>
          </div>

          {isViolet && (
            <a
              href="/devdoc"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg text-center no-underline bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 shadow-amber-500/5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              <span>Developer API Docs ↗</span>
            </a>
          )}

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
              <span className={`w-1.5 h-1.5 rounded-full ${isViolet ? "bg-violet-400" : "bg-emerald-400"}`}></span>
              <span>{isViolet ? "DevPanel" : "AdminPanel"}</span>
            </span>
            <span className="text-gray-400">{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* Right Content Pane */}
      <div className="flex-grow flex flex-col h-full relative z-10 overflow-y-auto">
        {/* Glow Background */}
        <div className={`absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-radial pointer-events-none z-0 rounded-full ${
          isViolet
            ? "from-[rgba(139,92,246,0.04)] via-[rgba(109,40,217,0.01)] to-transparent"
            : "from-[rgba(16,185,129,0.03)] via-[rgba(16,185,129,0.01)] to-transparent"
        }`}></div>

        {/* Mobile Header */}
        <header className={`lg:hidden p-4 border-b flex items-center relative z-10 backdrop-blur-md ${
          isViolet ? "border-violet-500/[0.08] bg-[#0A0A1A]/75" : "border-white/[0.04] bg-[#070A13]/75"
        }`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-2 rounded-xl border border-white/[0.06] bg-slate-900/40 hover:bg-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className={`ml-3 text-xs font-bold font-mono uppercase tracking-widest ${isViolet ? "text-violet-400" : "text-emerald-400"}`}>
            {isViolet ? "Dev Panel" : "Admin Panel"}
          </span>
        </header>

        {/* Dynamic Page Content Rendered Based on Active Tab */}
        <div className="p-8 flex-grow relative z-10">
          {activeTab === "overview-tab" && (
            <Overview apiUrl={apiUrl} stats={stats} apiPrefix={apiPrefix} tokenKey={tokenKey} isViolet={isViolet} />
          )}
          {activeTab === "logs-tab" && (
            <LiveLogs apiUrl={apiUrl} systemMode={stats.liveModeActive ? "Live" : "Local"} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "projects-tab" && (
            <ProjectsManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "domains-tab" && (
            <DomainsManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "primary-domain-tab" && (
            <PrimaryDomainManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "api-tab" && (
            <ApiSettingsManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "seeding-tab" && mode === "dev" && (
            <DataSeedingManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "credentials-tab" && (
            <CredentialsManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
          {activeTab === "explorer-tab" && (
            <MailExplorer apiUrl={apiUrl} />
          )}
          {activeTab === "menu-set-tab" && mode === "dev" && (
            <MenuSetManager apiUrl={apiUrl} apiPrefix={apiPrefix} tokenKey={tokenKey} />
          )}
        </div>
      </div>
    </div>
  );
}
export default PanelDashboardShell;
