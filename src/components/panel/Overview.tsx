"use client";

import { useEffect, useState } from "react";

export interface OverviewStats {
  totalEmails?: number;
  totalReceivedEmails?: number;
  localEmailsCount?: number;
  liveEmailsCount?: number;
  domainsCount?: number;
  attachedDomainsCount?: number;
  primaryDomain?: string;
  primaryDomainsCount?: number;
  activeDomainsCount?: number;
  pausedDomainsCount?: number;
  diskUsageBytes?: number;
  totalSentEmails?: number;
  sentEmailsCount?: number;
  activeMailboxesCount?: number;
  liveModeActive?: boolean;
}

interface OverviewProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
  isViolet?: boolean;
  stats: OverviewStats;
}

interface ApiRouteSetting {
  id: string;
  path: string;
  hits: number;
  enabled: boolean;
}

interface DailyTrafficStat {
  day: string;
  received?: number;
  generated?: number;
  total?: number;
}

export default function Overview({
  apiUrl,
  stats,
  apiPrefix = "/api/admin",
  tokenKey = "admin_token",
  isViolet: propIsViolet,
}: OverviewProps) {
  const [apiRoutes, setApiRoutes] = useState<ApiRouteSetting[]>([]);
  const [trafficStats, setTrafficStats] = useState<DailyTrafficStat[]>([]);
  const [timeframe, setTimeframe] = useState<"7d" | "14d" | "30d">("7d");
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    count: number;
    date: string;
    weekday: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [trafficLoading, setTrafficLoading] = useState(false);

  // Auto-detect violet theme if in DevPanel or if explicitly passed
  const isViolet =
    propIsViolet !== undefined
      ? propIsViolet
      : apiPrefix.includes("dev") || tokenKey.includes("dev");

  useEffect(() => {
    let isMounted = true;

    const fetchApiStats = async () => {
      if (!apiUrl) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem(tokenKey) ||
              (isViolet ? localStorage.getItem("dev_admin_token") : "") ||
              ""
            : "";
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        setTrafficLoading(true);
        const [res, trafficRes] = await Promise.allSettled([
          fetch(`${apiUrl}${apiPrefix}/api-settings`, { headers }),
          fetch(`${apiUrl}${apiPrefix}/stats/traffic?range=${timeframe}`, { headers }),
        ]);

        if (!isMounted) return;

        if (res.status === "fulfilled" && res.value.ok) {
          const data = await res.value.json();
          if (Array.isArray(data)) {
            setApiRoutes(data);
          }
        }
        if (trafficRes.status === "fulfilled" && trafficRes.value.ok) {
          const tData = await trafficRes.value.json();
          if (Array.isArray(tData)) {
            setTrafficStats(tData);
          }
        }
      } catch (err) {
        console.warn("Backend server not reachable at", apiUrl, err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setTrafficLoading(false);
        }
      }
    };

    fetchApiStats();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, apiPrefix, tokenKey, isViolet, timeframe]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Safe calculated metric values
  const totalReceived =
    stats.totalReceivedEmails ?? stats.totalEmails ?? 0;
  const totalDomains =
    stats.domainsCount ?? stats.attachedDomainsCount ?? 0;
  const primaryDomainName =
    stats.primaryDomain && stats.primaryDomain !== "None configured"
      ? stats.primaryDomain
      : "None";
  const primaryCount =
    stats.primaryDomainsCount !== undefined
      ? stats.primaryDomainsCount
      : primaryDomainName !== "None"
      ? 1
      : 0;
  const activeDomainsCount =
    stats.activeDomainsCount !== undefined
      ? stats.activeDomainsCount
      : totalDomains;
  const pausedDomainsCount =
    stats.pausedDomainsCount !== undefined
      ? stats.pausedDomainsCount
      : 0;
  const diskStorageFormatted = formatBytes(stats.diskUsageBytes);
  const totalSent =
    stats.totalSentEmails ?? stats.sentEmailsCount ?? 0;

  // Dynamically calculate SVG Chart Coordinates from trafficStats (Received emails per day)
  const safeTrafficStats = Array.isArray(trafficStats) ? trafficStats : [];
  const maxReceivedTraffic = Math.max(
    1,
    ...safeTrafficStats.map(
      (s) => Number(s?.received ?? s?.total ?? 0)
    )
  );

  const totalRangeEmails = safeTrafficStats.reduce(
    (acc, curr) => acc + Number(curr?.received ?? curr?.total ?? 0),
    0
  );

  // Define chart boundaries
  const chartWidth = 440;
  const startX = 40;
  const xStep =
    safeTrafficStats.length > 1
      ? chartWidth / (safeTrafficStats.length - 1)
      : chartWidth;
  const chartHeight = 95;
  const startY = 135; // Bottom baseline of the chart

  const points =
    safeTrafficStats.length === 0
      ? []
      : safeTrafficStats.map((stat, i) => {
          const receivedCount = Number(stat?.received ?? stat?.total ?? 0);
          const heightPercent = maxReceivedTraffic > 0 ? receivedCount / maxReceivedTraffic : 0;
          const y = startY - chartHeight * heightPercent;
          const dateObj = new Date(stat?.day || Date.now());
          const shortDate = isNaN(dateObj.getTime())
            ? "N/A"
            : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const weekday = isNaN(dateObj.getTime())
            ? ""
            : dateObj.toLocaleDateString("en-US", { weekday: "short" });

          return {
            x: startX + i * xStep,
            y: y,
            shortDate,
            weekday,
            count: receivedCount,
            fullDate: stat?.day || "",
          };
        });

  // SVG Path String
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  // Area Path String (closing the shape to the bottom for the gradient fill)
  const areaD =
    pathD && points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} 155 L ${points[0].x} 155 Z`
      : "";

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">
      {/* Dynamic 4 Dashboard Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: Total Received Emails */}
        <div
          className={`group relative glass-panel hover-3d border ${
            isViolet
              ? "border-violet-500/[0.08] hover:border-violet-500/30"
              : "border-white/[0.04] hover:border-emerald-500/30"
          } p-6 rounded-3xl overflow-hidden transition-all duration-300`}
        >
          <div
            className={`absolute top-0 right-0 w-28 h-28 ${
              isViolet
                ? "bg-violet-500/10 group-hover:bg-violet-500/20"
                : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
            } rounded-full blur-2xl transition-colors duration-500`}
          ></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isViolet ? "bg-violet-400" : "bg-emerald-400"
                  } animate-pulse`}
                ></span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">
                  Total Received Emails
                </span>
              </div>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight mt-1">
                {totalReceived.toLocaleString()}
              </strong>
              <span className="text-[10px] text-gray-400 font-mono mt-1 flex items-center gap-1">
                <span className={isViolet ? "text-violet-400" : "text-emerald-400"}>
                  {stats.localEmailsCount ?? 0}
                </span>{" "}
                Local ·{" "}
                <span className={isViolet ? "text-violet-400" : "text-emerald-400"}>
                  {stats.liveEmailsCount ?? 0}
                </span>{" "}
                Live Inbound
              </span>
            </div>
            <div
              className={`w-12 h-12 ${
                isViolet
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              } border rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
            >
              {/* Inbound / Download Inbox Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3.75H6.75A2.25 2.25 0 004.5 6v12a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0019.5 18V6a2.25 2.25 0 00-2.25-2.25H15M9 3.75v3h6v-3M9 3.75h6m-3 8.25v6m0 0l-3-3m3 3l3-3"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Domains (Total Attached & Primary Count without badge) */}
        <div
          className={`group relative glass-panel hover-3d border ${
            isViolet
              ? "border-violet-500/[0.08] hover:border-violet-500/30"
              : "border-white/[0.04] hover:border-emerald-500/30"
          } p-6 rounded-3xl overflow-hidden transition-all duration-300`}
        >
          <div
            className={`absolute top-0 right-0 w-28 h-28 ${
              isViolet
                ? "bg-violet-500/10 group-hover:bg-violet-500/20"
                : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
            } rounded-full blur-2xl transition-colors duration-500`}
          ></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isViolet ? "bg-violet-400" : "bg-emerald-400"
                  } animate-pulse`}
                ></span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">
                  Domains
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight">
                  {totalDomains}
                </strong>
                <span className="text-[11px] text-gray-400 font-mono">
                  {totalDomains === 1 ? "Attached" : "Attached"}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                <span>
                  Primary:{" "}
                  <span className={isViolet ? "text-violet-400 font-bold" : "text-emerald-400 font-bold"}>
                    {primaryCount}
                  </span>
                </span>
                <span className="opacity-40">·</span>
                <span>
                  Active:{" "}
                  <span className={isViolet ? "text-violet-400 font-bold" : "text-emerald-400 font-bold"}>
                    {activeDomainsCount}
                  </span>
                </span>
                <span className="opacity-40">·</span>
                <span>
                  Paused:{" "}
                  <span className={isViolet ? "text-violet-400 font-bold" : "text-emerald-400 font-bold"}>
                    {pausedDomainsCount}
                  </span>
                </span>
              </span>
            </div>
            <div
              className={`w-12 h-12 ${
                isViolet
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              } border rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
            >
              {/* Globe / DNS Network Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Storage (Storage Used) */}
        <div
          className={`group relative glass-panel hover-3d border ${
            isViolet
              ? "border-violet-500/[0.08] hover:border-violet-500/30"
              : "border-white/[0.04] hover:border-emerald-500/30"
          } p-6 rounded-3xl overflow-hidden transition-all duration-300`}
        >
          <div
            className={`absolute top-0 right-0 w-28 h-28 ${
              isViolet
                ? "bg-violet-500/10 group-hover:bg-violet-500/20"
                : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
            } rounded-full blur-2xl transition-colors duration-500`}
          ></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isViolet ? "bg-violet-400" : "bg-emerald-400"
                  } animate-pulse`}
                ></span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">
                  Storage
                </span>
              </div>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight mt-1">
                {diskStorageFormatted}
              </strong>
              <span className="text-[10px] text-gray-400 font-mono mt-1">
                Mailbox, media & DB footprint
              </span>
            </div>
            <div
              className={`w-12 h-12 ${
                isViolet
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              } border rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
            >
              {/* Storage / Database Stack Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Send Email (Total Sent Emails) */}
        <div
          className={`group relative glass-panel hover-3d border ${
            isViolet
              ? "border-violet-500/[0.08] hover:border-violet-500/30"
              : "border-white/[0.04] hover:border-emerald-500/30"
          } p-6 rounded-3xl overflow-hidden transition-all duration-300`}
        >
          <div
            className={`absolute top-0 right-0 w-28 h-28 ${
              isViolet
                ? "bg-violet-500/10 group-hover:bg-violet-500/20"
                : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
            } rounded-full blur-2xl transition-colors duration-500`}
          ></div>
          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col gap-1.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isViolet ? "bg-violet-400" : "bg-emerald-400"
                  } animate-pulse`}
                ></span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">
                  Send Email
                </span>
              </div>
              <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tight mt-1">
                {totalSent.toLocaleString()}
              </strong>
              <span className="text-[10px] text-gray-400 font-mono mt-1">
                Outbound SMTP & API dispatches
              </span>
            </div>
            <div
              className={`w-12 h-12 ${
                isViolet
                  ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              } border rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
            >
              {/* Outbound Send / Paper Airplane Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* Analytics Graph Card & Status Checklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Inbound Received Emails Traffic Chart Card - spans 7/12 cols */}
        <div
          className={`lg:col-span-7 glass-panel hover-3d border ${
            isViolet ? "border-violet-500/[0.08]" : "border-white/[0.04]"
          } p-6 rounded-3xl flex flex-col gap-6 relative overflow-hidden`}
        >
          {/* Header Row: Title & Date Range Dropdown / Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className={`w-4 h-4 ${isViolet ? "text-violet-400" : "text-emerald-400"}`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                  Received Emails Activity
                </h3>
                <span
                  className={`text-[9px] ${
                    isViolet
                      ? "bg-violet-500/10 border-violet-500/25 text-violet-300"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                  } border px-2 py-0.5 rounded-md font-bold font-mono`}
                >
                  {totalRangeEmails} Inbound
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Daily inbound received emails trend across all domains.
              </p>
            </div>

            {/* Date Selection Filter (Dropdown / Segmented Controls) */}
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.06] p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTimeframe("7d")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 ${
                  timeframe === "7d"
                    ? isViolet
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/40 shadow-sm"
                      : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("14d")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 ${
                  timeframe === "14d"
                    ? isViolet
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/40 shadow-sm"
                      : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                14 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("30d")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all duration-200 ${
                  timeframe === "30d"
                    ? isViolet
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/40 shadow-sm"
                      : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                Monthly (30D)
              </button>
            </div>
          </div>

          {/* SVG Graph Drawing with Range & Hover Tooltip */}
          <div className="relative w-full h-[195px] bg-slate-950/40 rounded-2xl border border-white/[0.03] overflow-hidden flex items-end p-2">
            {trafficLoading && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20">
                <span className="text-[11px] text-gray-400 font-mono animate-pulse">
                  Updating timeframe data...
                </span>
              </div>
            )}

            <svg
              className="w-full h-full"
              viewBox="0 0 520 180"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                {/* Neon Area Fill Gradient */}
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isViolet ? "#a855f7" : "#10b981"}
                    stopOpacity="0.32"
                  />
                  <stop
                    offset="100%"
                    stopColor={isViolet ? "#a855f7" : "#10b981"}
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line
                x1="30"
                y1="35"
                x2="490"
                y2="35"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1="30"
                y1="70"
                x2="490"
                y2="70"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1="30"
                y1="105"
                x2="490"
                y2="105"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1="30"
                y1="135"
                x2="490"
                y2="135"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />

              {/* Area path */}
              <path d={areaD} fill="url(#chartGradient)" />

              {/* Line path */}
              <path
                d={pathD}
                fill="none"
                stroke={isViolet ? "#c084fc" : "#34d399"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Glow spots for coordinates */}
              {points.map((p, i) => {
                // Handle label decimation for 14d and 30d to avoid label clutter
                const showLabel =
                  timeframe === "7d"
                    ? true
                    : timeframe === "14d"
                    ? i % 2 === 0 || i === points.length - 1
                    : i % 5 === 0 || i === points.length - 1;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: p.x,
                        y: p.y,
                        count: p.count,
                        date: p.shortDate,
                        weekday: p.weekday,
                      })
                    }
                  >
                    {/* Invisible hover area */}
                    <circle cx={p.x} cy={p.y} r="12" fill="transparent" />

                    {/* Subtle vertical indicator line */}
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={p.x}
                      y2="135"
                      stroke={
                        p.count > 0
                          ? isViolet
                            ? "rgba(168,85,247,0.3)"
                            : "rgba(16,185,129,0.3)"
                          : "rgba(255,255,255,0.02)"
                      }
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />

                    {/* Pulsing coordinate circle */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.count > 0 ? "5.5" : "3"}
                      fill={isViolet ? "#a855f7" : "#10b981"}
                      className={p.count > 0 ? "animate-pulse" : "opacity-40"}
                    />
                    <circle cx={p.x} cy={p.y} r="2" fill="#ffffff" />

                    {/* Count Tag above circle if count > 0 */}
                    {p.count > 0 && (
                      <g>
                        <rect
                          x={p.x - 14}
                          y={p.y - 20}
                          width="28"
                          height="14"
                          rx="4"
                          fill={isViolet ? "#581c87" : "#064e3b"}
                          stroke={isViolet ? "#a855f7" : "#10b981"}
                          strokeWidth="0.8"
                        />
                        <text
                          x={p.x}
                          y={p.y - 10}
                          fill="#ffffff"
                          textAnchor="middle"
                          className="text-[9px] font-mono font-extrabold"
                          style={{ fontSize: "8px" }}
                        >
                          {p.count}
                        </text>
                      </g>
                    )}

                    {/* Date label at bottom */}
                    {showLabel && (
                      <g>
                        <text
                          x={p.x}
                          y="152"
                          fill={p.count > 0 ? "#cbd5e1" : "#64748b"}
                          textAnchor="middle"
                          className="text-[10px] font-mono font-semibold"
                          style={{ fontSize: "8px" }}
                        >
                          {p.shortDate}
                        </text>
                        {timeframe === "7d" && (
                          <text
                            x={p.x}
                            y="163"
                            fill="#475569"
                            textAnchor="middle"
                            className="text-[8px] font-mono"
                            style={{ fontSize: "7px" }}
                          >
                            {p.weekday}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Hover Tooltip Overlay in SVG */}
              {hoveredPoint && (
                <g>
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="8"
                    fill="none"
                    stroke={isViolet ? "#c084fc" : "#34d399"}
                    strokeWidth="2"
                    className="animate-ping"
                  />
                  <rect
                    x={Math.max(10, Math.min(430, hoveredPoint.x - 45))}
                    y={Math.max(10, hoveredPoint.y - 45)}
                    width="90"
                    height="32"
                    rx="6"
                    fill="#020617"
                    stroke={isViolet ? "#a855f7" : "#10b981"}
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                  />
                  <text
                    x={Math.max(55, Math.min(475, hoveredPoint.x))}
                    y={Math.max(10, hoveredPoint.y - 45) + 14}
                    fill="#94a3b8"
                    textAnchor="middle"
                    style={{ fontSize: "8px", fontWeight: "bold" }}
                  >
                    {hoveredPoint.date} ({hoveredPoint.weekday})
                  </text>
                  <text
                    x={Math.max(55, Math.min(475, hoveredPoint.x))}
                    y={Math.max(10, hoveredPoint.y - 45) + 26}
                    fill="#ffffff"
                    textAnchor="middle"
                    style={{ fontSize: "9px", fontWeight: "bold" }}
                  >
                    {hoveredPoint.count} received
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Daily Received Emails Breakdown by Date for Selected Timeframe */}
          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
              <span>
                Recent Inbound Activity ({timeframe === "7d" ? "7 Days" : timeframe === "14d" ? "14 Days" : "Monthly"})
              </span>
              <span className="text-[9px] text-gray-600 font-mono">Date · Received Count</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {loading ? (
                <div className="col-span-4 py-4 text-center text-xs text-gray-500 font-mono">
                  Loading received email trends...
                </div>
              ) : safeTrafficStats.length === 0 ? (
                <div className="col-span-4 py-4 text-center text-xs text-gray-500 font-mono">
                  No email history recorded yet.
                </div>
              ) : (
                safeTrafficStats
                  .slice(-4)
                  .reverse()
                  .map((stat, idx) => {
                    const dateObj = new Date(stat.day);
                    const formattedDate = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                        })
                      : stat.day;
                    const count = Number(stat.received ?? stat.total ?? 0);
                    return (
                      <div
                        key={stat.day || idx}
                        className={`bg-black/30 border ${
                          count > 0
                            ? isViolet
                              ? "border-violet-500/20 bg-violet-500/[0.02]"
                              : "border-emerald-500/20 bg-emerald-500/[0.02]"
                            : "border-white/[0.03]"
                        } p-3 rounded-2xl flex flex-col gap-1.5 hover:bg-white/[0.02] transition-colors`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-300 font-mono font-bold truncate">
                            {formattedDate}
                          </span>
                          <span
                            className={`text-[8px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded ${
                              count > 0
                                ? isViolet
                                  ? "text-violet-300 bg-violet-500/15 border border-violet-500/30"
                                  : "text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                                : "text-gray-500 bg-white/[0.02]"
                            }`}
                          >
                            {count > 0 ? "Active" : "0 Msgs"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong
                            className={`text-base font-mono font-extrabold ${
                              count > 0
                                ? isViolet
                                  ? "text-violet-300"
                                  : "text-emerald-300"
                                : "text-white"
                            }`}
                          >
                            {count}
                          </strong>
                          <span className="text-[9px] text-gray-500">
                            {count === 1 ? "email received" : "emails received"}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Server Checklist & Health checks - spans 5/12 cols */}
        <div
          className={`lg:col-span-5 glass-panel hover-3d border ${
            isViolet ? "border-violet-500/[0.08]" : "border-white/[0.04]"
          } p-6 rounded-3xl flex flex-col gap-6`}
        >
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase font-mono">
              Server Status & Health
            </h3>
            <p className="text-[11px] text-gray-400">
              Node configurations running inside the VPS.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Health check item: SMTP Listener */}
            <div
              className={`flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:${
                isViolet ? "border-violet-500/20" : "border-emerald-500/20"
              } transition-colors`}
            >
              <div
                className={`w-8 h-8 rounded-xl ${
                  isViolet
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.1)]"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                } border flex items-center justify-center shrink-0`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  className="w-4.5 h-4.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">
                  SMTP Listener Service
                </span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  SMTP mail pipeline running on Port{" "}
                  <code
                    className={`${
                      isViolet ? "text-violet-400" : "text-emerald-400"
                    } font-mono font-bold`}
                  >
                    {stats.liveModeActive ? "25" : "2525"}
                  </code>{" "}
                  is ready to accept client connections.
                </p>
              </div>
            </div>

            {/* Health check item: Web API Server */}
            <div
              className={`flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:${
                isViolet ? "border-violet-500/20" : "border-emerald-500/20"
              } transition-colors`}
            >
              <div
                className={`w-8 h-8 rounded-xl ${
                  isViolet
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.1)]"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                } border flex items-center justify-center shrink-0`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  className="w-4.5 h-4.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">
                  Web API Server
                </span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Web panel dashboard and dynamically routed controllers running
                  on Port{" "}
                  <code
                    className={`${
                      isViolet ? "text-violet-400" : "text-emerald-400"
                    } font-mono font-bold`}
                  >
                    {stats.liveModeActive ? "80" : "8081 (Local Dev)"}
                  </code>
                  .
                </p>
              </div>
            </div>

            {/* Health check item: File Integrity & Storage */}
            <div
              className={`flex items-start gap-4 p-4 bg-slate-950/40 border border-white/[0.02] rounded-2xl hover:${
                isViolet ? "border-violet-500/20" : "border-emerald-500/20"
              } transition-colors`}
            >
              <div
                className={`w-8 h-8 rounded-xl ${
                  isViolet
                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.1)]"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                } border flex items-center justify-center shrink-0`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  className="w-4.5 h-4.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white tracking-wide">
                  File Integrity & Memory
                </span>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Storage directories and SQLite WAL journal active. Memory allocation limits are nominal.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
