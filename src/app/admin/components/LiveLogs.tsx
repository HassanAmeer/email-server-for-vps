"use client";

import { useState, useEffect } from "react";

interface LiveLogsProps {
  apiUrl: string;
  systemMode: "Live" | "Local";
}

type MainSection = "receive" | "send";
type SubTab = "generated" | "usage" | "simple" | "attachments";

export default function LiveLogs({ apiUrl, systemMode }: LiveLogsProps) {
  const [mainSection, setMainSection] = useState<MainSection>("receive");
  const [activeTab, setActiveTab] = useState<SubTab>("generated");
  
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (tab: SubTab, page: number) => {
    if (!apiUrl) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/dblogs/${tab}?page=${page}&limit=${pagination.limit}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setPagination(json.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Error fetching db logs:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when tab or page changes, but only if we are in "receive" section
  useEffect(() => {
    if (mainSection === "receive") {
      fetchLogs(activeTab, pagination.page);
    }
  }, [apiUrl, mainSection, activeTab, pagination.page]);

  // Handle Tab Switch (reset page to 1)
  const handleTabSwitch = (tab: SubTab) => {
    setActiveTab(tab);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <section className="tab-pane w-full flex flex-col gap-6" id="logs-tab">
      
      {/* Top Level Section Toggle */}
      <div className="flex p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl w-fit border border-white/[0.04]">
        <button 
          onClick={() => setMainSection("receive")}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${mainSection === "receive" ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-gray-400 hover:text-white"}`}
        >
          Receive Emails
        </button>
        <button 
          onClick={() => setMainSection("send")}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${mainSection === "send" ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-gray-400 hover:text-white"}`}
        >
          Send Email
        </button>
      </div>

      {mainSection === "send" ? (
        // Send Email Disabled State
        <div className="flex-grow flex items-center justify-center bg-[#080C14] border border-white/[0.05] rounded-3xl min-h-[500px]">
          <div className="text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Sending Module</h2>
            <p className="text-sm font-mono text-gray-500 px-4 py-2 bg-slate-900 rounded-lg border border-white/[0.05]">
              Currently Disabled by Developer
            </p>
          </div>
        </div>
      ) : (
        // Receive Emails Sub-Tabs
        <div className="flex flex-col gap-4 flex-grow">
          {/* Tabs Navigation */}
          <div className="flex gap-2 border-b border-white/[0.04] pb-3 overflow-x-auto no-scrollbar">
            <button onClick={() => handleTabSwitch("generated")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === "generated" ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"}`}>View Generated Emails</button>
            <button onClick={() => handleTabSwitch("usage")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === "usage" ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"}`}>View Usage Emails</button>
            <button onClick={() => handleTabSwitch("simple")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === "simple" ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"}`}>View Simple Emails</button>
            <button onClick={() => handleTabSwitch("attachments")} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === "attachments" ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"}`}>View Attachment Emails</button>
          </div>

          {/* Data Table */}
          <div className="bg-[#080C14] border border-white/[0.05] rounded-2xl flex flex-col shadow-2xl flex-grow overflow-hidden min-h-[400px]">
            {loading ? (
              <div className="flex-grow flex justify-center items-center">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>
            ) : data.length === 0 ? (
              <div className="flex-grow flex justify-center items-center text-gray-500 text-sm font-mono">
                No logs found in this category.
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
                
                <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-slate-900/50">
                      <th className="px-5 py-4 text-xs font-bold text-gray-400">ID</th>
                      {activeTab === "generated" ? (
                        <>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">Generated Email</th>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">IP Address</th>
                        </>
                      ) : (
                        <>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">Recipient</th>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">Sender</th>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">Subject</th>
                          <th className="px-5 py-4 text-xs font-bold text-gray-400">Attachment</th>
                        </>
                      )}
                      <th className="px-5 py-4 text-xs font-bold text-gray-400 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row: any) => (
                      <tr key={row.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">#{row.id}</td>
                        {activeTab === "generated" ? (
                          <>
                            <td className="px-5 py-3 text-sm text-emerald-400 font-medium">{row.email}</td>
                            <td className="px-5 py-3 text-xs text-gray-400 font-mono">{row.ip_address}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-sm text-emerald-400 font-medium">{row.recipient}</td>
                            <td className="px-5 py-3 text-xs text-gray-300">{row.sender}</td>
                            <td className="px-5 py-3 text-xs text-gray-400 truncate max-w-[200px]">{row.subject || "(No Subject)"}</td>
                            <td className="px-5 py-3 text-xs">
                              {row.has_attachment ? <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Yes</span> : <span className="text-gray-600">-</span>}
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3 text-xs text-gray-500 font-mono text-right">
                          {new Date(row.created_at + "Z").toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* Pagination Controls */}
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
          </div>
        </div>
      )}
    </section>
  );
}
