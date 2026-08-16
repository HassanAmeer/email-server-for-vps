"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-config";
import { APP_VERSION } from "@/lib/version";

interface ImapInfo {
  primaryDomain: string;
  catchAll: boolean;
  imap: {
    host: string;
    sslPort: number;
    plainPort: number;
    status: string;
  };
  defaultCredentials?: {
    email: string;
    password?: string;
  };
}

const features = [
  {
    title: "Catch-all inbound",
    desc: "Every address on your domain",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    )
  },
  {
    title: "IMAPS 993 (SSL)",
    desc: "Encrypted Dovecot access",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  },
  {
    title: "Instant OTP extraction",
    desc: "Codes surfaced the moment they land",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    )
  },
  {
    title: "Live mail stream",
    desc: "Real-time feed on your own VPS",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    )
  }
];

export default function ImapMailboxLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPwdFocused, setIsPwdFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<ImapInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setPassword("");
    const t = setTimeout(() => setPassword(""), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("imap_mailbox_token");
    if (token) {
      router.push("/imap-mailbox/inbox");
      return;
    }

    const apiBase = getApiBaseUrl();

    // Fetch primary domain & default IMAP credentials info
    fetch(`${apiBase}/api/imap-mailbox/info`)
      .then(async res => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })
      .then(data => {
        if (data && data.success) {
          setInfo(data);
        }
      })
      .catch(err => {
        console.warn("Could not load IMAP info:", err);
      })
      .finally(() => {
        setLoadingInfo(false);
      });
  }, [router]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/imap-mailbox/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 404
            ? "API endpoint not found. Please ensure backend server (port 8081) is running."
            : "Server returned non-JSON response. Please verify backend service."
        );
      }

      if (res.ok && data.token) {
        localStorage.setItem("imap_mailbox_token", data.token);
        localStorage.setItem("imap_mailbox_user", JSON.stringify(data.user || { email, is_primary: true }));
        router.push("/imap-mailbox/inbox");
      } else {
        setError(data.error || "Login failed. Check your credentials.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full min-h-screen md:h-screen md:max-h-[100dvh] bg-[#05070E] z-50 flex items-stretch overflow-y-auto md:overflow-hidden select-none font-sans">
      {/* Container split screen */}
      <div className="w-full min-h-full md:h-full md:max-h-full flex flex-col md:flex-row">
        
        {/* ============ LEFT — CONTENT PANEL ============ */}
        <div className="w-full md:w-1/2 min-h-[440px] md:min-h-0 md:h-full md:max-h-full relative bg-gradient-to-br from-[#0c130b] via-[#090F14] to-[#05070E] p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between overflow-hidden border-b md:border-b-0 md:border-r border-white/[0.06] shrink-0 md:shrink order-2 md:order-1">
          
          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Glowing particle accents */}
          <span className="absolute top-12 right-24 text-emerald-300/40 text-sm font-serif animate-pulse pointer-events-none">✦</span>
          <span className="absolute top-1/2 right-16 text-teal-300/30 text-base font-serif animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}>✦</span>
          <div className="absolute -bottom-8 left-10 w-56 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent -rotate-45 pointer-events-none"></div>

          {/* Top Brand Row */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                  <span>IMAP Mailbox</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">993 SSL</span>
                </span>
                <span className="text-[9px] font-semibold text-gray-400 tracking-wider font-mono mt-1">MASTER WEBMAIL INTERFACE</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-widest">LIVE</span>
            </div>
          </div>

          {/* Middle Hero Typography & Features */}
          <div className="relative z-10 my-auto py-4 max-w-lg">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.06] mb-2.5">
              Every address.<br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">One inbox.</span>
            </h1>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-5 max-w-md">
              The central master inbox for your custom domain. Inbound messages are captured, encrypted, and streamed live to this single mailbox.
            </p>

            {/* Feature List */}
            <div className="space-y-2.5 sm:space-y-3">
              {features.map((f) => (
                <div key={f.title} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      {f.icon}
                    </div>
                    <span className="text-xs sm:text-[13px] font-semibold text-gray-200">{f.title}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono hidden sm:inline">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Node Tag */}
          <div className="relative z-10 pt-2 flex items-center justify-between gap-3 text-xs text-gray-400 font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <span className="truncate text-gray-300">Live Mail Server · IMAPS Active · APIs Available</span>
            </div>
            <span className="shrink-0 text-emerald-400/80 font-bold">{APP_VERSION}</span>
          </div>
        </div>


        {/* ============ RIGHT — LOGIN FORM PANEL ============ */}
        <div className="w-full md:w-1/2 min-h-screen md:min-h-0 md:h-full md:max-h-full relative bg-[#070A13] p-5 sm:p-8 lg:p-12 flex items-center justify-center shrink-0 md:shrink order-1 md:order-2">
          
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
                Mailbox Access
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Sign in
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                Enter your mailbox credentials to open the master inbox
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs font-semibold animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} autoComplete="off" className="flex flex-col gap-3.5 sm:gap-4">
              
              {/* Dummy hidden inputs to intercept browser aggressive autofill */}
              <input type="text" name="fake_usernameremembered" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
              <input type="password" name="fake_passwordremembered" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 tracking-wide font-mono">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <input
                    type="email"
                    required
                    name="imap_email_address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourdomain.com"
                    autoComplete="off"
                    className="w-full bg-[#121826] border border-white/[0.08] focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition-all placeholder:text-gray-500 font-mono"
                  />
                  <div className="absolute right-3.5 text-gray-500 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
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
                    name="imap_account_key"
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
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign in to IMAP Mailbox</span>
                )}
              </button>
            </form>

            {/* Bottom Card Footer */}
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-gray-500 font-mono">
              <a href="/admin/primary-domain" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <span>← Admin Panel</span>
              </a>
              <a href="/mailbox" className="hover:text-emerald-400 transition-colors">
                User Mailbox →
              </a>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
