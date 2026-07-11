"use client";

import { useState, useEffect } from "react";

interface ApiRouteSetting {
  id: string;
  method: string;
  path: string;
  desc: string;
  enabled: boolean;
  category: string;
  hits: number;
  auth?: boolean;
  variables?: string;
}

interface ApiSettingsProps {
  apiUrl: string;
}

export default function ApiSettingsManager({ apiUrl }: ApiSettingsProps) {
  const [routes, setRoutes] = useState<ApiRouteSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSettings = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/api-settings`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
        setError("");
      } else {
        throw new Error("Failed to load settings");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load API settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 5000); // Auto-refresh metrics every 5s
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    if (!apiUrl) return;

    // Optimistic UI update
    setRoutes(prev =>
      prev.map(r => (r.id === id ? { ...r, enabled: !currentStatus } : r))
    );

    try {
      const res = await fetch(`${apiUrl}/api/admin/api-settings/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !currentStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to save changes");
      }
      fetchSettings(); // Sync stats
    } catch (err: any) {
      // Revert optimistic update
      setRoutes(prev =>
        prev.map(r => (r.id === id ? { ...r, enabled: currentStatus } : r))
      );
      alert(`Error toggling API: ${err.message}`);
    }
  };

  const handleResetHits = async () => {
    if (!apiUrl) return;
    if (!window.confirm("Are you sure you want to reset all API hits to 0?")) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/api-settings/reset-hits`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to reset hits");
      }
      fetchSettings();
    } catch (err: any) {
      alert(`Error resetting hits: ${err.message}`);
    }
  };

  const getMethodBadgeColor = (method: string) => {
    if (method.includes("GET") && method.includes("POST")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (method === "GET") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    if (method === "POST") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (method === "DELETE") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  // Summarize stats
  const totalApis = routes.length;
  const activeApis = routes.filter(r => r.enabled).length;
  const disabledApis = totalApis - activeApis;
  const totalHits = routes.reduce((acc, r) => acc + r.hits, 0);

  const filteredRoutes = routes.filter(r =>
    r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top metrics bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-1 shadow-md">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Endpoints</span>
          <span className="text-2xl font-bold text-white font-mono">{totalApis}</span>
        </div>
        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-1 shadow-md">
          <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Active APIs</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono">{activeApis}</span>
        </div>
        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-1 shadow-md">
          <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Disabled APIs</span>
          <span className="text-2xl font-bold text-rose-400 font-mono">{disabledApis}</span>
        </div>
        <div className="bg-[#0D121F] border border-white/[0.04] p-5 rounded-2xl flex flex-col gap-1 shadow-md">
          <span className="text-[10px] uppercase font-bold text-purple-500 tracking-wider">Accumulated API Hits</span>
          <span className="text-2xl font-bold text-purple-400 font-mono">{totalHits}</span>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/[0.06] flex justify-between items-center flex-wrap gap-4 bg-[#111726]">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-white">Dynamic API Manager</h2>
            <p className="text-xs text-gray-400">Toggle API router paths on/off and inspect real-time transaction hits.</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/doc"
              target="_blank"
              className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-semibold text-xs px-3 py-2 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              API Docs
            </a>
            <button
              onClick={handleResetHits}
              className="text-red-400 hover:text-red-300 font-semibold text-xs px-3 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
            >
              Reset All Hits
            </button>
            <div className="relative">
              <input
                type="text"
                placeholder="Search routes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#090C15] border border-white/[0.06] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-52 placeholder:text-gray-600 font-mono"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-500 text-xs">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2 align-middle"></span>
            Loading settings configurations...
          </div>
        ) : error ? (
          <div className="p-16 text-center text-red-400 text-xs font-semibold">{error}</div>
        ) : filteredRoutes.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-xs">No matching API endpoints found.</div>
        ) : (
          <div className="flex flex-col p-6 gap-8">
            {[
              { title: "Receive Email APIs", routes: filteredRoutes.filter(r => r.category === "Mailbox UI") },
              { title: "Send Email APIs", routes: filteredRoutes.filter(r => r.id.startsWith("send-")) },
              { title: "Admin, System & Tools APIs", routes: filteredRoutes.filter(r => r.category !== "Mailbox UI" && !r.id.startsWith("send-")) },
            ].map(group => group.routes.length > 0 && (
              <div key={group.title} className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider pl-1 border-l-4 border-emerald-500">{group.title}</h3>
                <div className="overflow-x-auto rounded-xl border border-white/[0.05] bg-black/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-black/[0.15] text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">
                        <th className="py-4 px-6">Route Endpoint</th>
                        <th className="py-4 px-4 text-center">Auth</th>
                        <th className="py-4 px-4">Method</th>
                        <th className="py-4 px-4">Category</th>
                        <th className="py-4 px-4 text-center">Hits</th>
                        <th className="py-4 px-4 text-center">Status</th>
                        <th className="py-4 px-6 text-right">Switch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs">
                      {group.routes.map((route) => (
                        <tr key={route.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-emerald-300 font-semibold select-all">
                                {route.path}{route.variables && route.variables !== "None" && <span className="text-gray-500">{route.variables.startsWith("?") || route.variables.startsWith("Params") ? "" : " — "}{route.variables}</span>}
                              </span>
                              <span className="text-[11px] text-gray-400">{route.desc}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {route.auth ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-white/[0.08] bg-white/[0.02]">
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded border border-white/[0.08] bg-white/[0.02]">
                                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeColor(route.method)}`}>
                              {route.method}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-[10px] text-gray-400 font-semibold bg-white/[0.02] border border-white/[0.05] px-2 py-0.5 rounded">
                              {route.category}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-gray-300 font-bold">
                            {route.hits}
                          </td>
                          <td className="py-4 px-4 text-center">
                            {route.enabled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                Offline
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={route.enabled}
                                onChange={() => handleToggle(route.id, route.enabled)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation card */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5 text-purple-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          API Developer Integration Guide
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          Toggling an endpoint off blocks all client requests immediately, returning a standard <code className="text-rose-400 font-mono">503 Service Unavailable</code> error with custom administrator-disabled indicators. This allows dynamic routing control, debugging, and service locking on your production VPS.
        </p>
        <div className="bg-black/20 border border-white/[0.04] p-4 rounded-xl flex flex-col gap-2 font-mono text-[11px] text-gray-300">
          <span className="text-emerald-400">// API Error Payload Structure when disabled:</span>
          <span>HTTP/1.1 503 Service Unavailable</span>
          <span>Content-Type: application/json</span>
          <span className="text-rose-300">{`{
  "error": "Service Unavailable: This API endpoint has been disabled by the administrator"
}`}</span>
        </div>
      </div>
    </div>
  );
}
