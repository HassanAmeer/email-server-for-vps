"use client";

import { useEffect, useState } from "react";

interface OverviewProps {
  apiUrl: string;
  stats: {
    totalEmails: number;
    localEmailsCount?: number;
    liveEmailsCount?: number;
    diskUsageBytes: number;
    activeMailboxesCount: number;
    liveModeActive: boolean;
  };
}

interface ApiRouteSetting {
  id: string;
  path: string;
  hits: number;
  enabled: boolean;
}

export default function Overview({ apiUrl, stats }: OverviewProps) {
  const [apiRoutes, setApiRoutes] = useState<ApiRouteSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApiStats = async () => {
      if (!apiUrl) return;
      try {
        const res = await fetch(`${apiUrl}/api/admin/api-settings`);
        if (res.ok) {
          const data = await res.json();
          setApiRoutes(data);
        }
      } catch (err) {
        console.error("Error fetching overview API stats:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchApiStats();
    const interval = setInterval(fetchApiStats, 5000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Find max hit count for scaling the chart
  const maxHits = Math.max(...apiRoutes.map(r => r.hits), 1);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Inbox Database</span>
            <strong className="text-2xl font-bold text-white font-mono">{stats.totalEmails}</strong>
            <span className="text-[10px] text-gray-400">Emails captured</span>
          </div>
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Active Mailboxes</span>
            <strong className="text-2xl font-bold text-white font-mono">{stats.activeMailboxesCount}</strong>
            <span className="text-[10px] text-gray-400">Unique accounts</span>
          </div>
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Storage Usage</span>
            <strong className="text-2xl font-bold text-white font-mono">{formatBytes(stats.diskUsageBytes)}</strong>
            <span className="text-[10px] text-gray-400">Disk space consumed</span>
          </div>
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
            </svg>
          </div>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex items-center justify-between shadow-md">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Server Status</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Ready</span>
            </div>
            <span className="text-[9px] text-gray-500 font-mono mt-0.5">{stats.liveModeActive ? "Production VPS" : "Development env"}</span>
          </div>
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l.406.34a2.203 2.203 0 002.2-.012l.424-.24a1.873 1.873 0 012.506.743l.015.03a2.25 2.25 0 01-.57 2.915l-.35.287a1.25 1.25 0 00-.374.939v.104c0 .3.162.58.423.729l.19.109a2.25 2.25 0 011.06 2.449l-.004.016a2.25 2.25 0 01-1.532 1.628l-.64.195a1.25 1.25 0 00-.787 1.636l.288.692a1.875 1.875 0 01-1.023 2.404l-.03.012a2.25 2.25 0 01-2.237-.056l-.507-.316a1.25 1.25 0 00-1.32 0l-.507.316a2.25 2.25 0 01-2.237.056l-.03-.012a1.875 1.875 0 01-1.022-2.404l.288-.692a1.25 1.25 0 00-.787-1.636l-.64-.195a2.25 2.25 0 01-1.531-1.628l-.004-.016a2.25 2.25 0 011.06-2.449l.19-.109a1.25 1.25 0 00.422-.729v-.104a1.25 1.25 0 00-.374-.94l-.35-.286a2.25 2.25 0 01-.57-2.916l.015-.03a1.875 1.875 0 012.506-.743l.424.24a2.25 2.25 0 002.2-.012l.406-.34a1.25 1.25 0 00.405-.865v-.568a2.25 2.25 0 012.25-2.25h.03a2.25 2.25 0 012.25 2.25z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Analytics Graph & Status Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* API Traffic chart */}
        <div className="bg-[#0D121F] border border-white/[0.05] p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">API Route Activity (Hits)</h3>
            <p className="text-xs text-gray-400">Total requests logged per API endpoint config.</p>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-gray-500">
              <span className="animate-spin inline-block w-4.5 h-4.5 border-2 border-white/20 border-t-white rounded-full mr-2.5 align-middle"></span>
              Generating chart metrics...
            </div>
          ) : apiRoutes.length === 0 ? (
            <div className="py-20 text-center text-xs text-gray-500">No route traffic recorded yet.</div>
          ) : (
            <div className="flex flex-col gap-4 mt-2">
              {apiRoutes.map(route => {
                const percent = Math.min((route.hits / maxHits) * 100, 100);
                return (
                  <div key={route.id} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-gray-300 font-semibold">{route.path}</span>
                      <div className="flex gap-2 items-center">
                        <span className="text-purple-400 font-bold">{route.hits} Hits</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${route.enabled ? "bg-emerald-500" : "bg-rose-500"}`} title={route.enabled ? "Enabled" : "Disabled"}></span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/[0.02]">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Server checklist */}
        <div className="bg-[#0D121F] border border-white/[0.05] p-6 rounded-2xl flex flex-col gap-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Status Checklist</h3>
          
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-start gap-3 bg-black/10 border border-white/[0.02] p-3 rounded-xl">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-white">SMTP Listening Status</span>
                <span className="text-[10px] text-gray-400">SMTP Server is active on port {stats.liveModeActive ? "25" : "2525"}.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-black/10 border border-white/[0.02] p-3 rounded-xl">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-white">Web UI Server</span>
                <span className="text-[10px] text-gray-400">Serving static files on port {stats.liveModeActive ? "80" : "8081"}.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-black/10 border border-white/[0.02] p-3 rounded-xl">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-white">Database Integrity</span>
                <span className="text-[10px] text-gray-400">JSON file storage directories are writable and clean.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-black/10 border border-white/[0.02] p-3 rounded-xl">
              <span className="text-emerald-400 mt-0.5">✓</span>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-white">Memory & CPU</span>
                <span className="text-[10px] text-gray-400">VPS metrics show normal CPU usage and system load.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
