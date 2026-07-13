"use client";

import { useState, useEffect } from "react";

interface Attachment {
  filename: string;
  size: number;
  url: string;
}

interface Email {
  id: string;
  fileName: string;
  type: "live" | "local";
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: string;
  senderIp: string;
  attachments?: Attachment[];
}

interface MailExplorerProps {
  apiUrl: string;
}

export default function MailExplorer({ apiUrl }: MailExplorerProps) {
  const [mails, setMails] = useState<Email[]>([]);
  const [searchVal, setSearchVal] = useState("");
  const [selectedMail, setSelectedMail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  const fetchMails = async () => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/mails`);
      if (res.ok) {
        const data = await res.json();
        setMails(data);
        // Refresh selected email if it exists
        if (selectedMail) {
          const updated = data.find((m: Email) => m.id === selectedMail.id);
          if (updated) {
            setSelectedMail(updated);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching mails database:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMails();
    const interval = setInterval(fetchMails, 4000);
    return () => clearInterval(interval);
  }, [apiUrl, selectedMail?.id]);

  const handleDelete = async (filename: string, type: "live" | "local") => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/emails/delete/${type}/${filename}`, {
        method: "POST",
      });
      if (res.ok) {
        setSelectedMail(null);
        fetchMails();
      }
    } catch (err) {
      console.error("Error deleting mail:", err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredMails = mails.filter(
    (m) =>
      m.to.toLowerCase().includes(searchVal.toLowerCase()) ||
      m.from.toLowerCase().includes(searchVal.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchVal.toLowerCase())
  );

  return (
    <section className="tab-pane active w-full" id="explorer-tab">
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 w-full min-h-[550px]">
        {/* Explorer Mail List */}
        <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl flex flex-col backdrop-blur-md overflow-hidden">
          <div className="p-5 border-b border-white/[0.06] flex flex-col gap-3">
            <h3 className="font-bold text-base text-white">All Received Emails</h3>
            <input
              type="text"
              placeholder="Search by recipient or sender..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="bg-[#111625] border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <div className="flex-grow overflow-y-auto max-h-[480px]">
            {loading && mails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-gray-500 gap-2">
                <span className="text-xs">Loading mailbox database...</span>
              </div>
            ) : filteredMails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-gray-500 gap-2">
                <p className="text-xs">No matching emails found.</p>
              </div>
            ) : (
              filteredMails.map((email) => {
                const dateStr = new Date(email.date).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isSelected =
                  selectedMail && email.id === selectedMail.id
                    ? "bg-emerald-500/5 border-l-2 border-emerald-400"
                    : "border-l-2 border-transparent";

                return (
                  <div
                    key={email.id}
                    onClick={() => {
                      setSelectedMail(email);
                      setViewMode("html");
                    }}
                    className={`p-4 border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.01] flex flex-col gap-1.5 ${isSelected}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px] font-mono">
                        {email.to}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {email.type === "live" ? (
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/25 uppercase font-bold">
                            live
                          </span>
                        ) : (
                          <span className="text-[8px] bg-sky-500/10 text-sky-400 px-1 py-0.5 rounded border border-sky-500/25 uppercase font-bold">
                            local
                          </span>
                        )}
                        <span className="text-[9px] text-gray-500 font-mono">{dateStr}</span>
                      </div>
                    </div>
                    <div className="text-xs text-white font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                      {email.subject}
                    </div>
                    <div className="text-[10px] text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                      From: {email.from}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Explorer Reader Pane */}
        <div
          className="bg-slate-900/40 border border-white/[0.05] rounded-2xl flex flex-col backdrop-blur-md overflow-hidden min-h-[550px]"
          id="explorerReaderContainer"
        >
          {selectedMail ? (
            <div className="flex-grow flex flex-col h-full">
              <div className="p-6 border-b border-white/[0.06] flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                  <h2 className="text-lg font-bold text-white">{selectedMail.subject}</h2>
                  <button
                    onClick={() => handleDelete(selectedMail.fileName, selectedMail.type)}
                    className="bg-red-500/10 border border-red-500/25 hover:bg-red-500/25 text-red-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Delete Email
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-xs text-gray-300">
                  <div>
                    <strong>To:</strong> {selectedMail.to}
                  </div>
                  <div>
                    <strong>From:</strong> {selectedMail.from}
                  </div>
                  <div className="flex gap-4 text-gray-500 text-[10px] mt-1.5 font-mono">
                    <span>Time: {new Date(selectedMail.date).toLocaleString()}</span>
                    <span>IP: {selectedMail.senderIp}</span>
                  </div>
                </div>
              </div>

              <div className="flex-grow flex flex-col p-5 gap-3">
                <div className="flex gap-2 border-b border-white/[0.05] pb-2">
                  <button
                    onClick={() => setViewMode("html")}
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                      viewMode === "html" ? "bg-white/[0.05] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    HTML Preview
                  </button>
                  <button
                    onClick={() => setViewMode("text")}
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                      viewMode === "text" ? "bg-white/[0.05] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Plain Text
                  </button>
                </div>

                <div className="flex-grow bg-black/30 rounded-xl border border-white/[0.05] overflow-hidden min-h-[250px] flex">
                  {viewMode === "html" && selectedMail.html ? (
                    <iframe
                      srcDoc={`<style>body{background-color:transparent;color:#e5e7eb;} a{color:#60a5fa;}</style>` + selectedMail.html}
                      className="w-full h-full border-none bg-transparent"
                      sandbox="allow-same-origin"
                      title="Email content"
                    />
                  ) : (
                    <pre className="p-5 whitespace-pre-wrap break-all font-mono text-xs text-gray-200 overflow-y-auto w-full">
                      {selectedMail.text}
                    </pre>
                  )}
                </div>
              </div>

              {selectedMail.attachments && selectedMail.attachments.length > 0 && (
                <div className="p-5 bg-white/[0.01] border-t border-white/[0.06] flex flex-col gap-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Attachments ({selectedMail.attachments.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMail.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-900 border border-white/[0.06] rounded-lg p-2.5 flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                      >
                        <span className="font-semibold text-gray-200">{att.filename}</span>
                        <span className="text-[9px] text-gray-500">({formatBytes(att.size)})</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-grow text-gray-500 gap-3 p-16 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1"
                stroke="currentColor"
                className="w-16 h-16 text-gray-700 animate-pulse"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
              <h3 className="font-semibold text-lg text-gray-400">No Email Selected</h3>
              <p className="text-sm max-w-xs leading-relaxed">
                Select any email from the database in the left panel to inspect its headers, raw JSON structure, and HTML/text payload.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
