"use client";

import { useState, useEffect } from "react";

interface SMTPUser {
  username: string;
  password?: string;
}

interface CredentialsManagerProps {
  apiUrl: string;
}

export default function CredentialsManager({ apiUrl }: CredentialsManagerProps) {
  const [credentials, setCredentials] = useState<SMTPUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCredentials = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/credentials`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      }
    } catch (err) {
      console.error("Error fetching credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, [apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl || !username || !password) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        setAlert({ type: "success", msg: "Credential generated successfully." });
        setUsername("");
        setPassword("");
        fetchCredentials();
      } else {
        throw new Error("Failed");
      }
    } catch (err) {
      setAlert({ type: "error", msg: "Creation failed." });
    }

    setTimeout(() => setAlert(null), 3000);
  };

  const handleDelete = async (userToDelete: string) => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/credentials/${encodeURIComponent(userToDelete)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCredentials();
      }
    } catch (err) {
      console.error("Error deleting credential:", err);
    }
  };

  return (
    <section className="tab-pane active w-full" id="credentials-tab">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Credentials list table */}
        <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl backdrop-blur-md overflow-hidden p-6 flex flex-col gap-4">
          <h3 className="font-bold text-lg text-white">SMTP Authenticated Users</h3>
          <p className="text-xs text-gray-400">These client applications and servers are permitted to relay outbound mail through Port 2525 using this SMTP server.</p>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs font-semibold text-gray-400 uppercase">
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm font-mono text-gray-300">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500 font-sans">Loading credentials...</td>
                  </tr>
                ) : credentials.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500 font-sans">No relay credentials configured. Add a client user to start.</td>
                  </tr>
                ) : (
                  credentials.map((user) => (
                    <tr key={user.username} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                      <td className="py-3 px-4 font-semibold text-white">{user.username}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{user.password || "••••••••"}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(user.username)}
                          className="bg-red-500/10 border border-red-500/25 hover:bg-red-500/25 text-red-400 p-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Credential Form */}
        <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl backdrop-blur-md p-6 flex flex-col gap-4">
          <h3 className="font-bold text-lg text-white">Add SMTP Credential</h3>
          <p className="text-xs text-gray-400">Generate a new login client credential. If username exists, its password will be overwritten.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="credUser" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</label>
              <input
                type="text"
                id="credUser"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. laravel_app"
                className="bg-[#111625] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="credPass" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Password</label>
              <input
                type="text"
                id="credPass"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Generate or type password"
                className="bg-[#111625] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              Create Credential
            </button>

            {alert && (
              <div
                className={`text-xs font-semibold text-center rounded-lg py-2 border ${alert.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}
              >
                {alert.msg}
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
