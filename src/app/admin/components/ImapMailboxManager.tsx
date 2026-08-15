"use client";

import { useState, useEffect } from "react";

interface Attachment {
  filename: string;
  size: number;
  url: string;
}

interface Email {
  id: string;
  fileName: string;
  type: "live" | "local";
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: string;
  senderIp: string;
  attachments?: Attachment[];
}

interface MailboxUser {
  id: number;
  email: string;
  plain_password?: string;
  project_id: number | null;
  project_name: string | null;
  created_at: string;
  received_count: number;
}

interface ImapMailboxManagerProps {
  apiUrl: string;
}

export default function ImapMailboxManager({ apiUrl }: ImapMailboxManagerProps) {
  const [activeTab, setActiveTab] = useState<"explorer" | "accounts" | "guides">("explorer");

  // Accounts state
  const [users, setUsers] = useState<MailboxUser[]>([]);
  const [selectedUserForModal, setSelectedUserForModal] = useState<MailboxUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Email Explorer state
  const [mails, setMails] = useState<Email[]>([]);
  const [selectedMail, setSelectedMail] = useState<Email | null>(null);
  const [filterMailbox, setFilterMailbox] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [loading, setLoading] = useState(true);
  const [showHeadersModal, setShowHeadersModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  // Guides state
  const [guideClient, setGuideClient] = useState<"outlook" | "thunderbird" | "apple" | "python" | "node">("outlook");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const getImapHost = (email?: string) => {
    if (email && email.includes("@")) {
      const domain = email.split("@")[1];
      return `mail.${domain}`;
    }
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `mail.${hostname}`;
      }
    }
    return "mail.yourdomain.com";
  };

  const fetchUsers = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/mailbox-users`, {
        headers: {
          "Authorization": `Bearer ${typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : ""}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (err) {
      console.warn("Failed to load IMAP accounts:", err);
    }
  };

  const fetchMails = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/mails`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMails(data);
          // Keep active mail selection synchronized
          if (selectedMail) {
            const updated = data.find((m: Email) => m.id === selectedMail.id);
            if (updated) setSelectedMail(updated);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load mails:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchMails();
    const interval = setInterval(fetchMails, 4000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const handleDeleteEmail = async (filename: string, type: "live" | "local") => {
    if (!apiUrl || !confirm("Are you sure you want to delete this email?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/emails/delete/${type}/${filename}`, {
        method: "POST"
      });
      if (res.ok) {
        setSelectedMail(null);
        fetchMails();
      }
    } catch (err) {
      console.error("Failed to delete email:", err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getSenderName = (from: string) => {
    if (!from) return "Unknown Sender";
    const match = from.match(/^"?([^"<]+)"?\s*</);
    if (match) return match[1].trim();
    return from.split("@")[0];
  };

  const getSenderInitial = (from: string) => {
    const name = getSenderName(from);
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  const getAvatarGradient = (from: string) => {
    const charCode = (from || "A").charCodeAt(0);
    const gradients = [
      "from-blue-500 to-indigo-600",
      "from-purple-500 to-pink-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
      "from-rose-500 to-red-600"
    ];
    return gradients[charCode % gradients.length];
  };

  // Filtered emails
  const filteredMails = mails.filter((m) => {
    const search = searchQuery.toLowerCase();
    const matchesSearch =
      m.to.toLowerCase().includes(search) ||
      m.from.toLowerCase().includes(search) ||
      m.subject.toLowerCase().includes(search);

    if (!matchesSearch) return false;
    if (filterMailbox !== "ALL") {
      return m.to.toLowerCase().includes(filterMailbox.toLowerCase());
    }
    return true;
  });

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.project_name && u.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in pb-12">
      {/* ======================================================== */}
      {/* 1. TOP HERO & METRICS ROW                                */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/30 via-slate-900/40 to-indigo-950/20 border border-white/[0.08] p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.2)]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">IMAP Mailbox</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Ports 993 & 143 Active
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Live incoming mail stream, zero-duplication Maildir storage, and client IMAP credentials.</p>
          </div>
        </div>

        {/* Quick Info Badges */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <a
            href="/imap-mailbox"
            target="_blank"
            rel="noreferrer"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-2xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open /imap-mailbox Webmail
          </a>
          <div className="bg-black/40 border border-white/[0.08] px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs text-gray-300 font-mono">
            <span className="text-blue-400 font-bold">IMAPS SSL:</span>
            <span className="text-white font-bold">993</span>
          </div>
          <div className="bg-black/40 border border-white/[0.08] px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs text-gray-300 font-mono">
            <span className="text-blue-400 font-bold">IMAP:</span>
            <span className="text-white font-bold">143</span>
          </div>
          <div className="bg-black/40 border border-white/[0.08] px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs text-gray-300 font-mono">
            <span className="text-emerald-400 font-bold">Engine:</span>
            <span className="text-gray-200">Maildir</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STATS OVERVIEW CARDS                                  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative bg-[#0B0F19] hover:bg-[#0E1424] border border-white/[0.06] hover:border-blue-500/30 p-5 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Total Emails</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight">{mails.length}</span>
              <span className="text-[11px] text-blue-400">Captured in Realtime</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group relative bg-[#0B0F19] hover:bg-[#0E1424] border border-white/[0.06] hover:border-purple-500/30 p-5 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">IMAP Mailboxes</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight">{users.length}</span>
              <span className="text-[11px] text-purple-400">Authenticated Accounts</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group relative bg-[#0B0F19] hover:bg-[#0E1424] border border-white/[0.06] hover:border-emerald-500/30 p-5 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Security & SSL</span>
              <span className="text-xl font-bold text-emerald-400 font-mono tracking-tight mt-1">TLS / SSL 993</span>
              <span className="text-[11px] text-gray-400">Encrypted Transmission</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="group relative bg-[#0B0F19] hover:bg-[#0E1424] border border-white/[0.06] hover:border-amber-500/30 p-5 rounded-2xl transition-all duration-300 shadow-xl overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider font-mono">Storage Engine</span>
              <span className="text-xl font-bold text-amber-400 font-mono tracking-tight mt-1">Zero-Duplication</span>
              <span className="text-[11px] text-gray-400">Hardlinked .eml Storage</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. NAVIGATION PILLS & SEARCH BAR                         */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0F19] border border-white/[0.08] p-2 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/[0.04] overflow-x-auto">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "explorer"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span>Live Inbox Explorer</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">{mails.length}</span>
          </button>

          <button
            onClick={() => setActiveTab("accounts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "accounts"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>IMAP Accounts</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">{users.length}</span>
          </button>

          <button
            onClick={() => setActiveTab("guides")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "guides"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30"
                : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <span>Client Integration</span>
          </button>
        </div>

        {/* Filter / Search Controls */}
        <div className="flex items-center gap-2 px-2">
          {activeTab === "explorer" && (
            <select
              value={filterMailbox}
              onChange={(e) => setFilterMailbox(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/60 font-medium"
            >
              <option value="ALL">📁 All Mailboxes ({mails.length})</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  👤 {u.email}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sender, subject..."
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TAB 1: LIVE INBOX EXPLORER (2-PANE VIEWER)            */}
      {/* ======================================================== */}
      {activeTab === "explorer" && (
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 w-full min-h-[640px]">
          {/* Left Email Feed Pane */}
          <div className="bg-[#0B0F19] border border-white/[0.08] rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/[0.06] bg-[#0E1424] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-bold text-xs text-white uppercase tracking-wider">Incoming Feed</span>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">
                {filteredMails.length} {filteredMails.length === 1 ? "Message" : "Messages"}
              </span>
            </div>

            <div className="flex-grow overflow-y-auto max-h-[680px] divide-y divide-white/[0.04]">
              {loading ? (
                <div className="p-16 text-center text-blue-400 flex flex-col items-center gap-3">
                  <span className="animate-spin inline-block w-8 h-8 border-3 border-current border-t-transparent rounded-full" />
                  <span className="text-xs font-mono text-gray-400">Loading incoming messages...</span>
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="p-16 text-center text-gray-500 text-xs flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <strong className="text-white">No Emails Found</strong>
                  <p className="text-gray-400 max-w-xs leading-relaxed">
                    Send a test email to your server to see it appear here in real-time.
                  </p>
                </div>
              ) : (
                filteredMails
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((mail) => {
                  const isSelected = selectedMail?.id === mail.id;
                  const senderName = getSenderName(mail.from);
                  const initial = getSenderInitial(mail.from);
                  const avatarGrad = getAvatarGradient(mail.from);

                  return (
                    <div
                      key={mail.id}
                      onClick={() => setSelectedMail(mail)}
                      className={`p-4 cursor-pointer transition-all duration-200 border-l-4 flex gap-3.5 items-start ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500 shadow-inner"
                          : "border-transparent hover:bg-white/[0.02]"
                      }`}
                    >
                      {/* Avatar Circle */}
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0 mt-0.5`}>
                        {initial}
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-xs text-white truncate">
                            {senderName}
                          </span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap font-mono">
                            {new Date(mail.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-gray-200 truncate mb-1.5">
                          {mail.subject || "(No Subject)"}
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-blue-400/90 font-mono truncate max-w-[180px] bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                            {mail.to}
                          </span>
                          {mail.attachments && mail.attachments.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono flex items-center gap-1">
                              📎 {mail.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredMails.length > 0 && (
              <div className="p-3 border-t border-white/[0.06] bg-[#0E1424] flex items-center justify-between z-10 flex-shrink-0">
                <span className="text-[11px] font-mono text-gray-400">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredMails.length)}-
                  {Math.min(currentPage * itemsPerPage, filteredMails.length)} of {filteredMails.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 disabled:opacity-30 disabled:pointer-events-none border border-white/[0.06]"
                  >
                    ←
                  </button>
                  <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {currentPage}/{Math.max(1, Math.ceil(filteredMails.length / itemsPerPage))}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredMails.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredMails.length / itemsPerPage)}
                    className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 disabled:opacity-30 disabled:pointer-events-none border border-white/[0.06]"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Message Viewport Pane */}
          <div className="bg-[#0B0F19] border border-white/[0.08] rounded-3xl flex flex-col overflow-hidden shadow-2xl min-h-[640px]">
            {selectedMail ? (
              <div className="flex flex-col h-full">
                {/* Email Header Card */}
                <div className="p-6 border-b border-white/[0.08] bg-[#0E1424] flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold font-mono">
                          RFC822 Maildir Synced
                        </span>
                        <span className="px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono">
                          Live Ingestion
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight leading-snug break-words">
                        {selectedMail.subject || "(No Subject)"}
                      </h2>
                    </div>

                    {/* Format Toggle & Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex bg-black/50 border border-white/10 rounded-xl p-1 shadow-inner">
                        <button
                          onClick={() => setViewMode("html")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            viewMode === "html" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          HTML
                        </button>
                        <button
                          onClick={() => setViewMode("text")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            viewMode === "text" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Text
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteEmail(selectedMail.fileName, selectedMail.type)}
                        title="Delete Email"
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Sender & Recipient Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-black/40 border border-white/[0.04] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(selectedMail.from)} flex items-center justify-center text-white font-bold text-xs`}>
                        {getSenderInitial(selectedMail.from)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">From</span>
                        <span className="text-xs font-semibold text-white truncate block font-mono">{selectedMail.from}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                        📥
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">Recipient (To)</span>
                        <span className="text-xs font-semibold text-blue-300 truncate block font-mono">{selectedMail.to}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400 font-mono pt-1">
                    <div className="flex items-center gap-2">
                      <span>🕒 {new Date(selectedMail.date).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>🌐 IP: <code className="text-gray-300 font-bold">{selectedMail.senderIp || "N/A"}</code></span>
                    </div>
                  </div>

                  {/* Attachments Row */}
                  {selectedMail.attachments && selectedMail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.04]">
                      {selectedMail.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={`${apiUrl}${att.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 text-xs text-blue-300 font-medium transition-all group shadow-sm"
                        >
                          <span className="text-sm">📎</span>
                          <span className="font-semibold text-white group-hover:text-blue-300">{att.filename}</span>
                          <span className="text-[10px] text-gray-400 font-mono">({formatBytes(att.size)})</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email Body Area */}
                <div className="p-6 flex-grow overflow-y-auto bg-[#070A13]">
                  {viewMode === "html" && selectedMail.html ? (
                    <div
                      className="prose prose-invert max-w-none text-white text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: selectedMail.html }}
                    />
                  ) : (
                    <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap leading-relaxed bg-black/40 p-5 rounded-2xl border border-white/[0.05]">
                      {selectedMail.text || selectedMail.html || "(No textual content in message)"}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-16 text-center text-gray-500 relative">
                <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-4 text-gray-500 shadow-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="w-10 h-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-1">Select an email to view</h3>
                <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                  Choose any email from the left inbox feed to read its full formatted HTML body, inspect headers, or download attachments.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. TAB 2: IMAP ACCOUNTS TABLE                            */}
      {/* ======================================================== */}
      {activeTab === "accounts" && (
        <div className="bg-[#0B0F19] border border-white/[0.08] rounded-3xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/[0.08] bg-[#0E1424] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Configured IMAP Accounts</h2>
              <p className="text-xs text-gray-400">Click &quot;View Credentials&quot; to copy host, ports, and login details for client apps.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h3 className="text-white font-bold mb-1">No IMAP Accounts Configured</h3>
              <p className="text-xs text-gray-400 max-w-sm">Create user mailbox accounts in the Users Mailbox tab to manage them here via IMAP.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#0E1424]/70 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Account / Email</th>
                    <th className="px-6 py-4">Project Context</th>
                    <th className="px-6 py-4">IMAP Host</th>
                    <th className="px-6 py-4">SSL Port</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                          <span className="font-bold">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.project_name ? (
                          <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20 font-medium">
                            {u.project_name}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-medium">
                            Global
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-300">
                        {getImapHost(u.email)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-emerald-400 font-semibold">
                        993 (SSL) / 143
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedUserForModal(u);
                            setShowPassword(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all shadow-sm cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          <span>View Credentials</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. TAB 3: CLIENT INTEGRATION GUIDES                      */}
      {/* ======================================================== */}
      {activeTab === "guides" && (
        <div className="bg-[#0B0F19] border border-white/[0.08] rounded-3xl p-6 lg:p-8 shadow-2xl flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Client Integration & Code Snippets</h2>
            <p className="text-xs text-gray-400 mt-1">Connect your desktop, mobile mail clients, or automated worker scripts to your IMAP server.</p>
          </div>

          <div className="flex gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
            {(["outlook", "thunderbird", "apple", "python", "node"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setGuideClient(tab)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all capitalize cursor-pointer ${
                  guideClient === tab
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {tab === "apple" ? "Apple Mail" : tab}
              </button>
            ))}
          </div>

          <div className="bg-black/50 border border-white/10 rounded-2xl p-6 font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
            {guideClient === "outlook" && (
              <div className="flex flex-col gap-3">
                <p className="text-blue-400 font-bold"># Microsoft Outlook Setup Instructions</p>
                <p>1. Open Outlook ➔ Click <strong>Add Account</strong> ➔ Choose <strong>Manual setup or additional server types</strong>.</p>
                <p>2. Choose <strong>POP or IMAP</strong> ➔ Account Type: <strong>IMAP</strong>.</p>
                <p>3. Incoming mail server: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">mail.yourdomain.com</code></p>
                <p>4. Incoming server port: <code className="text-emerald-400 bg-white/10 px-2 py-0.5 rounded font-bold">993</code> | Encryption: <strong className="text-white">SSL/TLS</strong></p>
                <p>5. User Name: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">your-user@yourdomain.com</code></p>
                <p>6. Password: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">[Your Account Password]</code></p>
              </div>
            )}

            {guideClient === "thunderbird" && (
              <div className="flex flex-col gap-3">
                <p className="text-emerald-400 font-bold"># Mozilla Thunderbird Setup</p>
                <p>1. Open Thunderbird ➔ <strong>Account Settings</strong> ➔ <strong>Add Mail Account</strong>.</p>
                <p>2. Protocol: <strong>IMAP</strong></p>
                <p>3. Server Hostname: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">mail.yourdomain.com</code> | Port: <code className="text-emerald-400 bg-white/10 px-2 py-0.5 rounded font-bold">993</code></p>
                <p>4. SSL: <strong>SSL/TLS</strong> | Authentication: <strong>Normal Password</strong></p>
                <p>5. Username: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">your-user@yourdomain.com</code></p>
              </div>
            )}

            {guideClient === "apple" && (
              <div className="flex flex-col gap-3">
                <p className="text-purple-400 font-bold"># Apple Mail / iOS Mail Setup</p>
                <p>1. Go to <strong>Settings</strong> ➔ <strong>Mail</strong> ➔ <strong>Accounts</strong> ➔ <strong>Add Account</strong> ➔ <strong>Other</strong>.</p>
                <p>2. Select <strong>Add Mail Account</strong> ➔ Enter your Name, Email, and Password.</p>
                <p>3. Account Type: <strong>IMAP</strong></p>
                <p>4. Incoming Mail Server Host: <code className="text-white bg-white/10 px-2 py-0.5 rounded font-bold">mail.yourdomain.com</code> | Port: <code className="text-emerald-400 bg-white/10 px-2 py-0.5 rounded font-bold">993</code></p>
                <p>5. Enable <strong>Use SSL</strong> ➔ Authentication: <strong>Password</strong>.</p>
              </div>
            )}

            {guideClient === "python" && (
              <div className="flex flex-col gap-3">
                <p className="text-amber-400 font-bold"># Python 3 imaplib Integration Example</p>
                <pre className="text-gray-200">
{`import imaplib
import email

# Connect securely via Port 993 SSL
mail = imaplib.IMAP4_SSL("mail.yourdomain.com", 993)
mail.login("your-user@yourdomain.com", "your_password")

# Select INBOX folder
mail.select("INBOX")
status, messages = mail.search(None, "ALL")

for msg_id in messages[0].split():
    status, data = mail.fetch(msg_id, "(RFC822)")
    raw_email = data[0][1]
    msg = email.message_from_bytes(raw_email)
    print("Subject:", msg["Subject"], "From:", msg["From"])

mail.logout()`}
                </pre>
              </div>
            )}

            {guideClient === "node" && (
              <div className="flex flex-col gap-3">
                <p className="text-cyan-400 font-bold"># Node.js / Bun imap-simple Example</p>
                <pre className="text-gray-200">
{`import imaps from 'imap-simple';

const config = {
  imap: {
    user: 'your-user@yourdomain.com',
    password: 'your_password',
    host: 'mail.yourdomain.com',
    port: 993,
    tls: true,
    authTimeout: 5000
  }
};

const connection = await imaps.connect(config);
await connection.openBox('INBOX');
const searchCriteria = ['ALL'];
const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };
const messages = await connection.search(searchCriteria, fetchOptions);

console.log('Total messages in INBOX:', messages.length);
connection.end();`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CREDENTIALS POPUP MODAL                               */}
      {/* ======================================================== */}
      {selectedUserForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0B0F19] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[#0E1424] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Client IMAP Credentials</h3>
                  <p className="text-xs text-gray-400 font-mono">{selectedUserForModal.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForModal(null)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Host */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IMAP Server / Host</label>
                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white">
                  <span>{getImapHost(selectedUserForModal.email)}</span>
                  <button
                    onClick={() => copyToClipboard(getImapHost(selectedUserForModal.email), "host")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                  >
                    {copiedKey === "host" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IMAP Port (SSL)</label>
                  <div className="flex items-center justify-between bg-black/50 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400">
                    <span>993 (SSL)</span>
                    <button
                      onClick={() => copyToClipboard("993", "port993")}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-sans font-semibold transition-colors cursor-pointer"
                    >
                      {copiedKey === "port993" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IMAP Port (Plain)</label>
                  <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-300">
                    <span>143</span>
                    <button
                      onClick={() => copyToClipboard("143", "port143")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                    >
                      {copiedKey === "port143" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Username / Email</label>
                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white">
                  <span>{selectedUserForModal.email}</span>
                  <button
                    onClick={() => copyToClipboard(selectedUserForModal.email, "email")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                  >
                    {copiedKey === "email" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white">
                  <span>
                    {showPassword
                      ? selectedUserForModal.plain_password || "Password hash in DB"
                      : "••••••••••••"}
                  </span>
                  {selectedUserForModal.plain_password && (
                    <button
                      onClick={() => copyToClipboard(selectedUserForModal.plain_password || "", "pass")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                    >
                      {copiedKey === "pass" ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Copy All */}
              <button
                onClick={() => {
                  const payload = `IMAP Host: ${getImapHost(selectedUserForModal.email)}\nIMAP Port: 993 (SSL) / 143 (Plain)\nUsername: ${selectedUserForModal.email}\nPassword: ${selectedUserForModal.plain_password || ""}\nEncryption: SSL/TLS`;
                  copyToClipboard(payload, "all");
                }}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-2xl shadow-lg transition-all text-xs cursor-pointer"
              >
                {copiedKey === "all" ? "✓ Credentials Copied!" : "Copy Full IMAP Setup String"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
