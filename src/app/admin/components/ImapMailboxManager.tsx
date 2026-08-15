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

interface ImapMailboxManagerProps {
  apiUrl: string;
}

export default function ImapMailboxManager({ apiUrl }: ImapMailboxManagerProps) {
  const [users, setUsers] = useState<mailboxUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImapUser, setSelectedImapUser] = useState<mailboxUser | null>(null);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSnippetTab, setActiveSnippetTab] = useState<"outlook" | "thunderbird" | "python" | "node">("outlook");

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
        throw new Error("Failed to load IMAP accounts");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load IMAP accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [apiUrl]);

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

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.project_name && u.project_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center text-blue-500">
        <span className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-10 flex-grow overflow-y-auto max-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">IMAP Mailbox Management</h1>
              <p className="text-xs text-gray-400">Client-facing standard IMAP (Ports 993 & 143) powered by Dovecot & PostgreSQL.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl self-start">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-blue-300 font-mono">Dovecot IMAP Service Ready</span>
        </div>
      </div>

      {/* Metrics & Ports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAPS Port (SSL/TLS)</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">Secure</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">993</span>
            <span className="text-xs text-gray-500 font-mono">TCP / SSL</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-2">Recommended for Outlook & Mobile</span>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">IMAP Port (Plain / TLS)</span>
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">Standard</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-400">143</span>
            <span className="text-xs text-gray-500 font-mono">TCP / STARTTLS</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-2">Standard & local dev testing</span>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Database Auth</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-bold border border-purple-500/20">Active</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-black font-mono text-white">PostgreSQL</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-2">Table: <code className="text-purple-300 font-mono">mailbox_users</code></span>
        </div>

        <div className="bg-[#0D121F] border border-white/[0.06] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total IMAP Accounts</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">Synced</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">{users.length}</span>
            <span className="text-xs text-gray-500">Accounts</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-2">Zero-Duplication Maildir Engine</span>
        </div>
      </div>

      {/* Main IMAP Accounts Table */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/[0.06] bg-[#111726] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">IMAP Client Accounts</h2>
            <p className="text-xs text-gray-400">Click &quot;View IMAP Details&quot; to copy setup credentials for your client.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts or projects..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-400 text-sm font-semibold">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="text-white font-bold mb-1">No IMAP Accounts Found</h3>
            <p className="text-sm text-gray-400 max-w-sm">Create user mailbox accounts in the Users Mailbox tab to manage them here via IMAP.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex flex-col">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#111726]/50 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Account / Email</th>
                  <th className="px-6 py-4">Context / Project</th>
                  <th className="px-6 py-4">IMAP Host</th>
                  <th className="px-6 py-4">SSL Port</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredUsers.map(u => (
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
                        <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Global Account</span>
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
                        <span>View IMAP Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration Code & App Setup Snippets */}
      <div className="bg-[#0D121F] border border-white/[0.05] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Client Setup Guide & Code Snippets</h2>
        
        <div className="flex gap-2 border-b border-white/10 pb-3">
          {(["outlook", "thunderbird", "python", "node"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSnippetTab(tab)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors capitalize ${
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
              <p className="text-blue-400 font-bold mb-2"># Node.js / Bun IMAP Client Example (imap-simple / node-imap)</p>
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
                    className="text-xs text-blue-400 hover:text-blue-300 font-sans font-semibold transition-colors cursor-pointer"
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
