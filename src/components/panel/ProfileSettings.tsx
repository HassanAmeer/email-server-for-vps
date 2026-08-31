"use client";

import { useState, useEffect, FormEvent } from "react";

interface ProfileSettingsProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
  isViolet?: boolean;
}

export default function ProfileSettings({
  apiUrl,
  apiPrefix = "/api/admin",
  tokenKey = "admin_token",
  isViolet = false,
}: ProfileSettingsProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [defaultAlertEmail, setDefaultAlertEmail] = useState("hasanameer386@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchProfile = async () => {
    if (!apiUrl) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const token =
        localStorage.getItem(tokenKey) ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("devpanel_token") ||
        localStorage.getItem("dev_admin_token") ||
        "";

      const res = await fetch(`${apiUrl}${apiPrefix}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Failed to load profile (Status: ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setUsername(data.username || "admin");
        setEmail(data.email || "admin@gmail.com");
        setAlertEmail(data.alert_email || data.default_alert_email || "hasanameer386@gmail.com");
        setDefaultAlertEmail(data.default_alert_email || "hasanameer386@gmail.com");
      } else {
        throw new Error(data.error || "Could not retrieve profile data");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load admin profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [apiUrl, apiPrefix, tokenKey]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!username.trim()) {
      setErrorMsg("Username cannot be empty");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("Email address cannot be empty");
      return;
    }
    if (password && password !== confirmPassword) {
      setErrorMsg("New password and confirm password do not match");
      return;
    }

    setSaving(true);
    try {
      const token =
        localStorage.getItem(tokenKey) ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("devpanel_token") ||
        localStorage.getItem("dev_admin_token") ||
        "";

      const payload: Record<string, string> = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        alert_email: alertEmail.trim().toLowerCase(),
      };

      if (password.trim().length > 0) {
        payload.password = password.trim();
      }

      const res = await fetch(`${apiUrl}${apiPrefix}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Admin credentials & alert notification settings updated successfully!");
        setPassword("");
        setConfirmPassword("");
        if (data.username) setUsername(data.username);
        if (data.email) setEmail(data.email);
        if (data.alert_email) setAlertEmail(data.alert_email);
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        throw new Error(data.error || "Failed to update profile");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error updating admin profile");
    } finally {
      setSaving(false);
    }
  };

  const accentBadge = isViolet
    ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  const accentButton = isViolet
    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_4px_20px_rgba(139,92,246,0.25)]"
    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)]";
  const accentRing = isViolet
    ? "focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
    : "focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50";

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${accentBadge}`}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Admin Profile & Security
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 ml-0.5">
            Manage your admin credentials, login password, and Gmail SMTP login alert notifications.
          </p>
        </div>

        <button
          onClick={fetchProfile}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-gray-300 transition-all cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-lg shadow-emerald-500/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 shrink-0 text-emerald-400"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-3 animate-fade-in shadow-lg shadow-red-500/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4 shrink-0 text-red-400"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card & Summary */}
        <div className="space-y-6">
          <div className="bg-[#0A0A1A]/80 border border-white/[0.06] rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-xl font-bold text-emerald-400 shadow-inner">
                {username ? username.charAt(0).toUpperCase() : "A"}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide font-mono">
                  {username || "admin"}
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block mt-1">
                  SUPER ADMIN
                </span>
              </div>
            </div>

            <div className="space-y-3.5 pt-4 border-t border-white/[0.04] text-xs">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[11px] text-gray-500">Username:</span>
                <span className="font-mono text-gray-200 font-semibold">{username || "admin"}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[11px] text-gray-500">Login Email:</span>
                <span className="font-mono text-gray-200 font-semibold truncate max-w-[150px]" title={email}>
                  {email || "admin@gmail.com"}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[11px] text-gray-500">Alert Notification:</span>
                <span className="font-mono text-emerald-400 font-semibold truncate max-w-[150px]" title={alertEmail}>
                  {alertEmail || "hasanameer386@gmail.com"}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[11px] text-gray-500">Gmail Alert:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-[11px] text-gray-500">Session:</span>
                <span className="font-mono text-gray-200">24-Hour Token</span>
              </div>
            </div>
          </div>

          {/* Quick Security Tips */}
          <div className="bg-[#0A0A1A]/60 border border-white/[0.04] rounded-3xl p-5 text-xs text-gray-400 space-y-2.5">
            <div className="flex items-center gap-2 text-gray-200 font-semibold text-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-4 h-4 text-emerald-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              <span>Login Alert Security</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Every time anyone logs into the admin dashboard, a secure email notification containing the login timestamp, client IP, and browser details is automatically dispatched to the Alert Email specified above via Gmail SMTP.
            </p>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="bg-[#0A0A1A]/80 border border-white/[0.06] rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Edit Admin Credentials & Alerts</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Update your username, primary login email, alert notification recipient, and password.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4 py-8">
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse"></div>
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse"></div>
                <div className="h-10 bg-white/[0.03] rounded-xl animate-pulse"></div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Grid: Username & Primary Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Admin Username <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className={`w-full bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-gray-500 outline-none transition-all ${accentRing}`}
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Primary identifier used to login</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Admin Login Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@gmail.com"
                      className={`w-full bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-gray-500 outline-none transition-all ${accentRing}`}
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Also accepted as login identifier</p>
                  </div>
                </div>

                {/* Password Section */}
                <div className="pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-200">Update Password</span>
                    <span className="text-[10px] text-gray-500">(Leave blank to keep unchanged)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none transition-all pr-10 ${accentRing}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer p-1"
                        >
                          {showPassword ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full bg-slate-900/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none transition-all ${accentRing}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Alert Notification Recipient Email (To) - Positioned at Bottom */}
                <div className="pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-emerald-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                      <span>Login Alert Notification Email (To)</span>
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Default: {defaultAlertEmail}
                    </span>
                  </div>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder={defaultAlertEmail || "hasanameer386@gmail.com"}
                    className={`w-full bg-slate-900/60 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-300 placeholder-gray-500 outline-none transition-all ${accentRing}`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Gmail SMTP sends security alerts to this address upon every admin login. If left blank, it automatically defaults to the value set in <code className="text-emerald-400 font-mono">.env</code> (<code className="text-emerald-400 font-mono">ADMIN_ALERT_EMAIL</code>).
                  </p>
                </div>

                {/* Submit Action Button */}
                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 ${accentButton}`}
                  >
                    {saving ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Saving Credentials...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        <span>Save Credentials & Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
