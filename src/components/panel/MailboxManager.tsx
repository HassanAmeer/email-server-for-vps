"use client";

import { useState, useEffect } from "react";

interface mailboxUser {
  id: number;
  email: string;
  project_id: number | null;
  project_name: string | null;
  created_at: string;
  received_count: number;
}

interface MailboxManagerProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
}

export default function MailboxManager({ apiUrl, apiPrefix = "/api/admin", tokenKey = "admin_token" }: MailboxManagerProps) {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage] = useState(50);

  const fetchUsers = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}${apiPrefix}/mailbox-users`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(tokenKey)}`
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
      const res = await fetch(`${apiUrl}${apiPrefix}/domains`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(tokenKey)}`
        }
      });
      if (res.ok) {
        const data = await res.json();
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
      const res = await fetch(`${apiUrl}${apiPrefix}/projects`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(tokenKey)}`
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
  }, [apiUrl, apiPrefix, tokenKey]);

  const filteredUsers = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.project_name && u.project_name.toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Keep currentPage valid when list changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !selectedDomain || !newPassword || !selectedProject) return;
    
    setCreating(true);
    const fullEmail = `${newUsername}@${selectedDomain}`;
    
    try {
      const res = await fetch(`${apiUrl}${apiPrefix}/mailbox-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem(tokenKey)}`
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
      const res = await fetch(`${apiUrl}${apiPrefix}/mailbox-users/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem(tokenKey)}`
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

  const renderPagination = (position: "top" | "bottom") => {
    if (filteredUsers.length === 0) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredUsers.length);

    // Generate page numbers window (up to 5 pages around current)
    const getPageNumbers = () => {
      const delta = 2;
      const range: number[] = [];
      for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
      }
      return range;
    };

    const middlePages = getPageNumbers();

    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 bg-[#0e1424]/90 backdrop-blur-md ${
        position === "top" ? "border-b border-white/[0.06]" : "border-t border-white/[0.06]"
      }`}>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            Showing <strong className="font-bold text-white">{startItem}</strong>–<strong className="font-bold text-white">{endItem}</strong> of <strong className="font-bold text-emerald-400">{filteredUsers.length}</strong> mailboxes
          </span>
          <span className="text-gray-600 font-mono">|</span>
          <span className="text-gray-500 font-mono text-[11px]">50 users/page</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {/* First Button */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
            title="First Page"
          >
            « First
          </button>

          {/* Prev Button */}
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
            title="Previous Page"
          >
            ‹ Prev
          </button>

          {/* Page 1 */}
          <button
            onClick={() => setCurrentPage(1)}
            className={`min-w-[28px] px-2 py-1 text-xs rounded-lg font-bold font-mono transition-all ${
              currentPage === 1
                ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.06]"
            }`}
          >
            1
          </button>

          {/* Left Ellipsis */}
          {middlePages.length > 0 && middlePages[0] > 2 && (
            <span className="text-gray-600 px-1 font-mono text-xs">...</span>
          )}

          {/* Middle Pages */}
          {middlePages.map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`min-w-[28px] px-2 py-1 text-xs rounded-lg font-bold font-mono transition-all ${
                currentPage === page
                  ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.06]"
              }`}
            >
              {page}
            </button>
          ))}

          {/* Right Ellipsis */}
          {middlePages.length > 0 && middlePages[middlePages.length - 1] < totalPages - 1 && (
            <span className="text-gray-600 px-1 font-mono text-xs">...</span>
          )}

          {/* Last Page (if totalPages > 1) */}
          {totalPages > 1 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`min-w-[28px] px-2 py-1 text-xs rounded-lg font-bold font-mono transition-all ${
                currentPage === totalPages
                  ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/[0.06]"
              }`}
            >
              {totalPages}
            </button>
          )}

          {/* Next Button */}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
            title="Next Page"
          >
            Next ›
          </button>

          {/* Last Button */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1 text-xs rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
            title="Last Page"
          >
            Last »
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 flex-grow">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Users Mailbox Accounts</h1>
        <p className="text-sm text-gray-400">Manage permanent user mailbox email accounts linked to projects and domains.</p>
      </div>

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

      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-5 md:p-6 border-b border-white/[0.06] bg-[#111726] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Existing Accounts ({users.length})</h2>
            {filteredUsers.length !== users.length && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                {filteredUsers.length} filtered
              </span>
            )}
          </div>

          {/* Search Box */}
          {users.length > 0 && (
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search mailbox or project..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          )}
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
            <p className="text-sm text-gray-400 max-w-sm">Create an account above to start receiving and sending emails globally.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No mailbox accounts matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="overflow-x-auto flex flex-col">
            {/* Top Pagination */}
            {renderPagination("top")}

            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#111726]/50 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">Context</th>
                  <th className="px-6 py-4 text-center">Received Emails</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-white">{u.email}</td>
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
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-colors border border-red-500/20"
                        title="Delete User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom Pagination */}
            {renderPagination("bottom")}
          </div>
        )}
      </div>
    </div>
  );
}
