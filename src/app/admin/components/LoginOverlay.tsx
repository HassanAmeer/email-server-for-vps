"use client";

import { useState } from "react";

interface LoginOverlayProps {
  apiUrl: string;
  onLoginSuccess: () => void;
}

export default function LoginOverlay({ apiUrl, onLoginSuccess }: LoginOverlayProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${apiUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email: username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("admin_token", data.token);
        onLoginSuccess();
      } else {
        setErrorMsg(data.error || "Incorrect credentials");
      }
    } catch (err) {
      setErrorMsg("Server Connection Refused");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#070A13]/98 backdrop-blur-xl z-50 flex items-center justify-center transition-all duration-300">
      <div className="max-w-md w-full px-8 py-10 bg-slate-900/60 border border-emerald-500/10 rounded-3xl shadow-2xl flex flex-col gap-6 backdrop-blur-md relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Admin Authentication</h2>
          <p className="text-sm text-gray-400">Please enter your admin credentials to unlock the dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="bg-[#111625] border border-white/[0.06] rounded-xl px-4 py-3 text-center text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-gray-500"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="bg-[#111625] border border-white/[0.06] rounded-xl px-4 py-3 text-center text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors tracking-widest placeholder:tracking-normal placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Authenticate"}
          </button>
          {errorMsg && (
            <div className="text-xs text-red-400 font-semibold text-center mt-1">
              {errorMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
