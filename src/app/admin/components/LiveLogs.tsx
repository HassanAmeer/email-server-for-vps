"use client";

import { useState, useEffect } from "react";

interface LiveLogsProps {
  apiUrl: string;
  systemMode: "Live" | "Local";
}

export default function LiveLogs({ apiUrl, systemMode }: LiveLogsProps) {
  const [logs, setLogs] = useState<string>("[System] Monitoring live public SMTP network traffic...");
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchLogs = async () => {
    if (!apiUrl) return;
    try {
      const modeRoute = systemMode === "Live" ? "live" : "local";
      const res = await fetch(`${apiUrl}/api/logs/${modeRoute}/receiving`);
      if (res.ok) {
        const logsData = await res.json();
        setLogs(logsData.join("\n") || `[System] No logs recorded for ${systemMode} mode yet.`);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [apiUrl, systemMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <section className="tab-pane w-full" id="logs-tab">
      <div className="bg-[#080C14] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl flex-grow min-h-[500px]">
        <div className="bg-[#101522] px-5 py-3 flex justify-between items-center text-xs font-mono text-gray-400 border-b border-white/[0.06]">
          <span>{systemMode === "Live" ? "live_smtp_receiving_traffic.log" : "local_smtp_receiving_traffic.log"}</span>
          <button
            onClick={handleCopy}
            className="bg-transparent border border-white/[0.08] text-gray-400 px-3 py-1 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            {copySuccess ? "Copied!" : "Copy Logs"}
          </button>
        </div>
        <pre className="p-5 overflow-auto font-mono text-xs text-emerald-400 bg-[#04060B] leading-relaxed flex-grow max-h-[550px]">
          <code>{logs}</code>
        </pre>
      </div>
    </section>
  );
}
