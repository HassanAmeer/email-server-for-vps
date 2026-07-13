"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const API_BASE = "http://localhost:8081";

interface Email {
  id: string;
  fileName: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  date: string;
  senderIp: string;
  attachments?: {
    filename: string;
    size: number;
    url: string;
  }[];
}

export default function LocalConsolePage() {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMail, setSelectedMail] = useState<Email | null>(null);
  const [selectedMailIds, setSelectedMailIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("inbox-tab");
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  const [apiKey, setApiKey] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedGen, setCopiedGen] = useState(false);

  // Log States
  const [receivingLogs, setReceivingLogs] = useState<string>("Initializing receiving logs...");
  const [sendingLogs, setSendingLogs] = useState<string>("Initializing sending logs...");

  // Send Email Form State
  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendAlert, setSendAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);

  // Help Modal State
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<"flow" | "smtp">("flow");

  // Audio & Notification track
  const knownEmailIdsRef = useRef<Set<string> | null>(null);

  // Initialize API URL and settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
          ? API_BASE
          : `${window.location.protocol}//${window.location.host}`;
      setApiUrl(url);
    }
  }, []);

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/domains`)
      .then(res => res.json())
      .then(data => {
        if (data.domains && data.domains.length > 0) {
          setDomains(data.domains);
          setSelectedDomain(data.domains[0]);
        }
      })
      .catch(err => console.error("Error fetching domains:", err));
  }, [apiUrl]);

  const handleGenerate = async () => {
    if (!apiUrl || !selectedDomain) return;
    setIsGenerating(true);
    try {
      const headers: any = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(`${apiUrl}/api/mailbox/generate?domain=${selectedDomain}`, { headers });
      const data = await res.json();
      if (res.ok && data.email) {
        setGeneratedEmail(data.email);
        setEmails([]);
      } else {
        alert("Failed to generate: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error generating email");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyGen = () => {
    if (!generatedEmail) return;
    
    // Fallback for non-HTTPS environments
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(generatedEmail);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = generatedEmail;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error(error);
      } finally {
        textArea.remove();
      }
    }
    
    setCopiedGen(true);
    setTimeout(() => setCopiedGen(false), 2000);
  };

  const playBellSound = () => {
    const audio = new Audio("/bell.wav");
    audio.play().catch((err) => {
      console.warn("Audio playback failed (interaction required):", err);
    });
  };

  // Poll local emails and logs
  const fetchData = async () => {
    if (!apiUrl) return;
    try {
      // 1. Fetch Emails
      const resMails = await fetch(`${apiUrl}/api/emails/local`);
      if (resMails.ok) {
        let mailsData: Email[] = await resMails.json();

        // Filter by generated email if set, otherwise show none
        if (generatedEmail) {
          mailsData = mailsData.filter(m => m.to.toLowerCase() === generatedEmail.toLowerCase());
        } else {
          mailsData = [];
        }

        // Audio notification check
        if (knownEmailIdsRef.current !== null) {
          let hasNew = false;
          mailsData.forEach((m) => {
            if (!knownEmailIdsRef.current!.has(m.id)) {
              hasNew = true;
            }
          });
          if (hasNew) {
            playBellSound();
          }
        }
        knownEmailIdsRef.current = new Set(mailsData.map((m) => m.id));
        setEmails(mailsData);

        // Update selected mail details if active
        if (selectedMail) {
          const updated = mailsData.find((m) => m.id === selectedMail.id);
          if (updated) setSelectedMail(updated);
        }
      }

      // 2. Fetch Logs
      const resRecLogs = await fetch(`${apiUrl}/api/logs/local/receiving`);
      if (resRecLogs.ok) {
        const recData = await resRecLogs.json();
        setReceivingLogs(recData.join("\n") || "No receiving logs recorded yet.");
      }

      const resSendLogs = await fetch(`${apiUrl}/api/logs/local/sending`);
      if (resSendLogs.ok) {
        const sendData = await resSendLogs.json();
        setSendingLogs(sendData.join("\n") || "No sending logs recorded yet.");
      }
    } catch (err) {
      console.error("Error polling local data:", err);
    }
  };

  useEffect(() => {
    if (!apiUrl) return;
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [apiUrl, selectedMail?.id, generatedEmail]);

  // Checkbox management
  const handleSelectMail = (id: string) => {
    const updated = new Set(selectedMailIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedMailIds(updated);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMailIds(new Set(emails.map((e) => e.id)));
    } else {
      setSelectedMailIds(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (!apiUrl || selectedMailIds.size === 0) return;

    try {
      const deletePromises = Array.from(selectedMailIds).map(async (id) => {
        const mailToDelete = emails.find((e) => e.id === id);
        if (mailToDelete) {
          await fetch(`${apiUrl}/api/emails/delete/local/${mailToDelete.fileName}`, {
            method: "POST",
          });
        }
      });

      await Promise.all(deletePromises);
      setSelectedMailIds(new Set());
      setSelectedMail(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting selected emails:", err);
    }
  };

  const handleDeleteSingle = async (filename: string) => {
    if (!apiUrl) return;
    try {
      const res = await fetch(`${apiUrl}/api/emails/delete/local/${filename}`, {
        method: "POST",
      });
      if (res.ok) {
        setSelectedMail(null);
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting single email:", err);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl) return;
    setSendingEmail(true);
    setSendAlert(null);

    const formData = new FormData();
    formData.append("from", sendFrom);
    formData.append("to", sendTo);
    formData.append("subject", sendSubject);
    formData.append("message", sendMessage);

    const fileInput = document.getElementById("sendAttachments") as HTMLInputElement;
    if (fileInput?.files) {
      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("attachments", fileInput.files[i]);
      }
    }

    try {
      const res = await fetch(`${apiUrl}/api/send-email/local`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setSendAlert({ type: "success", msg: "Outbound SMTP transaction dispatched successfully!" });
        setSendFrom("");
        setSendTo("");
        setSendSubject("");
        setSendMessage("");
        if (fileInput) fileInput.value = "";
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "SMTP Dispatch Fail");
      }
    } catch (err: any) {
      setSendAlert({ type: "error", msg: `SMTP Dispatch failed: ${err.message}` });
    } finally {
      setSendingEmail(false);
      setTimeout(() => setSendAlert(null), 5000);
    }
  };

  const triggerNodemailerTest = async () => {
    if (!apiUrl) return;
    setTestEmailSending(true);
    try {
      const res = await fetch(`${apiUrl}/api/test-send/local`, { method: "POST" });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Error triggering local nodemailer test:", err);
    } finally {
      setTestEmailSending(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCopyLogs = (logText: string) => {
    navigator.clipboard.writeText(logText);
  };

  return (
    <div className="local-console-theme bg-[#0B0F19] text-gray-100 min-h-screen relative overflow-x-hidden font-sans">
      {/* Glow Background */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[400px] bg-radial from-[rgba(56,189,248,0.08)] via-[rgba(129,140,248,0.02)] to-transparent pointer-events-none z-0 rounded-full"></div>

      <main className="max-w-[1300px] w-full mx-auto p-8 relative z-10 flex flex-col gap-6 min-h-screen">
        {/* Top Navbar */}
        <header className="flex justify-between items-center pb-4 border-b border-white/[0.06] flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors" title="Back to Home">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7 text-sky-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span>TempEmail <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Local</span></span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">Local Console</span>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="bg-slate-900/50 border border-white/[0.06] px-4 py-2 rounded-full flex items-center gap-2.5 text-xs text-gray-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span>SMTP: <strong className="text-emerald-400">Port 2525</strong></span>
            </div>
            <div className="bg-slate-900/50 border border-white/[0.06] px-4 py-2 rounded-full flex items-center gap-2.5 text-xs text-gray-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span>API: <strong className="text-emerald-400">Port 8081</strong></span>
            </div>
            <div className="bg-slate-900/50 border border-white/[0.06] px-4 py-2 rounded-full flex items-center gap-2.5 text-xs text-gray-400 backdrop-blur-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span><strong className="text-white">{emails.length}</strong> Emails</span>
            </div>
          </div>
        </header>

        {/* Generate Email Header Component */}
        <div className="bg-[#0B0F19] border border-white/[0.06] p-5 rounded-2xl flex flex-col md:flex-row gap-5 items-center justify-between shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto flex-wrap">
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest pl-1">API Key (Optional)</label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter API Key"
                className="bg-slate-900/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 min-w-[200px]"
              />
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-[10px] uppercase text-gray-500 font-bold tracking-widest pl-1">Select Domain</label>
              <select
                value={selectedDomain}
                onChange={e => setSelectedDomain(e.target.value)}
                className="bg-slate-900/50 border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 min-w-[200px]"
              >
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto justify-end h-full mt-1 md:mt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedDomain}
                className="bg-purple-500 hover:bg-purple-400 text-slate-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>

          <div className="flex-grow flex justify-end w-full md:w-auto mt-4 md:mt-0">
            {generatedEmail ? (
              <div className="bg-purple-500/10 border border-purple-500/20 px-5 py-3 rounded-xl flex items-center justify-between gap-4 min-w-[280px]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-purple-500 font-bold tracking-widest">Generated mail</span>
                  <span className="text-white font-mono font-medium text-sm">{generatedEmail}</span>
                </div>
                <button
                  onClick={handleCopyGen}
                  className="bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors text-gray-300"
                  title="Copy Email"
                >
                  {copiedGen ? (
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-white/[0.06] px-5 py-3 rounded-xl flex items-center justify-center min-w-[280px]">
                <span className="text-gray-500 text-xs text-center">Click Generate to get a temporary email</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex gap-3 bg-white/[0.02] p-1.5 rounded-xl border border-white/[0.06] w-fit flex-wrap">
          <button
            onClick={() => setActiveTab("inbox-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeTab === "inbox-tab" ? "text-white bg-white/[0.05]" : "text-gray-400 hover:text-white"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18m-18 0V9A2.25 2.25 0 014.5 6.75h15A2.25 2.25 0 0121.75 9v4.5m-18 0V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-4.5m-15 0V9a1.5 1.5 0 00-1.5-1.5H5.25A1.5 1.5 0 003.75 9v4.5m16.5 0V9a1.5 1.5 0 00-1.5-1.5h-1.5A1.5 1.5 0 0015.75 9v4.5" />
            </svg>
            <span>Inbox</span>
          </button>
          <button
            onClick={() => setActiveTab("json-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeTab === "json-tab" ? "text-white bg-white/[0.05]" : "text-gray-400 hover:text-white"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span>Selected Email JSON</span>
          </button>
          <button
            onClick={() => setActiveTab("syslog-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeTab === "syslog-tab" ? "text-white bg-white/[0.05]" : "text-gray-400 hover:text-white"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
            <span>Receiving Email Log</span>
          </button>
          <button
            onClick={() => setActiveTab("sending-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeTab === "sending-tab" ? "text-white bg-white/[0.05]" : "text-gray-400 hover:text-white"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <span>Sending Email Log</span>
          </button>
          <button
            onClick={() => setActiveTab("send-tab")}
            className={`tab-btn flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all ${activeTab === "send-tab" ? "text-white bg-white/[0.05]" : "text-gray-400 hover:text-white"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            <span>Send Email</span>
          </button>
        </nav>

        {/* Content Panes */}
        <div className="flex-grow min-h-[500px] flex">
          {/* TAB 1: INBOX DASHBOARD */}
          {activeTab === "inbox-tab" && (
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 w-full min-h-[550px]">
              {/* Sidebar List */}
              <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl flex flex-col backdrop-blur-md overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={emails.length > 0 && selectedMailIds.size === emails.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="cursor-pointer"
                      title="Select All"
                    />
                    <h3 className="font-bold text-base">Inbox Messages</h3>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {selectedMailIds.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/20 cursor-pointer transition-colors"
                        title="Delete Selected"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={fetchData}
                      className="bg-transparent border-none cursor-pointer transition-transform hover:rotate-45"
                      title="Refresh Now"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-gray-400 hover:text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto max-h-[480px]">
                  {emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-8 text-gray-500 gap-2">
                      <span className="text-xs">No emails received yet.</span>
                    </div>
                  ) : (
                    emails.map((email) => {
                      const isSelected = selectedMail?.id === email.id ? "bg-sky-500/5 border-l-2 border-sky-400" : "border-l-2 border-transparent";
                      return (
                        <div
                          key={email.id}
                          className={`p-4 border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.01] flex items-start gap-3 ${isSelected}`}
                          onClick={() => setSelectedMail(email)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMailIds.has(email.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleSelectMail(email.id)}
                            className="mt-0.5 cursor-pointer"
                          />
                          <div className="flex-grow min-w-0 flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap font-mono max-w-[130px]">
                                {email.to}
                              </span>
                              <span className="text-[9px] text-gray-500 font-mono">
                                {new Date(email.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="text-xs text-white font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                              {email.subject}
                            </div>
                            <div className="text-[10px] text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                              From: {email.from}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Reader Pane */}
              <div className="bg-slate-900/40 border border-white/[0.05] rounded-2xl flex flex-col backdrop-blur-md overflow-hidden min-h-[550px]">
                {selectedMail ? (
                  <div className="flex-grow flex flex-col h-full">
                    <div className="p-6 border-b border-white/[0.06] flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <h2 className="text-lg font-bold text-white">{selectedMail.subject}</h2>
                        <button
                          onClick={() => handleDeleteSingle(selectedMail.fileName)}
                          className="bg-red-500/10 border border-red-500/25 hover:bg-red-500/25 text-red-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Delete Email
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-gray-300">
                        <div><strong>To:</strong> {selectedMail.to}</div>
                        <div><strong>From:</strong> {selectedMail.from}</div>
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
                          className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${viewMode === "html" ? "bg-white/[0.05] text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                          HTML Preview
                        </button>
                        <button
                          onClick={() => setViewMode("text")}
                          className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${viewMode === "text" ? "bg-white/[0.05] text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                          Plain Text
                        </button>
                      </div>

                      <div className="flex-grow bg-black/30 rounded-xl border border-white/[0.05] overflow-hidden min-h-[250px] flex">
                        {viewMode === "html" && selectedMail.html ? (
                          <iframe
                            srcDoc={selectedMail.html.replace(/"/g, "&quot;")}
                            className="w-full h-full border-none bg-white"
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-16 h-16 text-gray-600 animate-pulse">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488a2.25 2.25 0 01-2.178 0L5.431 11.887A2.25 2.25 0 014.25 9.906V9M21.75 9a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 9m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <h3 className="font-semibold text-lg text-gray-400">No Email Selected</h3>
                    <p className="text-sm max-w-xs leading-relaxed">Select an email from the left sidebar to read its contents, headers, and attachments.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SELECTED EMAIL JSON */}
          {activeTab === "json-tab" && (
            <div className="bg-[#0B0E14] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl flex-grow w-full">
              <div className="bg-[#111622] px-5 py-3 flex justify-between items-center text-xs font-mono text-gray-400 border-b border-white/[0.06]">
                <span>selected_email.json</span>
                <button
                  onClick={() => handleCopyLogs(selectedMail ? JSON.stringify(selectedMail, null, 2) : "")}
                  className="bg-transparent border border-white/[0.06] text-gray-400 px-3 py-1 rounded cursor-pointer transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="p-5 overflow-auto font-mono text-xs text-[#E2E8F0] leading-relaxed flex-grow max-h-[480px]">
                <code>
                  {selectedMail ? JSON.stringify(selectedMail, null, 2) : "// Select an email from the Inbox tab to view raw JSON data"}
                </code>
              </pre>
            </div>
          )}

          {/* TAB 3: RECEIVING EMAIL LOG */}
          {activeTab === "syslog-tab" && (
            <div className="bg-[#0B0E14] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl flex-grow w-full">
              <div className="bg-[#111622] px-5 py-3 flex justify-between items-center text-xs font-mono text-gray-400 border-b border-white/[0.06]">
                <span>receiving_traffic.log</span>
                <button
                  onClick={() => handleCopyLogs(receivingLogs)}
                  className="bg-transparent border border-white/[0.06] text-gray-400 px-3 py-1 rounded cursor-pointer transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Copy Logs
                </button>
              </div>
              <pre className="p-5 overflow-auto font-mono text-xs text-sky-400 bg-[#05070A] leading-relaxed flex-grow max-h-[480px]">
                <code>{receivingLogs}</code>
              </pre>
            </div>
          )}

          {/* TAB 4: SENDING EMAIL LOG */}
          {activeTab === "sending-tab" && (
            <div className="bg-[#0B0E14] border border-white/[0.05] rounded-2xl flex flex-col overflow-hidden shadow-2xl flex-grow w-full">
              <div className="bg-[#111622] px-5 py-3 flex justify-between items-center text-xs font-mono text-gray-400 border-b border-white/[0.06]">
                <span>sending_traffic.log</span>
                <button
                  onClick={() => handleCopyLogs(sendingLogs)}
                  className="bg-transparent border border-white/[0.06] text-gray-400 px-3 py-1 rounded cursor-pointer transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Copy Logs
                </button>
              </div>
              <pre className="p-5 overflow-auto font-mono text-xs text-sky-400 bg-[#05070A] leading-relaxed flex-grow max-h-[480px]">
                <code>{sendingLogs}</code>
              </pre>
            </div>
          )}

          {/* TAB 5: SEND EMAIL COMPOSER */}
          {activeTab === "send-tab" && (
            <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm flex-grow p-8 max-w-[800px] mx-auto w-full">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Compose Email</h2>
                <p className="text-sm text-slate-500">Send an email directly from your generated email addresses to anyone.</p>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col gap-5 flex-grow">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sendFrom" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">From</label>
                  <input
                    type="email"
                    id="sendFrom"
                    required
                    value={sendFrom}
                    onChange={(e) => setSendFrom(e.target.value)}
                    placeholder="e.g. yourname@llamerada.online"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sendTo" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">To</label>
                  <input
                    type="email"
                    id="sendTo"
                    required
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    placeholder="e.g. friend@gmail.com"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sendSubject" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    id="sendSubject"
                    required
                    value={sendSubject}
                    onChange={(e) => setSendSubject(e.target.value)}
                    placeholder="Email subject"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sendAttachments" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Attachments</label>
                  <input
                    type="file"
                    id="sendAttachments"
                    multiple
                    className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-grow">
                  <label htmlFor="sendMessage" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Message (HTML or Plain Text)</label>
                  <textarea
                    id="sendMessage"
                    required
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500/50 transition-colors min-h-[200px] flex-grow resize-none"
                  />
                </div>

                {sendAlert && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm font-semibold mt-2 ${sendAlert.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-600 border border-red-500/20"
                      }`}
                  >
                    {sendAlert.msg}
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    <span>{sendingEmail ? "Sending..." : "Send Email"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <footer className="flex flex-col items-center gap-4 pt-6 border-t border-white/[0.06] mt-auto">
          <div className="flex gap-4">
            <button
              onClick={triggerNodemailerTest}
              disabled={testEmailSending}
              className="bg-sky-500/10 border border-sky-500/25 text-sky-400 hover:bg-sky-500/20 px-6 py-2.5 rounded-lg font-semibold cursor-pointer transition-all flex items-center gap-2 shadow-lg shadow-sky-500/5 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{testEmailSending ? "Sending Test..." : "Send Test Email (Nodemailer)"}</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 font-mono">Local Console Port: 2525. Emails: backend/storage/local/</p>
        </footer>

        {/* Floating Help Button */}
        <button
          onClick={() => setIsHelpOpen(true)}
          className="fixed bottom-6 right-6 bg-sky-500 hover:bg-sky-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:shadow-sky-500/20 transition-all hover:scale-110 cursor-pointer z-40 border border-sky-400/20 animate-pulse"
          style={{ animationDuration: "2s" }}
          title="Instructions & Guide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </button>

        {/* Instruction Modal */}
        {isHelpOpen && (
          <div className="fixed inset-0 w-screen h-screen bg-black/80 backdrop-blur-[5px] z-50 flex items-center justify-center transition-opacity duration-300">
            <div className="bg-[#0F1626] border border-white/[0.06] w-full max-w-[650px] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-5 border-b border-white/[0.06] flex justify-between items-center bg-[#131B2E]">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-sky-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                  <h2 className="text-lg font-bold text-white">Local Console Guide</h2>
                </div>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="bg-transparent border-none text-gray-400 text-2xl cursor-pointer hover:text-white transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Tabs selector */}
              <div className="flex border-b border-white/[0.06] bg-[#0A0F1D]">
                <button
                  onClick={() => setHelpActiveTab("flow")}
                  className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${helpActiveTab === "flow"
                    ? "text-sky-400 border-sky-500 bg-white/[0.02]"
                    : "text-gray-400 border-transparent hover:text-white"
                    }`}
                >
                  Local Flow
                </button>
                <button
                  onClick={() => setHelpActiveTab("smtp")}
                  className={`flex-1 py-3 text-sm font-semibold transition-all border-b-2 ${helpActiveTab === "smtp"
                    ? "text-sky-400 border-sky-500 bg-white/[0.02]"
                    : "text-gray-400 border-transparent hover:text-white"
                    }`}
                >
                  Local SMTP Testing
                </button>
              </div>

              {/* Content area (scrollable) */}
              <div className="p-6 overflow-y-auto flex-grow text-gray-300 text-sm leading-relaxed flex flex-col gap-4">
                {helpActiveTab === "flow" ? (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-sky-500 rounded"></span>
                      Local SMTP & Mail Trap Workflow
                    </h3>
                    <ul className="list-disc pl-5 flex flex-col gap-2.5 text-gray-400">
                      <li><strong>SMTP Connection:</strong> A local SMTP server runs on port <code className="bg-black/40 px-1.5 py-0.5 rounded text-sky-400 font-mono">2525</code>, listening for incoming email traffic.</li>
                      <li><strong>Parsing Service:</strong> When an email is sent to port 2525, the server captures it and routes the raw stream to <code className="text-white font-semibold">mailparser</code>.</li>
                      <li><strong>Metadata Extraction:</strong> HTML bodies, plain text, headers, and attachments are processed and extracted automatically.</li>
                      <li><strong>JSON File Storage:</strong> The parsed results are stored as individual <code className="bg-black/40 px-1.5 py-0.5 rounded text-sky-400 font-mono">.json</code> transaction records inside the folder <code className="text-gray-200 font-mono">backend/storage/local/</code>.</li>
                      <li><strong>Real-time Dashboard:</strong> This dashboard polls the local server API on port <code className="bg-black/40 px-1.5 py-0.5 rounded text-sky-400 font-mono">8081</code> every 3 seconds to fetch new items.</li>
                      <li><strong>Audio Notification:</strong> When a new email arrives, a bell notification plays (<code className="text-gray-200">bell.wav</code>).</li>
                    </ul>

                    {/* Explanation callout */}
                    <div className="bg-slate-900/50 border border-white/[0.04] p-4 rounded-xl mt-3 flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                        <span>Why are these Protocols & Ports used?</span>
                      </div>
                      <div className="flex flex-col gap-2.5 text-xs text-gray-400 leading-relaxed font-sans">
                        <p>💡 <strong className="text-gray-300 font-semibold">Why SMTP Protocol?</strong> SMTP (Simple Mail Transfer Protocol) is the absolute global standard for email transmission. Every email server in the world (Gmail, Yahoo, etc.) communicates using this protocol. There are no alternative protocols for receiving raw inter-server mail deliveries.</p>
                        <p>🔌 <strong className="text-gray-300 font-semibold">Why Port 2525 locally instead of Port 25?</strong> Standard SMTP operates on Port 25. However, macOS and Linux restrict port numbers below 1024 to root/administrator accounts only. To allow developers to run, test, and debug this email server locally without root privileges, we use port <code className="bg-black/30 px-1 py-0.5 rounded text-sky-400 font-mono text-[10px]">2525</code>.</p>
                        <p>🌐 <strong className="text-gray-300 font-semibold">Why Port 8081?</strong> Port 8081 runs our separate lightweight HTTP server that serves parsed email JSON files via a REST API to this dashboard frontend. This ensures we don't block SMTP socket transactions on port 2525 with web UI requests.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 animate-fadeIn">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-sky-500 rounded"></span>
                      SMTP Testing & Sending
                    </h3>
                    <p>You can send test emails to your local SMTP trap server using standard libraries or CLI scripts:</p>
                    <ol className="list-decimal pl-5 flex flex-col gap-3 text-gray-400">
                      <li>
                        <strong>Using the Send Button:</strong> Click the <code className="text-white font-semibold">Send Test Email (Nodemailer)</code> button at the bottom of the console page. This triggers an internal script connecting to <code className="text-sky-400 font-mono">127.0.0.1:2525</code> to dispatch a test email.
                      </li>
                      <li>
                        <strong>Using Nodemailer in scripts:</strong>
                        <pre className="bg-black/50 p-2.5 rounded font-mono text-xs text-sky-300 mt-1.5 select-all">
                          {`const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 2525,
  secure: false
});`}
                        </pre>
                      </li>
                      <li>
                        <strong>Using telnet or netcat:</strong> Send raw SMTP transactions directly from your terminal:
                        <pre className="bg-black/50 p-2.5 rounded font-mono text-xs text-sky-300 mt-1.5 select-all">nc localhost 2525</pre>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
