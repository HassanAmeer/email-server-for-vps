"use client";

import { useState, useEffect } from "react";

interface LiveLogsProps {
  apiUrl: string;
  systemMode: "Live" | "Local";
}

export default function LiveLogs({ apiUrl, systemMode }: LiveLogsProps) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async (page: number) => {
    if (!apiUrl) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/dblogs/all?page=${page}&limit=${pagination.limit}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching system logs:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(pagination.page);
  }, [apiUrl, pagination.page]);

  const handleClearLogs = async () => {
    if (!confirm(`Are you sure you want to clear all system logs?`)) return;
    
    setClearing(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/dblogs/all`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        setPagination(prev => ({ ...prev, page: 1 }));
        fetchLogs(1);
      } else {
        alert("Failed to clear logs.");
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
      alert("Error clearing logs.");
    } finally {
      setClearing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "SUCCESS") return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">SUCCESS</span>;
    if (status === "ERROR") return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">ERROR</span>;
    return <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">INFO</span>;
  };

  const getTypeBadge = (type: string) => {
    if (type === "RECEIVE") return <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">RECEIVE</span>;
    if (type === "SEND") return <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">SEND</span>;
    return <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20 text-[10px] font-bold">{type}</span>;
  };

  return (
    <section className="tab-pane w-full flex flex-col gap-6 animate-fade-in" id="logs-tab">
      
      {/* Top Level Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Server System Logs</h2>
          <p className="text-sm text-gray-400 mt-1">Real-time processing events for email reception and dispatch.</p>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            System logs are kept for a maximum of 15 days. Older logs are automatically deleted.
          </p>
        </div>

        <button 
          onClick={handleClearLogs}
          disabled={clearing || data.length === 0}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          {clearing ? "Clearing..." : "Clear Logs"}
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-grow">
        {/* Data Table */}
        <div className="bg-[#080C14] border border-white/[0.05] rounded-2xl flex flex-col shadow-2xl flex-grow overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="flex-grow flex justify-center items-center">
              <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex-grow flex justify-center items-center text-gray-500 text-sm font-mono flex-col gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 opacity-20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              No system logs found yet.
            </div>
          ) : (
            <>
              {/* Top Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="px-5 py-4 border-b border-white/[0.05] bg-[#0A0E17] flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Showing Page <strong className="text-white">{pagination.page}</strong> of <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} records)
                  </span>
                  <div className="flex gap-2">
                    <button 
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.05] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button 
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.05] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto w-full flex-grow">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/[0.05] bg-slate-900/50">
                    <th className="px-5 py-4 text-xs font-bold text-gray-400 w-16">ID</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-400 w-24">Type</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-400 w-24">Status</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-400 w-64">Message / Step</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-400">Details</th>
                    <th className="px-5 py-4 text-xs font-bold text-gray-400 text-right w-48">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any) => (
                    <tr key={row.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                      <td className="px-5 py-4 text-xs text-gray-500 font-mono align-top">#{row.id}</td>
                      <td className="px-5 py-4 align-top">{getTypeBadge(row.log_type)}</td>
                      <td className="px-5 py-4 align-top">{getStatusBadge(row.status)}</td>
                      <td className="px-5 py-4 text-sm text-gray-300 font-medium align-top leading-relaxed">{row.message}</td>
                      <td className="px-5 py-4 text-xs align-top">
                        {row.details ? (
                          <div className="bg-black/30 border border-white/[0.05] rounded-lg p-3 overflow-x-auto max-w-full">
                            <pre className="text-gray-400 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
                              {JSON.stringify(row.details, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <span className="text-gray-600 italic">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 font-mono text-right align-top">
                        {new Date(row.created_at + "Z").toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-4 border-t border-white/[0.05] bg-[#0A0E17] flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Showing Page <strong className="text-white">{pagination.page}</strong> of <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} records)
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.05] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.05] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
