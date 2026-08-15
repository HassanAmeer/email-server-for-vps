"use client";

import { useState, useEffect } from "react";

interface mailboxUser {
  id: number;
  email: string;
  plain_password?: string;
  project_id: number | null;
  project_name: string | null;
  created_at: string;
  received_count: number;
}

interface MailboxManagerProps {
  apiUrl: string;
}

export default function MailboxManager({ apiUrl }: MailboxManagerProps) {
  const [users, setUsers] = useState<mailboxUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [domains, setDomains] = useState<{domain: string; is_primary?: boolean | number}[]>([]);
  const [projects, setProjects] = useState<{id: number, name: string}[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImapUser, setSelectedImapUser] = useState<mailboxUser | null>(null);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 50;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
        setError("");
      } else {
        throw new Error("Failed to load mailbox users");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mailbox users");
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/domains`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Sanitize domains to remove http://, https:// and trailing slashes
        const sanitizedData = data.map((d: any) => ({
          ...d,
          domain: d.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
        }));
        setDomains(sanitizedData);
        const primary = sanitizedData.find((d: any) => d.is_primary === 1 || d.is_primary === true);
        if (primary) {
          setSelectedDomain(primary.domain);
        } else if (sanitizedData.length > 0) {
          setSelectedDomain(sanitizedData[0].domain);
        }
      }
    } catch (err: any) {
      console.error("Failed to load domains", err);
    }
  };

  const fetchProjects = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/projects`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProject(data[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDomains();
    fetchProjects();
  }, [apiUrl]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !selectedDomain || !newPassword || !selectedProject) return;
    
    setCreating(true);
    const fullEmail = `${newUsername}@${selectedDomain}`;
    
    try {
      const res = await fetch(`${apiUrl}/api/admin/mailbox-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
        },
        body: JSON.stringify({
          email: fullEmail,
          password: newPassword,
          project_id: selectedProject
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mailbox user");
      }

      setNewUsername("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, email: string) => {
    if (!window.confirm(`Are you sure you want to delete mailbox user ${email}?`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/mailbox-users/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
        }
      });

      if (!res.ok) {
        throw new Error("Failed to delete user");
      }

      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center text-emerald-500">
        <span className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getImapHost = (email: string) => {
    const domain = email.split("@")[1];
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return domain ? `mail.${domain}` : hostname;
      }
    }
    return domain ? `mail.${domain}` : "127.0.0.1";
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-6 py-3 bg-[#111726]/30 border-t border-b border-white/[0.04]">
        <div className="text-sm text-gray-400">
          Showing <span className="font-medium text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-white">{Math.min(currentPage * ITEMS_PER_PAGE, users.length)}</span> of <span className="font-medium text-white">{users.length}</span> results
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-white/10 text-white transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-400 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-white/10 text-white transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 flex-grow overflow-y-auto max-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Users Mailbox Accounts & IMAP</h1>
          <p className="text-sm text-gray-400">Manage user mailbox accounts with full standard IMAP (Ports 993 & 143) and API support.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl self-start">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-400 font-mono">IMAP Server Ready (993/143)</span>
        </div>
      </div>

      {/* Top Banner: Quick IMAP Guide */}
      <div className="bg-gradient-to-r from-blue-950/40 via-[#0D121F] to-emerald-950/20 border border-blue-500/20 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-0.5">Client Direct IMAP Access</h3>
            <p className="text-xs text-gray-400">
              Clients can connect third-party email apps (Outlook, Apple Mail, Thunderbird, Python/PHP scripts) directly via standard IMAP without using REST APIs.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-gray-300 bg-black/40 border border-white/10 px-4 py-2 rounded-xl flex-shrink-0">
          <span>IMAPS SSL: <strong className="text-emerald-400">993</strong></span>
          <span className="text-gray-600">|</span>
          <span>IMAP Plain: <strong className="text-blue-400">143</strong></span>
        </div>
      </div>

      {/* Create Account Form */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Create New User Mailbox Account</h2>
        {domains.length === 0 ? (
          <div className="text-sm text-amber-400 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
            Please add at least one domain in the Setup tab before creating mailbox accounts.
          </div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-amber-400 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
            Please create at least one project before creating mailbox accounts.
          </div>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col xl:flex-row gap-4 items-end">
            <div className="flex flex-col gap-1.5 w-full xl:w-[50%]">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <div className="flex bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase())}
                  placeholder="admin"
                  className="bg-transparent px-4 py-2.5 text-sm text-white focus:outline-none w-full placeholder:text-gray-600"
                  required
                />
                <div className="flex items-center px-2 text-gray-400 font-mono text-sm bg-white/5 border-l border-white/10">@</div>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="bg-transparent px-3 py-2.5 text-sm text-emerald-400 font-medium focus:outline-none cursor-pointer hover:bg-white/5 transition-colors"
                  required
                >
                  {domains.map((d, i) => (
                    <option key={i} value={d.domain} className="bg-[#0D121F] text-white">
                      {d.domain} {d.is_primary === 1 || d.is_primary === true ? "★ (Primary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-full xl:w-[25%]">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Project</label>
              <select
                value={selectedProject || ""}
                onChange={(e) => setSelectedProject(Number(e.target.value))}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0D121F] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 w-full xl:w-[25%]">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-gray-600"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold px-6 py-2.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {creating ? "Creating..." : "Create Account"}
            </button>
          </form>
        )}
      </div>

      {/* Existing Accounts Table */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/[0.06] bg-[#111726] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Existing Accounts ({users.length})</h2>
          <span className="text-xs text-gray-400">Click &quot;IMAP Details&quot; to view client connection settings</span>
        </div>
        {error ? (
          <div className="p-8 text-center text-red-400 text-sm font-semibold">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-1">No User Mailbox Accounts</h3>
            <p className="text-sm text-gray-400 max-w-sm">Create an account above to start receiving emails via IMAP or API.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex flex-col">
            {renderPagination()}
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#111726]/50 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">Context / Project</th>
                  <th className="px-6 py-4 text-center">Received Emails</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2.5">
                        <span>{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.project_name ? (
                        <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20">{u.project_name}</span>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Global Account</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-black/40 border border-white/10 px-3 py-1 rounded-full text-emerald-400 font-bold font-mono text-xs">
                        {u.received_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedImapUser(u);
                            setShowImapPassword(false);
                          }}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors shadow-sm"
                          title="View IMAP Connection Details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          <span>IMAP Details</span>
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.email)}
                          className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-colors border border-red-500/20"
                          title="Delete User"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* IMAP Connection Details Modal */}
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
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Provide these connection credentials to your client to configure Outlook, Thunderbird, Apple Mail, or custom apps.
              </p>

              {/* Server Host */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Server / Host</label>
                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white">
                  <span>{getImapHost(selectedImapUser.email)}</span>
                  <button
                    onClick={() => copyToClipboard(getImapHost(selectedImapUser.email), "host")}
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors"
                  >
                    {copiedKey === "host" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Ports */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Port (SSL/TLS)</label>
                  <div className="flex items-center justify-between bg-black/40 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm font-mono text-emerald-400">
                    <span>993 (SSL)</span>
                    <button
                      onClick={() => copyToClipboard("993", "port993")}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-sans font-semibold transition-colors"
                    >
                      {copiedKey === "port993" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Port (STARTTLS)</label>
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-300">
                    <span>143</span>
                    <button
                      onClick={() => copyToClipboard("143", "port143")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors"
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
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors"
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
                    className="text-xs text-gray-400 hover:text-white transition-colors"
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
                      className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors"
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
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all text-xs"
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
