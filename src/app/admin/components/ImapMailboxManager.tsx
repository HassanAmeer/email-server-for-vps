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
  // Navigation sub-tabs inside IMAP Mailbox
  const [activeSubTab, setActiveSubTab] = useState<"emails" | "accounts" | "guides">("emails");

  // Accounts state
  const [users, setUsers] = useState<MailboxUser[]>([]);
  const [selectedImapUser, setSelectedImapUser] = useState<MailboxUser | null>(null);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Emails & Explorer state
  const [mails, setMails] = useState<Email[]>([]);
  const [selectedMail, setSelectedMail] = useState<Email | null>(null);
  const [selectedMailboxFilter, setSelectedMailboxFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [loading, setLoading] = useState(true);

  // Guides state
  const [activeSnippetTab, setActiveSnippetTab] = useState<"outlook" | "thunderbird" | "python" | "node">("outlook");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getImapHost = (email?: string) => {
    if (email && email.includes("@")) {
      const domain = email.split("@")[1];
      return `mail.${domain}`;
    }
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
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
          "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error loading IMAP users:", err);
    }
  };

  const fetchMails = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/mails`);
      if (res.ok) {
        const data = await res.json();
        setMails(data);
        if (selectedMail) {
          const updated = data.find((m: Email) => m.id === selectedMail.id);
          if (updated) setSelectedMail(updated);
        }
      }
    } catch (err) {
      console.error("Error loading mails:", err);
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

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Filtered emails based on search query and mailbox filter
  const filteredMails = mails.filter((m) => {
    const matchesSearch =
      m.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedMailboxFilter !== "ALL") {
      return m.to.toLowerCase().includes(selectedMailboxFilter.toLowerCase());
    }

    return true;
  });

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.project_name && u.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8 flex-grow overflow-y-auto max-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">IMAP Mailbox</h1>
            <p className="text-xs text-gray-400">All received emails, live Maildir storage, and IMAP client credentials.</p>
          </div>
        </div>

        {/* Live Service Indicator */}
        <div className="flex items-center gap-2 bg-[#0D121F] border border-blue-500/20 px-4 py-2 rounded-xl self-start">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-blue-300 font-mono">Dovecot IMAP Active (993 / 143)</span>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-1 gap-4 overflow-x-auto">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab("emails")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "emails"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
            </svg>
            <span>All Received Emails</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/40 text-[10px] font-mono">{mails.length}</span>
          </button>

          <button
            onClick={() => setActiveSubTab("accounts")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "accounts"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>IMAP Accounts</span>
            <span className="px-1.5 py-0.2 rounded-md bg-black/40 text-[10px] font-mono">{users.length}</span>
          </button>

          <button
            onClick={() => setActiveSubTab("guides")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "guides"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <span>Client Setup Guides</span>
          </button>
        </div>

        {/* Quick Filter or Search */}
        {activeSubTab === "emails" && (
          <div className="flex items-center gap-3">
            <select
              value={selectedMailboxFilter}
              onChange={(e) => setSelectedMailboxFilter(e.target.value)}
              className="bg-[#0D121F] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Mailboxes</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. ALL RECEIVED EMAILS EXPLORER                          */}
      {/* ======================================================== */}
      {activeSubTab === "emails" && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 w-full min-h-[600px]">
          {/* Left Column: Email List */}
          <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/[0.06] flex flex-col gap-3 bg-[#111726]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">Inbox Stream</span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {filteredMails.length} {filteredMails.length === 1 ? "Mail" : "Mails"}
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, sender, to..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex-grow overflow-y-auto max-h-[650px] divide-y divide-white/[0.04]">
              {loading ? (
                <div className="p-12 text-center text-blue-400">
                  <span className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full" />
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 opacity-40">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span>No emails found for this mailbox</span>
                </div>
              ) : (
                filteredMails.map((mail) => {
                  const isSelected = selectedMail?.id === mail.id;
                  return (
                    <div
                      key={mail.id}
                      onClick={() => setSelectedMail(mail)}
                      className={`p-4 cursor-pointer transition-all border-l-2 ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500"
                          : "border-transparent hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-xs text-white truncate max-w-[200px]">
                          {mail.from || "Unknown Sender"}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap font-mono">
                          {new Date(mail.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-200 truncate mb-1">
                        {mail.subject || "(No Subject)"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-blue-400/90 font-mono truncate max-w-[200px]">
                          To: {mail.to}
                        </span>
                        {mail.attachments && mail.attachments.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono flex items-center gap-1">
                            📎 {mail.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Email Content Preview */}
          <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {selectedMail ? (
              <div className="flex flex-col h-full">
                {/* Email Header */}
                <div className="p-6 border-b border-white/[0.06] bg-[#111726] flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1">
                        {selectedMail.subject || "(No Subject)"}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-gray-300 font-semibold">From: <span className="text-white font-mono">{selectedMail.from}</span></span>
                        <span className="text-gray-500">•</span>
                        <span className="text-blue-400 font-semibold">To: <span className="text-blue-300 font-mono">{selectedMail.to}</span></span>
                      </div>
                    </div>

                    {/* Format Toggle & Badge */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold font-mono border border-blue-500/20">
                        RFC822 Maildir Synced
                      </span>
                      <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5">
                        <button
                          onClick={() => setViewMode("html")}
                          className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                            viewMode === "html" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          HTML
                        </button>
                        <button
                          onClick={() => setViewMode("text")}
                          className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                            viewMode === "text" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Text
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.04] text-[11px] text-gray-400 font-mono">
                    <div>Date: {new Date(selectedMail.date).toLocaleString()}</div>
                    <div>Sender IP: {selectedMail.senderIp}</div>
                  </div>

                  {/* Attachments Row */}
                  {selectedMail.attachments && selectedMail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedMail.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={`${apiUrl}${att.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-blue-300 font-medium transition-colors"
                        >
                          <span>📎</span>
                          <span>{att.filename}</span>
                          <span className="text-[10px] text-gray-500">({formatBytes(att.size)})</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email Body */}
                <div className="p-6 flex-grow overflow-y-auto bg-black/30">
                  {viewMode === "html" && selectedMail.html ? (
                    <div
                      className="prose prose-invert max-w-none text-white text-sm"
                      dangerouslySetInnerHTML={{ __html: selectedMail.html }}
                    />
                  ) : (
                    <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {selectedMail.text || selectedMail.html || "(Empty Email Content)"}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-12 text-center text-gray-500">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-3 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h4 className="text-white font-bold mb-1">Select an email to read</h4>
                <p className="text-xs text-gray-400 max-w-xs">
                  Choose any email from the left stream to inspect the message body, attachments, and headers.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. IMAP ACCOUNTS & CREDENTIALS                           */}
      {/* ======================================================== */}
      {activeSubTab === "accounts" && (
        <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/[0.06] bg-[#111726] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">IMAP Accounts</h2>
              <p className="text-xs text-gray-400">Click &quot;View IMAP Details&quot; to copy host, ports, and login details for client apps.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <h3 className="text-white font-bold mb-1">No IMAP Accounts Found</h3>
              <p className="text-xs text-gray-400">Create user mailbox accounts in the Users Mailbox tab to manage them here via IMAP.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#111726]/50 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Account / Email</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">IMAP Host</th>
                    <th className="px-6 py-4">SSL Port</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.project_name ? (
                          <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20">{u.project_name}</span>
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Global</span>
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
                            setSelectedImapUser(u);
                            setShowImapPassword(false);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all shadow-sm cursor-pointer"
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
      {/* 3. CLIENT SETUP GUIDES                                   */}
      {/* ======================================================== */}
      {activeSubTab === "guides" && (
        <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white">Client Setup Guide & Code Snippets</h2>
          
          <div className="flex gap-2 border-b border-white/10 pb-3">
            {(["outlook", "thunderbird", "python", "node"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSnippetTab(tab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors capitalize cursor-pointer ${
                  activeSnippetTab === tab 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-black/50 border border-white/10 rounded-xl p-5 font-mono text-xs text-gray-300 overflow-x-auto leading-relaxed">
            {activeSnippetTab === "outlook" && (
              <div>
                <p className="text-emerald-400 font-bold mb-2"># Microsoft Outlook / Apple Mail Configuration</p>
                <p>1. Open Outlook -&gt; Add Account -&gt; Manual Setup -&gt; Select &quot;POP or IMAP&quot;</p>
                <p>2. Account Type: <strong>IMAP</strong></p>
                <p>3. Incoming Mail Server: <strong>mail.yourdomain.com</strong></p>
                <p>4. Incoming Port: <strong>993</strong> with <strong>SSL/TLS</strong></p>
                <p>5. Username: <strong>your-email@yourdomain.com</strong></p>
                <p>6. Password: <strong>[Your Password]</strong></p>
              </div>
            )}

            {activeSnippetTab === "thunderbird" && (
              <div>
                <p className="text-emerald-400 font-bold mb-2"># Mozilla Thunderbird Setup</p>
                <p>1. Account Settings -&gt; Account Actions -&gt; Add Mail Account</p>
                <p>2. Protocol: <strong>IMAP</strong></p>
                <p>3. Hostname: <strong>mail.yourdomain.com</strong> | Port: <strong>993</strong> | SSL: <strong>SSL/TLS</strong></p>
                <p>4. Authentication: <strong>Normal Password</strong></p>
                <p>5. Username: <strong>your-email@yourdomain.com</strong></p>
              </div>
            )}

            {activeSnippetTab === "python" && (
              <div>
                <p className="text-purple-400 font-bold mb-2"># Python imaplib Example</p>
                <pre className="text-gray-300">
{`import imaplib

# Connect securely via SSL on port 993
mail = imaplib.IMAP4_SSL("mail.yourdomain.com", 993)
mail.login("user@yourdomain.com", "your_password")

# Select inbox and fetch messages
mail.select("INBOX")
status, messages = mail.search(None, "ALL")
print("Found message IDs:", messages[0].split())
mail.logout()`}
                </pre>
              </div>
            )}

            {activeSnippetTab === "node" && (
              <div>
                <p className="text-blue-400 font-bold mb-2"># Node.js / Bun IMAP Client Example (imap-simple)</p>
                <pre className="text-gray-300">
{`import imaps from 'imap-simple';

const config = {
  imap: {
    user: 'user@yourdomain.com',
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
const fetchOptions = { bodies: ['HEADER', 'TEXT'] };
const messages = await connection.search(searchCriteria, fetchOptions);
console.log('Total messages:', messages.length);
connection.end();`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMAP Credentials Modal */}
      {selectedImapUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-[#111726] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Client IMAP Credentials</h3>
                  <p className="text-xs text-gray-400 font-mono">{selectedImapUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedImapUser(null)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Server Host */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Server / Host</label>
                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white">
                  <span>{getImapHost(selectedImapUser.email)}</span>
                  <button
                    onClick={() => copyToClipboard(getImapHost(selectedImapUser.email), "host")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                  >
                    {copiedKey === "host" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Port (SSL)</label>
                  <div className="flex items-center justify-between bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm font-mono text-emerald-400">
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
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Port (Plain)</label>
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-300">
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
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username / Email</label>
                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white">
                  <span>{selectedImapUser.email}</span>
                  <button
                    onClick={() => copyToClipboard(selectedImapUser.email, "email")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                  >
                    {copiedKey === "email" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowImapPassword(!showImapPassword)}
                    className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showImapPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white">
                  <span>
                    {showImapPassword 
                      ? (selectedImapUser.plain_password || "Password hash stored in DB") 
                      : "••••••••••••"}
                  </span>
                  {selectedImapUser.plain_password && (
                    <button
                      onClick={() => copyToClipboard(selectedImapUser.plain_password || "", "pass")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
                    >
                      {copiedKey === "pass" ? "Copied!" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Copy All Details */}
              <button
                onClick={() => {
                  const payload = `IMAP Host: ${getImapHost(selectedImapUser.email)}\nIMAP Port: 993 (SSL) / 143 (Plain)\nUsername: ${selectedImapUser.email}\nPassword: ${selectedImapUser.plain_password || ""}\nEncryption: SSL/TLS`;
                  copyToClipboard(payload, "all");
                }}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all text-xs cursor-pointer"
              >
                {copiedKey === "all" ? "✓ All Credentials Copied to Clipboard!" : "Copy Full IMAP Setup Details"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
