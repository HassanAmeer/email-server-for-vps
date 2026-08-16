"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-config";

interface Attachment {
  filename: string;
  size: number;
  url: string;
  contentType?: string;
  content?: string;
}

interface EmailItem {
  id: number;
  recipient: string;
  sender: string;
  subject: string;
  has_attachment: number;
  attachment_size: number;
  created_at: string;
  details?: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    date: string;
    senderIp?: string;
    attachments?: Attachment[];
    rawHeaders?: string;
  };
}

interface MediaFile {
  emailId: number;
  sender: string;
  recipient: string;
  date: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export default function ImapMailboxInbox() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [primaryDomain, setPrimaryDomain] = useState("mailserver10.com");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  const [showMedia, setShowMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "with_attachments" | "simple">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(200);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("imap_mailbox_token");
    const userStr = localStorage.getItem("imap_mailbox_user");

    if (!token || !userStr) {
      router.push("/imap-mailbox");
      return;
    }

    try {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      const storedRead = localStorage.getItem("imap_mailbox_read_emails");
      if (storedRead) {
        setReadEmails(new Set(JSON.parse(storedRead)));
      }
      fetchEmails(token, page, filterType, searchQuery);
    } catch (e) {
      handleLogout();
    }
  }, [router]);

  // Refetch when page, filter, or search changes
  useEffect(() => {
    const token = localStorage.getItem("imap_mailbox_token");
    if (!token || !user) return;
    fetchEmails(token, page, filterType, searchQuery);
  }, [page, filterType, searchQuery]);

  // Auto-fetch emails every 6 seconds silently
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("imap_mailbox_token");
    if (!token) return;

    const interval = setInterval(() => {
      fetchEmailsSilent(token, page, filterType, searchQuery);
    }, 6000);

    return () => clearInterval(interval);
  }, [user, page, filterType, searchQuery]);

  const fetchEmailsSilent = async (token: string, curPage: number, curFilter: string, curSearch: string) => {
    try {
      const apiBase = getApiBaseUrl();
      let url = `${apiBase}/api/imap-mailbox/inbox?page=${curPage}&limit=${limit}&filter=${curFilter}`;
      if (curSearch && curSearch.trim().length > 0) {
        url += `&search=${encodeURIComponent(curSearch.trim())}`;
      }

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(text);
        } catch {
          return;
        }
        setEmails(responseData.data || []);
        if (responseData.pagination) {
          setTotalRecords(responseData.pagination.totalRecords || 0);
          setTotalPages(responseData.pagination.totalPages || 1);
        }
        if (responseData.primaryDomain) {
          setPrimaryDomain(responseData.primaryDomain);
        }
      }
    } catch (err) {
      // Silently fail for background polling
    }
  };

  const fetchEmails = async (token: string, curPage: number, curFilter: string, curSearch: string) => {
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl();
      let url = `${apiBase}/api/imap-mailbox/inbox?page=${curPage}&limit=${limit}&filter=${curFilter}`;
      if (curSearch && curSearch.trim().length > 0) {
        url += `&search=${encodeURIComponent(curSearch.trim())}`;
      }

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const text = await res.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response. Please ensure backend is running.");
      }

      if (res.ok) {
        setEmails(responseData.data || []);
        if (responseData.pagination) {
          setTotalRecords(responseData.pagination.totalRecords || 0);
          setTotalPages(responseData.pagination.totalPages || 1);
        }
        if (responseData.primaryDomain) {
          setPrimaryDomain(responseData.primaryDomain);
        }
      } else {
        setError(responseData.error || "Failed to load emails");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading emails");
    } finally {
      setLoading(false);
    }
  };

  const fetchMediaFiles = async () => {
    setShowMedia(true);
    setSelectedEmail(null);
    setShowCompose(false);
    setLoadingMedia(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/imap-mailbox/media`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setMediaFiles(data.media || []);
        } catch {
          // ignore non-json
        }
      }
    } catch (err) {
      console.error("Error fetching media:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleDeleteEmail = async (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this email permanently?")) return;
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/imap-mailbox/inbox/${emailId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setEmails(prev => prev.filter(email => email.id !== emailId));
        setTotalRecords(prev => Math.max(0, prev - 1));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
      }
    } catch (err) {
      alert("Error deleting email");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("imap_mailbox_token");
    localStorage.removeItem("imap_mailbox_user");
    router.push("/imap-mailbox");
  };

  const handleViewEmail = async (emailRecord: EmailItem) => {
    setShowCompose(false);
    setShowMedia(false);

    // Mark as read immediately in UI and localStorage
    setReadEmails(prev => {
      const next = new Set(prev);
      next.add(emailRecord.id);
      localStorage.setItem("imap_mailbox_read_emails", JSON.stringify(Array.from(next)));
      return next;
    });

    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/imap-mailbox/inbox/${emailRecord.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        alert("Failed to parse email content");
        return;
      }

      if (res.ok && data) {
        setSelectedEmail({ ...emailRecord, details: data });
      } else {
        alert(data?.error || "Failed to load email details");
      }
    } catch (err) {
      alert("Error loading email content");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/imap-mailbox/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          message: composeMessage
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid response from server when sending email");
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      alert("Email dispatched successfully!");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeMessage("");
      if (token) fetchEmailsSilent(token, page, filterType, searchQuery);
    } catch (err: any) {
      alert(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const parseSender = (senderStr: string) => {
    if (!senderStr) return { name: "Unknown Sender", email: "" };
    const match = senderStr.match(/^(?:["']?([^"']+)["']?\s*)?<?([^>\s]+@[^>\s]+)>?$/);
    if (match) {
      const name = match[1] ? match[1].trim() : match[2];
      const email = match[2] ? match[2].trim() : "";
      return { name, email };
    }
    return { name: senderStr, email: "" };
  };

  const getInitials = (name: string, email: string) => {
    if (name && name.length > 0) return name.charAt(0).toUpperCase();
    if (email && email.length > 0) return email.charAt(0).toUpperCase();
    return '?';
  };

  if (!user) return null;

  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  return (
    <div className="h-screen bg-[#030712] text-gray-200 font-sans flex flex-col relative overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* Background glowing ambient orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[140px] pointer-events-none rounded-full" />

      {/* Top Main Header */}
      <header className="bg-[#0b0f19]/90 backdrop-blur-xl border-b border-white/[0.06] h-16 sticky top-0 z-40 flex-shrink-0 relative">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
        <div className="max-w-[1700px] mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/15 relative overflow-hidden">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-400 relative z-10">
                <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
              </svg>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-extrabold text-white tracking-tight">IMAP <span className="text-blue-400">Mailbox</span></h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Ports 993 & 143 Active | All Inbound Stream
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-gray-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                Domain: <strong className="text-white">{primaryDomain}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-bold font-mono uppercase tracking-widest">
                IMAP Master Session
              </span>
              <span className="text-xs text-gray-200 font-mono font-bold">{user.email}</span>
            </div>
            <div className="h-8 w-px bg-white/[0.08] hidden md:block mx-1"></div>
            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1700px] mx-auto w-full flex overflow-hidden shadow-2xl shadow-black/80 my-0 bg-[#0b0f19] border-x border-white/[0.04] relative z-10">

        {/* Email Stream Sidebar (Left Pane) */}
        <div className={`w-full md:w-[420px] lg:w-[470px] flex flex-col bg-[#030712]/60 border-r border-white/[0.06] overflow-hidden h-full flex-shrink-0 ${(selectedEmail || showCompose || showMedia) ? 'hidden md:flex' : 'flex'}`}>
          
          {/* Action Header, Search & Filter Controls */}
          <div className="p-4 border-b border-white/[0.06] bg-[#0b0f19]/95 backdrop-blur-md flex flex-col gap-3 z-10 sticky top-0 shadow-sm relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Captured Mail
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono font-bold border border-blue-500/30">
                  {totalRecords}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const token = localStorage.getItem("imap_mailbox_token") || "";
                    fetchEmails(token, page, filterType, searchQuery);
                  }}
                  className="text-gray-400 hover:text-blue-400 p-2 rounded-xl hover:bg-white/[0.04] transition-colors bg-white/[0.02] border border-white/[0.06]"
                  title="Refresh Email Stream"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
                <button
                  onClick={fetchMediaFiles}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  Media
                </button>
                <button
                  onClick={() => { setSelectedEmail(null); setShowMedia(false); setShowCompose(true); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-1.5 rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                  </svg>
                  Compose
                </button>
              </div>
            </div>

            {/* Fast Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search sender, recipient, subject, address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-black/60 border border-white/[0.08] focus:border-blue-500/60 rounded-xl px-3.5 py-2 pl-9 pr-8 text-xs text-white placeholder:text-gray-500 focus:outline-none transition-all font-mono"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setPage(1); }}
                  className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-white p-1"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setFilterType("all"); setPage(1); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterType === "all" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]"}`}
              >
                All Mails
              </button>
              <button
                onClick={() => { setFilterType("with_attachments"); setPage(1); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterType === "with_attachments" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]"}`}
              >
                Attachments
              </button>
              <button
                onClick={() => { setFilterType("simple"); setPage(1); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${filterType === "simple" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]"}`}
              >
                Simple Text
              </button>
              <span className="ml-auto text-[10px] font-mono text-gray-500">
                Max 200/page
              </span>
            </div>
          </div>

          {/* Email List Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border-b border-white/[0.04] bg-white/[0.01]">
                    <div className="flex justify-between items-center gap-4">
                      <div className="h-4 bg-white/[0.06] rounded-md w-1/3"></div>
                      <div className="h-3 bg-white/[0.03] rounded-md w-12"></div>
                    </div>
                    <div className="h-4 bg-white/[0.03] rounded-md w-2/3"></div>
                    <div className="h-3 bg-white/[0.02] rounded-md w-full mt-1"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 m-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mt-0.5 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center bg-[#030712]/30">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white/[0.02] flex items-center justify-center text-gray-600 border border-white/[0.05]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="font-bold text-gray-300 text-base">No Emails Found</p>
                <p className="text-xs text-gray-500 mt-1">
                  {searchQuery ? `No matches for "${searchQuery}"` : "Inbound emails will stream here automatically in real time."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col bg-[#0b0f19]/40 divide-y divide-white/[0.04]">
                {emails.map(email => {
                  const isSelected = selectedEmail?.id === email.id;
                  const isRead = readEmails.has(email.id);
                  const { name: senderName } = parseSender(email.sender);

                  return (
                    <div
                      key={email.id}
                      onClick={() => { setShowMedia(false); handleViewEmail(email); }}
                      className={`p-4 cursor-pointer transition-all relative group ${
                        isSelected
                          ? 'bg-blue-500/10'
                          : (isRead ? 'hover:bg-white/[0.03] opacity-80' : 'bg-blue-500/[0.03] hover:bg-blue-500/[0.06]')
                      }`}
                    >
                      {/* Left border indicator */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                      )}

                      <div className="flex justify-between items-baseline mb-1 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] flex-shrink-0 animate-pulse"></span>
                          )}
                          <span className={`font-bold truncate text-sm ${isSelected ? 'text-blue-300' : (isRead ? 'text-gray-400' : 'text-gray-100')}`}>
                            {senderName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteEmail(email.id, e)}
                            className="text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            title="Delete Email"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                            </svg>
                          </button>
                          <span className={`text-[11px] font-medium font-mono whitespace-nowrap ${isSelected ? 'text-blue-400' : 'text-gray-500'}`}>
                            {formatDate(email.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Recipient tag */}
                      {email.recipient && (
                        <div className="mb-1.5">
                          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 inline-flex items-center gap-1 max-w-full truncate">
                            <span className="text-gray-500 font-sans">To:</span> {email.recipient}
                          </span>
                        </div>
                      )}

                      <div className={`text-xs font-semibold truncate mb-2 ${isSelected ? 'text-blue-100' : 'text-gray-300'}`}>
                        {email.subject || "(No Subject)"}
                      </div>

                      <div className="flex items-center justify-between">
                        {email.has_attachment === 1 ? (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 border border-emerald-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                            </svg>
                            Attached
                          </span>
                        ) : (
                          <span className="bg-white/[0.04] text-gray-400 text-[10px] px-2 py-0.5 rounded font-semibold border border-white/[0.08]">
                            Simple
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600 font-mono">
                          {formatBytes(email.attachment_size || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SIDEBAR PAGINATION FOOTER (Max 200 emails per page) */}
          <div className="p-3 border-t border-white/[0.06] bg-[#0b0f19]/95 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-gray-400">
                {totalRecords > 0 ? `${startRecord}-${endRecord} of ${totalRecords}` : "0 emails"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 disabled:opacity-40 disabled:pointer-events-none border border-white/[0.06] transition-all flex items-center gap-1"
                title="Previous Page"
              >
                ← Prev
              </button>

              <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {page} / {Math.max(1, totalPages)}
              </span>

              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 disabled:opacity-40 disabled:pointer-events-none border border-white/[0.06] transition-all flex items-center gap-1"
                title="Next Page"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Email Viewer / Compose Pane (Right Pane) */}
        <div className={`flex-1 flex-col bg-[#0b0f19] overflow-hidden h-full relative ${(selectedEmail || showCompose || showMedia) ? 'flex' : 'hidden md:flex'}`}>

          {/* MEDIA LIBRARY VIEW */}
          {showMedia ? (
            <div className="flex flex-col flex-1 relative">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full"></div>
              
              <div className="px-8 py-6 border-b border-white/[0.06] bg-transparent flex justify-between items-center relative z-10 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <button onClick={() => setShowMedia(false)} className="md:hidden flex items-center justify-center text-gray-500 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] rounded-full w-8 h-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-indigo-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    Server Media Library
                  </h2>
                </div>
                <div className="flex items-center gap-4 bg-white/[0.02] px-4 py-2 rounded-xl border border-white/[0.05]">
                  <span className="text-xs font-medium text-gray-400">Total Media Size:</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {formatBytes(mediaFiles.reduce((acc, curr) => acc + (curr.size || 0), 0))}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
                {loadingMedia ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-10 h-10 border-4 border-white/[0.05] border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                ) : mediaFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-16 h-16 mb-4 opacity-50">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="text-base font-bold text-gray-400">No media attachments found</p>
                    <p className="text-xs mt-1">Attachments will automatically populate here when emails are received.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {mediaFiles.map((file, idx) => {
                      const isImage = file.contentType?.startsWith('image/') || file.filename?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i);
                      const isVideo = file.contentType?.startsWith('video/') || file.filename?.match(/\.(mp4|webm|ogg|mov)$/i);
                      const isPdf = file.contentType === 'application/pdf' || file.filename?.match(/\.pdf$/i);

                      return (
                        <div key={idx} className="group relative rounded-2xl overflow-hidden bg-[#030712] border border-white/[0.08] hover:border-blue-500/50 transition-all flex flex-col h-48 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                          {isImage ? (
                            <div className="absolute inset-0 bg-black">
                              <img src={file.url} alt={file.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent opacity-90 group-hover:opacity-70 transition-opacity"></div>
                            </div>
                          ) : isVideo ? (
                            <div className="absolute inset-0 bg-black overflow-hidden">
                              <video src={file.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" muted loop autoPlay playsInline />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent opacity-90 group-hover:opacity-70 transition-opacity pointer-events-none"></div>
                            </div>
                          ) : isPdf ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-rose-500/50 group-hover:text-rose-400 transition-colors">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02] group-hover:bg-blue-500/5 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-blue-500/40 group-hover:text-blue-400 transition-colors">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                          )}

                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={file.url}
                              download={file.filename}
                              target="_blank"
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                              Save
                            </a>
                          </div>

                          <div className="relative z-10 p-3 h-full flex flex-col justify-end">
                            <p className="text-xs font-semibold text-gray-200 truncate w-full" title={file.filename}>
                              {file.filename}
                            </p>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{formatBytes(file.size)}</span>
                              <span className="text-[10px] text-gray-500">{formatDate(file.date)}</span>
                            </div>
                            {file.recipient && (
                              <div className="mt-1">
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 block truncate">
                                  To: {file.recipient}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : showCompose ? (
            /* COMPOSE MESSAGE VIEW */
            <div className="flex flex-col flex-1 relative min-h-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              <div className="px-8 py-6 border-b border-white/[0.06] bg-transparent flex justify-between items-center relative z-10 flex-shrink-0">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <button onClick={() => setShowCompose(false)} className="md:hidden flex items-center justify-center text-gray-500 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] rounded-full w-8 h-8 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  New Message (Outbound SMTP)
                </h2>
                <button onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] p-2 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 bg-transparent relative z-10 min-h-0">
                <div className="px-8 py-4 border-b border-white/[0.04] flex items-center bg-black/20 flex-shrink-0">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider w-20 font-mono">To:</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="flex-1 text-white bg-transparent text-sm focus:outline-none placeholder:text-gray-600 font-medium font-mono"
                  />
                </div>
                <div className="px-8 py-4 border-b border-white/[0.04] flex items-center bg-black/20 flex-shrink-0">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider w-20 font-mono">Subject:</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="flex-1 text-white bg-transparent text-sm focus:outline-none placeholder:text-gray-600 font-medium"
                  />
                </div>
                <div className="flex flex-col flex-1 px-8 py-6 bg-black/40 min-h-0">
                  <textarea
                    value={composeMessage}
                    onChange={e => setComposeMessage(e.target.value)}
                    required
                    placeholder="Write your email body..."
                    className="w-full flex-1 text-gray-300 bg-transparent text-sm focus:outline-none resize-none font-sans leading-relaxed placeholder:text-gray-600"
                  ></textarea>
                </div>
                <div className="p-6 bg-[#030712] border-t border-white/[0.06] flex justify-between items-center flex-shrink-0">
                  <button type="button" onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-rose-400 font-semibold px-4 py-2 transition-colors text-sm">
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center gap-2 active:scale-[0.98]"
                  >
                    {sending ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 -ml-1">
                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                      </svg>
                    )}
                    Dispatch Email
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEmail ? (
            /* EMAIL READING PANE */
            <div className="flex flex-col flex-1 relative min-h-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              
              {/* Header Info */}
              <div className="px-8 py-6 border-b border-white/[0.06] bg-[#030712]/50 relative z-10 flex-shrink-0">
                <div className="flex items-start gap-4 mb-6">
                  <button onClick={() => setSelectedEmail(null)} className="md:hidden mt-1 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] rounded-full w-9 h-9 border border-white/[0.05]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-extrabold text-white leading-tight tracking-tight">
                      {selectedEmail.subject || "(No Subject)"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode(viewMode === "html" ? "text" : "html")}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.08] transition-colors"
                    >
                      {viewMode === "html" ? "View Raw Text" : "View HTML Render"}
                    </button>
                    <button
                      onClick={() => handleDeleteEmail(selectedEmail.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                      title="Delete Email"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const { name, email } = parseSender(selectedEmail.sender);
                      return (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xl shadow-lg flex-shrink-0">
                            {getInitials(name, email)}
                          </div>
                          <div className="flex flex-col">
                            <div className="text-white font-bold text-base flex items-center gap-2">
                              {name}
                              {email && name !== email && <span className="text-xs font-normal text-gray-500 font-mono">&lt;{email}&gt;</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                              <span>Delivered To:</span>
                              <span className="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 font-mono text-xs font-bold">
                                {selectedEmail.recipient}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-gray-500 font-medium text-right flex flex-col items-end">
                    <span className="text-gray-300 font-bold">{formatDate(selectedEmail.created_at)}</span>
                    <span className="text-[11px] text-gray-500 mt-1 font-mono bg-white/[0.02] px-2 py-0.5 rounded border border-white/[0.04]">
                      {getFullDate(selectedEmail.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto bg-[#0b0f19] p-8 relative z-10 custom-scrollbar min-h-0">
                {selectedEmail.details ? (
                  <div className="max-w-5xl w-full mx-auto">
                    {/* HTML View */}
                    {viewMode === "html" && selectedEmail.details.html ? (
                      <div className="bg-[#111827] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 min-h-[500px]">
                        {/* Fake macOS window bar */}
                        <div className="h-8 bg-[#1f2937] border-b border-white/[0.05] flex items-center px-4 gap-2">
                          <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                          <span className="text-[10px] font-mono text-gray-400 ml-2">HTML Email Sandbox Preview</span>
                        </div>
                        <iframe
                          srcDoc={`<style>body{background-color:#111827;color:#e5e7eb;font-family:sans-serif;margin:0;padding:1.5rem;overflow-y:hidden;} a{color:#60a5fa;} img{max-width:100%;height:auto;}</style>` + selectedEmail.details.html}
                          className="w-full block border-0 bg-[#111827]"
                          title="Email Content"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                          onLoad={(e) => {
                            const iframe = e.target as HTMLIFrameElement;
                            try {
                              const height = Math.max(
                                iframe.contentWindow?.document.documentElement.scrollHeight || 0,
                                iframe.contentWindow?.document.body.scrollHeight || 0
                              );
                              if (height > 0) {
                                iframe.style.height = (height + 40) + 'px';
                              }
                            } catch (err) {}
                          }}
                        />
                      </div>
                    ) : (
                      /* Text View */
                      <div className="bg-black/40 p-6 rounded-2xl text-gray-300 whitespace-pre-wrap font-mono text-xs leading-relaxed border border-white/[0.06] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                        {selectedEmail.details.text || "(This message has no plain text content)"}
                      </div>
                    )}

                    {/* Attachments Section */}
                    {selectedEmail.details.attachments && selectedEmail.details.attachments.length > 0 && (
                      <div className="mt-10 pt-6 border-t border-white/[0.06]">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2 font-mono">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400">
                            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                          </svg>
                          Attachments ({selectedEmail.details.attachments.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedEmail.details.attachments.map((att, idx) => {
                            const isBase64Img = att.content && (att.content.startsWith('iVBORw0K') || att.content.startsWith('/9j/') || att.content.startsWith('R0lGOD') || att.content.startsWith('UklGR'));
                            const isImage = att.contentType?.startsWith('image/') || att.filename?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i) || isBase64Img;

                            const getImgSrc = () => {
                              if (att.content?.startsWith('iVBORw0K')) return `data:image/png;base64,${att.content}`;
                              if (att.content?.startsWith('/9j/')) return `data:image/jpeg;base64,${att.content}`;
                              if (att.content?.startsWith('R0lGOD')) return `data:image/gif;base64,${att.content}`;
                              if (att.content?.startsWith('UklGR')) return `data:image/webp;base64,${att.content}`;
                              return att.url || `data:${att.contentType || 'image/png'};base64,${att.content}`;
                            };

                            return (
                              <a
                                key={idx}
                                href={att.url || getImgSrc()}
                                download={att.filename}
                                target="_blank"
                                className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-blue-500/40 transition-all group relative overflow-hidden"
                              >
                                {isImage ? (
                                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-black relative shadow-sm">
                                    <img src={getImgSrc()} alt={att.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 opacity-80 group-hover:opacity-100" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors shadow-sm flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-gray-200 truncate group-hover:text-white">{att.filename}</p>
                                  <p className="text-[10px] font-mono text-gray-500 mt-0.5 group-hover:text-blue-400">{formatBytes(att.size)}</p>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-8 h-8 border-3 border-white/[0.05] border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EMPTY SELECTION STATE */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 h-full bg-[#030712]/80 relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-[#0b0f19] flex items-center justify-center mb-5 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border border-white/[0.04]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="w-10 h-10 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-300 mb-1.5 tracking-tight">Select an Email to Inspect</p>
              <p className="text-xs text-gray-500 max-w-sm text-center">
                Click any message from the IMAP catch-all live feed on the left to read HTML bodies, inspect raw headers, and download media.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
