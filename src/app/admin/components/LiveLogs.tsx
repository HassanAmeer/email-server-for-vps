"use client";

import { useState, useEffect, useMemo } from "react";

interface LiveLogsProps {
  apiUrl: string;
  systemMode: "Live" | "Local";
}

export default function LiveLogs({ apiUrl, systemMode }: LiveLogsProps) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeType, setActiveType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rcptLogging, setRcptLogging] = useState<boolean>(false);
  const [rcptLoggingLoading, setRcptLoggingLoading] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchLogs = async (page: number, limit: number = pagination.limit, type: string = activeType, search: string = searchQuery) => {
    if (!apiUrl) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const endpointType = type === "all" ? "all" : type.toLowerCase();
      const searchParam = search ? `&search=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(`${apiUrl}/api/admin/dblogs/${endpointType}?page=${page}&limit=${limit}${searchParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
        setPagination(json.pagination || { page: 1, limit, total: 0, totalPages: 1 });
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
    const timer = setTimeout(() => {
      setSelectedIds([]);
      fetchLogs(pagination.page, pagination.limit, activeType, searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [apiUrl, pagination.page, pagination.limit, activeType, searchQuery]);

  // Fetch current RCPT TO logging flag state
  const fetchRcptFlag = async () => {
    if (!apiUrl) return;
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/smtp-flags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setRcptLogging(json.flags?.rcpt_logging === "1");
      }
    } catch (e) {}
  };

  useEffect(() => { fetchRcptFlag(); }, [apiUrl]);

  // Toggle RCPT TO logging
  const toggleRcptLogging = async () => {
    if (!apiUrl || rcptLoggingLoading) return;
    setRcptLoggingLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/smtp-flags`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ flag: "rcpt_logging", value: rcptLogging ? 0 : 1 })
      });
      if (res.ok) {
        const json = await res.json();
        const newState = json.flags?.rcpt_logging === "1";
        setRcptLogging(newState);
        showToast(
          newState ? "RCPT TO Logging enabled — all SMTP attempts will be saved to DB" : "RCPT TO Logging disabled — only real deliveries will be logged",
          "success"
        );
      }
    } catch (e) {
      showToast("Failed to toggle RCPT TO logging", "error");
    } finally {
      setRcptLoggingLoading(false);
    }
  };

  // Handle Clear ALL logs
  const handleClearLogs = async () => {
    const confirmText = activeType === "all" 
      ? "Are you sure you want to clear ALL server system logs?" 
      : `Are you sure you want to clear all ${activeType.toUpperCase()} logs?`;
    
    if (!confirm(confirmText)) return;
    
    setClearing(true);
    try {
      const token = localStorage.getItem("admin_token");
      const endpointType = activeType === "all" ? "all" : activeType.toLowerCase();
      const res = await fetch(`${apiUrl}/api/admin/dblogs/${endpointType}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSelectedIds([]);
          showToast("All system logs have been successfully cleared!", "success");
          setPagination(prev => ({ ...prev, page: 1 }));
          fetchLogs(1, pagination.limit, activeType);
        } else {
          showToast(json.error || "Failed to clear logs.", "error");
        }
      } else {
        showToast("Failed to clear logs.", "error");
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
      showToast("Error clearing logs. Please check connection.", "error");
    } finally {
      setClearing(false);
    }
  };

  // Handle Delete SELECTED logs
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected log(s)?`)) return;

    setDeletingSelected(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${apiUrl}/api/admin/dblogs/all`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          showToast(`Successfully deleted ${json.count ?? selectedIds.length} selected log(s).`, "success");
          setSelectedIds([]);
          fetchLogs(pagination.page, pagination.limit, activeType);
        } else {
          showToast(json.error || "Failed to delete selected logs.", "error");
        }
      } else {
        showToast("Failed to delete selected logs.", "error");
      }
    } catch (err) {
      console.error("Error deleting selected logs:", err);
      showToast("Error deleting selected logs.", "error");
    } finally {
      setDeletingSelected(false);
    }
  };

  // Toggle selection for a single row
  const toggleSelectRow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle select all on current page
  const isAllCurrentPageSelected = useMemo(() => {
    if (data.length === 0) return false;
    return data.every(row => selectedIds.includes(row.id));
  }, [data, selectedIds]);

  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const currentPageIds = new Set(data.map(r => r.id));
      setSelectedIds(prev => prev.filter(id => !currentPageIds.has(id)));
    } else {
      const currentPageIds = data.map(r => r.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  // Filter logs locally by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(row => {
      const msg = (row.message || "").toLowerCase();
      const type = (row.log_type || "").toLowerCase();
      const status = (row.status || "").toLowerCase();
      const details = row.details ? JSON.stringify(row.details).toLowerCase() : "";
      return msg.includes(q) || type.includes(q) || status.includes(q) || details.includes(q) || String(row.id).includes(q);
    });
  }, [data, searchQuery]);

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

  // Reusable Pagination Bar Component (Used at both Top and Bottom)
  const renderPaginationBar = (position: "top" | "bottom") => {
    const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
      <div className={`px-4 sm:px-5 py-3.5 ${position === "top" ? "border-b" : "border-t"} border-white/[0.06] bg-[#0A0E17] flex flex-col sm:flex-row justify-between items-center gap-3`}>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            Showing <strong className="text-white font-mono">{startItem} - {endItem}</strong> of <strong className="text-white font-mono">{pagination.total}</strong> records
          </span>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span className="text-gray-500">Per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10);
                setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
              }}
              className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/40 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* First Page */}
          <button 
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
            className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="First Page"
          >
            « First
          </button>

          {/* Previous Page */}
          <button 
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            className="px-3 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span>Previous</span>
          </button>

          {/* Current Page Badge */}
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono font-bold">
            {pagination.page} / {pagination.totalPages || 1}
          </span>

          {/* Next Page */}
          <button 
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            className="px-3 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
          >
            <span>Next</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Last Page */}
          <button 
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPagination(prev => ({ ...prev, page: pagination.totalPages }))}
            className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-slate-900 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Last Page"
          >
            Last »
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="tab-pane w-full flex flex-col gap-5 animate-fade-in" id="logs-tab">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg transition-all animate-slide-in ${
          toastMessage.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-white cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/40 border border-white/[0.06] rounded-2xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-white tracking-tight">Server System Logs</h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
              50 / Page
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Real-time processing events for SMTP email reception, IMAP sync, and dispatches.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">

          {/* RCPT TO Logging Toggle Switch */}
          <button
            onClick={toggleRcptLogging}
            disabled={rcptLoggingLoading}
            title={rcptLogging ? "Click to disable RCPT TO logging" : "Click to enable RCPT TO logging (warning: logs flood fast)"}
            className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-60 ${
              rcptLogging
                ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                : "bg-slate-800/60 border-white/[0.08] text-gray-400 hover:border-white/[0.15] hover:text-gray-300"
            }`}
          >
            {/* Switch Track */}
            <div className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ${rcptLogging ? "bg-red-500" : "bg-slate-700"}`}>
              <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200 ${rcptLogging ? "left-4" : "left-0.5"}`} />
            </div>
            <span>RCPT Logging</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${rcptLogging ? "bg-red-500/20 text-red-300" : "bg-slate-700 text-gray-500"}`}>
              {rcptLoggingLoading ? "..." : rcptLogging ? "ON" : "OFF"}
            </span>
          </button>

          {/* Refresh Button */}

          <button
            onClick={() => fetchLogs(pagination.page, pagination.limit, activeType)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Logs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh</span>
          </button>

          {/* Delete Selected (Active when items selected) */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-fade-in"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span>{deletingSelected ? "Deleting..." : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          )}

          {/* Clear All Logs Button */}
          <button 
            onClick={handleClearLogs}
            disabled={clearing || pagination.total === 0}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <span>{clearing ? "Clearing..." : "Clear All Logs"}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#080C14] p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
          {[
            { id: "all", label: "All Logs" },
            { id: "receive", label: "Receive (SMTP)" },
            { id: "send", label: "Send (Outbound)" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveType(tab.id);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeType === tab.id
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search Box */}
        <div className="relative flex-1 sm:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            placeholder="Search logs by email, subject, IP, step..."
            className="w-full bg-[#080C14] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none transition-all pl-9"
          />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-gray-500 absolute left-3 top-2 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="absolute right-2.5 top-1.5 text-gray-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex flex-col gap-0 flex-grow">
        <div className="bg-[#080C14] border border-white/[0.06] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          
          {/* Top Pagination Controls */}
          {pagination.total > 0 && renderPaginationBar("top")}

          {/* Loading State */}
          {loading ? (
            <div className="py-24 flex justify-center items-center flex-col gap-3">
              <div className="w-9 h-9 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400 font-mono">Loading system logs...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-20 flex justify-center items-center text-gray-500 text-sm font-mono flex-col gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 opacity-20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{searchQuery ? "No logs match your search." : "No system logs found."}</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Clear search filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-slate-900/60 text-gray-400">
                    {/* Checkbox Header for Select All on Page */}
                    <th className="px-4 py-3.5 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={toggleSelectAllCurrentPage}
                        className="w-4 h-4 rounded border-gray-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer accent-emerald-500"
                        title={isAllCurrentPageSelected ? "Deselect all on this page" : "Select all on this page"}
                      />
                    </th>
                    <th className="px-3 py-3.5 text-xs font-bold text-gray-300 w-16">ID</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-gray-300 w-24">Type</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-gray-300 w-24">Status</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-gray-300 w-72">Message / Step</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-gray-300">Details Payload</th>
                    <th className="px-4 py-3.5 text-xs font-bold text-gray-300 text-right w-44">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filteredData.map((row: any) => {
                    const isSelected = selectedIds.includes(row.id);
                    return (
                      <tr 
                        key={row.id} 
                        className={`transition-colors cursor-pointer ${
                          isSelected 
                            ? "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.10]" 
                            : "hover:bg-white/[0.02]"
                        }`}
                        onClick={() => toggleSelectRow(row.id)}
                      >
                        {/* Row Checkbox */}
                        <td className="px-4 py-3.5 text-center align-top" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.id)}
                            className="w-4 h-4 rounded border-gray-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer accent-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-xs text-gray-400 font-mono align-top">#{row.id}</td>
                        <td className="px-4 py-3.5 align-top">{getTypeBadge(row.log_type)}</td>
                        <td className="px-4 py-3.5 align-top">{getStatusBadge(row.status)}</td>
                        <td className="px-4 py-3.5 text-xs sm:text-sm text-gray-200 font-medium align-top leading-relaxed">
                          {row.message}
                        </td>
                        <td className="px-4 py-3.5 text-xs align-top">
                          {row.details ? (
                            <div className="bg-black/40 border border-white/[0.06] rounded-lg p-2.5 overflow-x-auto max-w-full">
                              <pre className="text-gray-300 font-mono text-[11px] leading-snug whitespace-pre-wrap break-all">
                                {JSON.stringify(row.details, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <span className="text-gray-600 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 font-mono text-right align-top whitespace-nowrap">
                          {new Date(row.created_at + "Z").toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Pagination Controls */}
          {pagination.total > 0 && renderPaginationBar("bottom")}
        </div>
      </div>
    </section>
  );
}
