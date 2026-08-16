"use client";

import { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

interface LoginOverlayProps {
  apiUrl: string;
  onLoginSuccess: () => void;
}

export default function LoginOverlay({ apiUrl, onLoginSuccess }: LoginOverlayProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [isPwdFocused, setIsPwdFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPassword("");
    const t = setTimeout(() => setPassword(""), 150);
    return () => clearTimeout(t);
  }, []);

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
        if (data.staticLogin) {
          localStorage.setItem("admin_static_super", "1");
        } else {
          localStorage.removeItem("admin_static_super");
        }
        onLoginSuccess();
      } else {
        setErrorMsg(data.error || "Invalid username or password");
      }
    } catch (err) {
      setErrorMsg("Unable to connect to server. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full min-h-screen md:h-screen md:max-h-[100dvh] bg-[#05070E] z-50 flex items-stretch overflow-y-auto md:overflow-hidden select-none font-sans">
      {/* Container split screen */}
      <div className="w-full min-h-full md:h-full md:max-h-full flex flex-col md:flex-row">
        
        {/* ================= LEFT SECTION (Sign In Form Panel) ================= */}
        <div className="w-full md:w-1/2 min-h-screen md:min-h-0 md:h-full md:max-h-full relative bg-[#070A13] p-5 sm:p-8 lg:p-12 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/[0.06] shrink-0 md:shrink">
          
          {/* Subtle Grid Background Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
              backgroundSize: '32px 32px'
            }}
          ></div>

          {/* Radial Center Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Floating Glassmorphic Login Card */}
          <div className="w-full max-w-[420px] relative z-10 bg-[#0B0F19]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-7 lg:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.65)] flex flex-col gap-4 sm:gap-5 my-auto">
            
            {/* Header */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-emerald-400 font-mono">
                ADMIN CONSOLE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Sign in
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Enter superuser credentials to unlock the dashboard
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs font-semibold animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-3.5 sm:gap-4">
              
              {/* Dummy hidden inputs to intercept browser aggressive autofill */}
              <input type="text" name="fake_usernameremembered" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
              <input type="password" name="fake_passwordremembered" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

              {/* Username Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 tracking-wide font-mono">
                  Username or Email
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    name="admin_username_field"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="off"
                    className="w-full bg-[#121826] border border-white/[0.08] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition-all placeholder:text-gray-500 font-mono"
                  />
                  <div className="absolute right-3.5 text-gray-500 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-300 tracking-wide font-mono">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    name="admin_vps_security_key"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsPwdFocused(true)}
                    readOnly={!isPwdFocused}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    className="w-full bg-[#121826] border border-white/[0.08] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition-all placeholder:text-gray-500 pr-11 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-white p-1 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-black font-extrabold py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-[0_4px_25px_rgba(52,211,153,0.35)] hover:shadow-[0_4px_30px_rgba(52,211,153,0.5)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Authenticate Console</span>
                )}
              </button>
            </form>

            {/* Bottom Card Footer */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-500 font-mono">
              <a href="/imap-mailbox" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <span>← IMAP Webmail</span>
              </a>
              <a href="/mailbox" className="hover:text-emerald-400 transition-colors">
                User Mailbox →
              </a>
            </div>

          </div>
        </div>


        {/* ================= RIGHT SECTION (Hero Branding & Feature Showcase) ================= */}
        <div className="w-full md:w-1/2 min-h-[440px] md:min-h-0 md:h-full md:max-h-full relative bg-gradient-to-br from-[#0c130b] via-[#090F14] to-[#05070E] p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between overflow-hidden shrink-0 md:shrink">
          
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Glowing particle dots & diagonal streak accents */}
          <span className="absolute top-12 right-24 text-emerald-300/40 text-sm font-serif animate-pulse pointer-events-none">✦</span>
          <span className="absolute top-1/2 right-16 text-teal-300/30 text-base font-serif animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}>✦</span>
          <div className="absolute -bottom-8 left-10 w-56 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent -rotate-45 pointer-events-none"></div>

          {/* Top Logo & Brand */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5 text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                  <span>Admin Panel</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">VPS</span>
                </span>
                <span className="text-[9px] font-semibold text-gray-400 tracking-wider font-mono mt-1">ENTERPRISE CONTROL PANEL</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest">CONTROL PANEL</span>
            </div>
          </div>

          {/* Middle Hero Typography & Features */}
          <div className="relative z-10 my-auto py-4 max-w-lg">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.08] mb-2.5">
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent block">
                Admin Panel.
              </span>
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-300 tracking-tight block mt-1.5">
                Complete control.
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-5 max-w-md">
              Command and orchestrate your private mail infrastructure, multi-domain routing, REST API gateways, and real-time email logs.
            </p>

            {/* Feature List */}
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-3 group">
                <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-gray-300">
                  Receiving Emails (Simple & Attachments)
                </span>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-gray-300">
                  Unlimited Custom Domains with Automated Catch-All
                </span>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-gray-300">
                  Developer REST APIs, API Keys & Full Control
                </span>
              </div>

              <div className="flex items-center gap-3 group">
                <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-gray-300">
                  Login via IMAP with Google & 3rd-Party Webmail / Apps
                </span>
              </div>
            </div>
          </div>

          {/* Bottom VPS Node Tag */}
          <div className="relative z-10 pt-2 flex items-center justify-between gap-3 text-xs text-gray-400 font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <span className="truncate text-gray-300">Live Mail Engine · Can Act as Backend · APIs Available</span>
            </div>
            <span className="shrink-0 text-emerald-400/80 font-bold">{APP_VERSION}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
