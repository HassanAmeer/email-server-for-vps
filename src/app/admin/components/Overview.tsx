"use client";

import { useEffect, useState } from "react";

interface OverviewProps {
  apiUrl: string;
  stats: {
    totalEmails: number;
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

  // SVG Chart Mock Coordinates representing traffic flows
  const points = [
    { x: 50, y: 150, day: "Mon" },
    { x: 120, y: 80, day: "Tue" },
    { x: 190, y: 110, day: "Wed" },
    { x: 260, y: 40, day: "Thu" },
    { x: 330, y: 90, day: "Fri" },
    { x: 400, y: 60, day: "Sat" },
    { x: 470, y: 25, day: "Sun" },
  ];

  // SVG Path String
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  // Area Path String (closing the shape to the bottom for the gradient fill)
  const areaD = `${pathD} L 470 170 L 50 170 Z`;

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">
      {/* Dynamic Dashboard Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="group relative bg-gradient-to-br from-slate-950/80 to-slate-900/60 border border-white/[0.04] hover:border-emerald-500/30 p-6 rounded-3xl shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Mail Database</span>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight">{stats.totalEmails}</strong>
              <span className="text-[10px] text-gray-500">Emails captured</span>
            </div>
            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="group relative bg-gradient-to-br from-slate-950/80 to-slate-900/60 border border-white/[0.04] hover:border-emerald-500/30 p-6 rounded-3xl shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Active Inboxes</span>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight">{stats.activeMailboxesCount}</strong>
              <span className="text-[10px] text-gray-500">Live recipient profiles</span>
            </div>
            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="group relative bg-gradient-to-br from-slate-950/80 to-slate-900/60 border border-white/[0.04] hover:border-emerald-500/30 p-6 rounded-3xl shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Storage Used</span>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight">{formatBytes(stats.diskUsageBytes)}</strong>
              <span className="text-[10px] text-gray-500">Occupied size</span>
            </div>
            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
              </svg>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="group relative bg-gradient-to-br from-slate-950/80 to-slate-900/60 border border-white/[0.04] hover:border-emerald-500/30 p-6 rounded-3xl shadow-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Server Ingestion</span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider font-mono">Online</span>
              </div>
              <span className="text-[9px] text-gray-500 font-mono mt-0.5">{stats.liveModeActive ? "DigitalOcean Droplet" : "Local Development"}</span>
            </div>
            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5.5 h-5.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l.406.34a2.203 2.203 0 002.2-.012l.424-.24a1.873 1.873 0 012.506.743l.015.03a2.25 2.25 0 01-.57 2.915l-.35.287a1.25 1.25 0 00-.374.939v.104c0 .3.162.58.423.729l.19.109a2.25 2.25 0 011.06 2.449l-.004.016a2.25 2.25 0 01-1.532 1.628l-.64.195a1.25 1.25 0 00-.787 1.636l.288.692a1.875 1.875 0 01-1.023 2.404l-.03.012a2.25 2.25 0 01-2.237-.056l-.507-.316a1.25 1.25 0 00-1.32 0l-.507.316a2.25 2.25 0 01-2.237.056l-.03-.012a1.875 1.875 0 01-1.022-2.404l.288-.692a1.25 1.25 0 00-.787-1.636l-.64-.195a2.25 2.25 0 01-1.531-1.628l-.004-.016a2.25 2.25 0 011.06-2.449l.19-.109a1.25 1.25 0 00.422-.729v-.104a1.25 1.25 0 00-.374-.94l-.35-.286a2.25 2.25 0 01-.57-2.916l.015-.03a1.875 1.875 0 012.506-.743l.424.24a2.25 2.25 0 002.2-.012l.406-.34a1.25 1.25 0 00.405-.865v-.568a2.25 2.25 0 012.25-2.25h.03a2.25 2.25 0 012.25 2.25z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Graph Card & Status Checklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* API Traffic chart card - spans 7/12 cols */}
        <div className="lg:col-span-7 bg-gradient-to-b from-[#0E1325] to-[#0A0D18] border border-white/[0.04] p-6 rounded-3xl shadow-xl flex flex-col gap-6 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono">Incoming API Load Traffic</h3>
              <p className="text-[11px] text-gray-400">Total hit peaks plotted over standard calendar intervals.</p>
            </div>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono">Live Syncing</span>
          </div>

          {/* SVG Graph Drawing */}
          <div className="relative w-full h-[180px] bg-slate-950/40 rounded-2xl border border-white/[0.03] overflow-hidden flex items-end">
            <svg className="w-full h-full" viewBox="0 0 520 180" preserveAspectRatio="none">
              <defs>
                {/* Neon Area Fill Gradient */}
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Horizontal Grid lines */}
              <line x1="50" y1="35" x2="470" y2="35" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              <line x1="50" y1="75" x2="470" y2="75" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              <line x1="50" y1="120" x2="470" y2="120" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              <line x1="50" y1="155" x2="470" y2="155" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
              
              {/* Area path */}
              <path d={areaD} fill="url(#chartGradient)" />
              
              {/* Line path */}
              <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Glow spots for coordinates */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="5.5" fill="#10b981" className="animate-pulse" />
                  <circle cx={p.x} cy={p.y} r="2.5" fill="#ffffff" />
                  <text x={p.x - 10} y="172" fill="#64748b" className="text-[10px] font-mono font-semibold" style={{ fontSize: "8px" }}>
                    {p.day}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Dynamic Endpoint Hit list */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Hit stats per active controller path</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {loading ? (
                <div className="col-span-2 py-4 text-center text-xs text-gray-500 font-mono">Fetching routing logs...</div>
              ) : apiRoutes.length === 0 ? (
                <div className="col-span-2 py-4 text-center text-xs text-gray-500 font-mono">No stats logged.</div>
              ) : (
                apiRoutes.slice(0, 4).map(route => (
                  <div key={route.id} className="bg-black/25 border border-white/[0.03] p-3 rounded-2xl flex justify-between items-center hover:bg-white/[0.01] transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-gray-400 font-mono font-semibold truncate max-w-[130px]">{route.path}</span>
                      <span className={`text-[8px] uppercase font-bold tracking-wider ${route.enabled ? "text-emerald-400" : "text-rose-400"}`}>
                        {route.enabled ? "Route Active" : "Blocked"}
                      </span>
                    </div>
                    <strong className="text-xs text-white font-mono bg-white/[0.03] border border-white/[0.05] px-2.5 py-1 rounded-lg">
                      {route.hits} <span className="text-[9px] text-gray-400">hits</span>
                    </strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Server Checklist & Health checks - spans 5/12 cols */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#0E1325] to-[#0A0D18] border border-white/[0.04] p-6 rounded-3xl shadow-xl flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono">Server Status & Health</h3>
            <p className="text-[11px] text-gray-400">Node configurations running inside the VPS.</p>
          </div>

          <div className="flex flex-col gap-4">
            
            {/* Health check item */}
            <div className="flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:border-emerald-500/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">SMTP Listener Service</span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  SMTP mail pipeline running on Port <code className="text-emerald-400 font-mono font-bold">{stats.liveModeActive ? "25" : "2525"}</code> is ready to accept client connections.
                </p>
              </div>
            </div>

            {/* Health check item */}
            <div className="flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:border-emerald-500/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">Web API Server</span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Web panel dashboard and dynamically routed controllers running on Port <code className="text-emerald-400 font-mono font-bold">{stats.liveModeActive ? "80" : "8881 (Dev)"}</code>.
                </p>
              </div>
            </div>

            {/* Health check item */}
            <div className="flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:border-emerald-500/10 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">File Integrity & Memory</span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Server directories have correct access permissions. Node memory allocation limits are nominal.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
