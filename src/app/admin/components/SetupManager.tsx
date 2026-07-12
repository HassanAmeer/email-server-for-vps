"use client";

import { useState, useEffect } from "react";

interface SetupManagerProps {
  apiUrl: string;
}

export default function SetupManager({ apiUrl }: SetupManagerProps) {
  const [activeTab, setActiveTab] = useState<"receive" | "send">("receive");
  const [dkimKey, setDkimKey] = useState<string>("");
  const [loadingDkim, setLoadingDkim] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [serverIp, setServerIp] = useState<string>("Loading...");
  const [ipCopied, setIpCopied] = useState<boolean>(false);

  // Attached Domains State
  interface AttachedDomain {
    id: number;
    domain: string;
    status: string;
    catch_all: number;
    created_at: string;
  }
  const [domains, setDomains] = useState<AttachedDomain[]>([]);
  const [newDomain, setNewDomain] = useState<string>("");
  const [isAddingDomain, setIsAddingDomain] = useState<boolean>(false);
  const [loadingDomains, setLoadingDomains] = useState<boolean>(false);
  const [showDomainConfirmModal, setShowDomainConfirmModal] = useState<number | null>(null);

  useEffect(() => {
    // Fetch public IP address
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => setServerIp(data.ip))
      .catch(() => setServerIp("Failed to get IP"));

    if (activeTab === "receive") {
      fetchDkimKey();
      fetchDomains();
    }
  }, [activeTab, apiUrl]);

  const fetchDkimKey = async () => {
    setLoadingDkim(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/dkim`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDkimKey(data.key);
      } else {
        setDkimKey(""); // Key might not exist yet
      }
    } catch (err: any) {
      console.error("Error fetching DKIM key:", err);
    } finally {
      setLoadingDkim(false);
    }
  };

  const handleGenerateDkimClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmGenerate = async () => {
    setShowConfirmModal(false);
    setGenerating(true);
    setError("");
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/dkim/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setDkimKey(data.key);
        alert("Digital Signature (DKIM) successfully generated!");
      } else {
        throw new Error(data.error || "Failed to generate DKIM key");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const fetchDomains = async () => {
    setLoadingDomains(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
      }
    } catch (err) {
      console.error("Error fetching domains:", err);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setIsAddingDomain(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ domain: newDomain })
      });

      if (res.ok) {
        setNewDomain("");
        await fetchDomains();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add domain");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleUpdateDomainStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchDomains();
      }
    } catch (err: any) {
      alert("Failed to update status");
    }
  };

  const handleUpdateDomainCatchAll = async (id: number, currentCatchAll: number) => {
    const newCatchAll = currentCatchAll === 1 ? 0 : 1;
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ catch_all: newCatchAll })
      });
      if (res.ok) {
        await fetchDomains();
      }
    } catch (err: any) {
      alert("Failed to update Catch-All status");
    }
  };

  const handleDeleteDomain = async () => {
    if (showDomainConfirmModal === null) return;
    const id = showDomainConfirmModal;

    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setShowDomainConfirmModal(null);
        await fetchDomains();
      }
    } catch (err: any) {
      alert("Failed to delete domain");
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          System Setup Instructions
        </h1>
        <p className="text-gray-400 text-sm">
          Follow these instructions to configure your domain and server for optimal email delivery and reception.
        </p>

        {/* Server IP Display */}
        <div className="mt-4 flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 max-w-sm">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-0.5">Your Server IP</span>
            <span className="text-gray-300 font-mono text-sm">{serverIp}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(serverIp);
              setIpCopied(true);
              setTimeout(() => setIpCopied(false), 2000);
            }}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-colors text-gray-400 hover:text-white group flex items-center gap-2"
            title="Copy IP Address"
          >
            {ipCopied ? (
              <span className="text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Copied!
              </span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Enhanced Tabs */}
      <div className="flex w-full bg-[#090C16]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-1.5 gap-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <button
          onClick={() => setActiveTab("receive")}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${activeTab === "receive"
            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            : "text-gray-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
        >
          {activeTab === "receive" && (
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 opacity-50"></span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Receive Email Setup
        </button>
        <button
          onClick={() => setActiveTab("send")}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${activeTab === "send"
            ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
            : "text-gray-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
            }`}
        >
          {activeTab === "send" && (
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 opacity-50"></span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          Send Email Setup
        </button>
      </div>

      {/* Receive Email Setup */}
      {activeTab === "receive" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Domain DNS Configuration</h2>
            <p className="text-gray-400 text-sm mb-6">
              To receive emails, you must configure your domain's DNS settings. Navigate to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare) and add the following records:
            </p>

            <div className="space-y-4">
              {/* A Record */}
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-emerald-400">1. A Record (Server IP)</span>
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400">Required</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                    <p className="text-white font-mono text-sm">A</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Name</span>
                    <p className="text-white font-mono text-sm">mail</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Value</span>
                    <p className="text-white font-mono text-sm">Your VPS IP Address</p>
                  </div>
                </div>
              </div>

              {/* MX Record */}
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-emerald-400">2. MX Record (Mail Exchange)</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Crucial for Receiving</span>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                    <p className="text-white font-mono text-sm">MX</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Name</span>
                    <p className="text-white font-mono text-sm">@</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Value</span>
                    <p className="text-white font-mono text-sm">mail.yourdomain.com</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Priority</span>
                    <p className="text-white font-mono text-sm">10</p>
                  </div>
                </div>
              </div>

              {/* SPF Record */}
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-emerald-400">3. SPF Record (Sender Policy)</span>
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400">Recommended</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                    <p className="text-white font-mono text-sm">TXT</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Name</span>
                    <p className="text-white font-mono text-sm">@</p>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <span className="text-[10px] text-gray-500 uppercase">Value</span>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-mono text-sm truncate">v=spf1 mx a ip4:YOUR_VPS_IP ~all</p>
                      <button onClick={() => copyToClipboard("v=spf1 mx a ip4:YOUR_VPS_IP ~all")} className="text-gray-500 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* DMARC Record */}
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-emerald-400">4. DMARC Record</span>
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400">Recommended</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                    <p className="text-white font-mono text-sm">TXT</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase">Name</span>
                    <p className="text-white font-mono text-sm">_dmarc</p>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <span className="text-[10px] text-gray-500 uppercase">Value</span>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-mono text-sm truncate">v=DMARC1; p=none;</p>
                      <button onClick={() => copyToClipboard("v=DMARC1; p=none;")} className="text-gray-500 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">5. DKIM (Digital Signature)</h2>
                <p className="text-gray-400 text-sm">
                  Required for 100% Inbox delivery on major platforms like Google & Yahoo.
                </p>
              </div>
              <button
                onClick={handleGenerateDkimClick}
                disabled={generating}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {generating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Generate Signature
                  </>
                )}
              </button>
            </div>

            {loadingDkim ? (
              <div className="h-32 bg-[#070A13] border border-white/[0.05] rounded-xl flex items-center justify-center text-gray-500">
                Loading DKIM Key...
              </div>
            ) : dkimKey ? (
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05]">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-1">
                    <span className="text-[10px] text-gray-500 uppercase">Type</span>
                    <p className="text-white font-mono text-sm">TXT</p>
                  </div>
                  <div className="sm:col-span-1">
                    <span className="text-[10px] text-gray-500 uppercase">Name</span>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-mono text-sm">default._domainkey</p>
                      <button onClick={() => copyToClipboard("default._domainkey")} className="text-gray-500 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-4">
                    <span className="text-[10px] text-gray-500 uppercase">Value (Public Key)</span>
                    <div className="relative mt-1">
                      <textarea
                        readOnly
                        value={dkimKey}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-emerald-400 font-mono text-xs resize-none outline-none break-all focus:border-emerald-500/50"
                        rows={4}
                      />
                      <button
                        onClick={() => copyToClipboard(dkimKey)}
                        className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded-md transition-colors"
                        title="Copy Key"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-yellow-500 text-sm">
                No DKIM signature found. Click the Generate button above to create one.
              </div>
            )}
            <div className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-red-400 shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="text-red-400 font-bold text-sm">Critical Warning: Multiple Domains</h4>
                <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                  You do not need to generate a new key for every domain, the same public key can be used across all domains pointing to this server. However, <strong>if you generate a NEW DKIM signature</strong>, you MUST update the <code>default._domainkey</code> TXT record with the new signature across <strong>ALL domains</strong> that are attached to this server, otherwise their outbound emails will fail authentication.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-6 mt-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-indigo-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  Attached Domains
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Manage domains connected to this server. Total attached: <strong className="text-white">{domains.length}</strong>
                </p>
              </div>
              <form onSubmit={handleAddDomain} className="flex gap-2 relative z-0">
                <input
                  type="text"
                  placeholder="e.g. example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="bg-[#070A13] border border-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 w-full sm:w-48"
                  required
                />
                <button
                  type="submit"
                  disabled={isAddingDomain}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isAddingDomain ? "..." : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add
                    </>
                  )}
                </button>
              </form>
            </div>

            {loadingDomains ? (
              <div className="text-center py-8 text-gray-500 text-sm">Loading domains...</div>
            ) : domains.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-white/[0.05] rounded-xl">
                No domains attached yet. Add one above.
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {domains.map(domain => (
                  <div key={domain.id} className="bg-[#070A13] border border-white/[0.05] p-4 rounded-xl flex flex-col gap-3 min-w-[240px] flex-1 max-w-sm group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold font-mono text-sm">{domain.domain}</h3>
                      <button
                        onClick={() => setShowDomainConfirmModal(domain.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                        title="Delete Domain"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-col text-gray-500">
                        <span>Added on:</span>
                        <span>{new Date(domain.created_at).toLocaleString()}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateDomainCatchAll(domain.id, domain.catch_all)}
                          className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[10px] transition-colors ${domain.catch_all === 1
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            }`}
                          title="Toggle whether this domain accepts emails for any random address, or only explicitly generated addresses."
                        >
                          CATCH-ALL: {domain.catch_all === 1 ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => handleUpdateDomainStatus(domain.id, domain.status)}
                          className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[10px] transition-colors ${domain.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                            }`}
                        >
                          {domain.status}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Domain Deletion Confirmation Modal */}
      {showDomainConfirmModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDomainConfirmModal(null)}
          ></div>
          <div className="relative bg-[#090C16] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-red-500/10 animate-fade-in z-10 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Remove Domain
            </h3>

            <p className="text-gray-400 text-sm">Are you sure you want to remove this domain from the server? This action cannot be undone.</p>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.05]">
              <button
                onClick={() => setShowDomainConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDomain}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-sm transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          ></div>
          <div className="relative bg-[#090C16] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-emerald-500/10 animate-fade-in z-10 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Confirm DKIM Generation
            </h3>

            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <h4 className="text-red-400 font-bold text-sm mb-1">Warning: Multiple Domains Attached!</h4>
              <p className="text-red-400/90 text-xs leading-relaxed">
                If you generate a NEW DKIM signature, you MUST update the <code>default._domainkey</code> TXT record with this new signature across <strong>ALL domains</strong> that are attached to this server. Failure to update all domains will cause their outbound emails to be rejected or marked as spam.
              </p>
            </div>

            <p className="text-gray-400 text-sm">Are you sure you want to proceed and generate a new digital signature?</p>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.05]">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmGenerate}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-sm transition-colors"
              >
                Yes, Generate New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Setup */}
      {activeTab === "send" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Server Port Requirements</h2>
            <p className="text-gray-400 text-sm mb-6">
              To ensure the server can send and receive emails properly, certain network ports must be open and available on your VPS firewall.
            </p>

            <div className="space-y-4">
              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-lg shrink-0">
                  25
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Live Production (Port 25)</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    This is the standard SMTP port. All incoming emails from platforms like Gmail, Yahoo, and Outlook arrive on this port. Your VPS provider (like Hostinger, AWS, DigitalOcean) MUST have Port 25 unblocked.
                  </p>
                </div>
              </div>

              <div className="bg-[#070A13] p-4 rounded-xl border border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 bg-gray-500/10 border border-gray-500/20 rounded-xl flex items-center justify-center text-gray-400 font-bold text-lg shrink-0">
                  2525
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Local Development (Port 2525)</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    If you are running the server in local mode (`live=false` in .env), the server will listen on Port 2525 to avoid requiring root privileges.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Outbound Email Configuration</h2>
            <div className="text-sm text-gray-400 space-y-4">
              <p>
                Due to strict spam policies globally, sending emails directly from a new VPS IP Address will almost certainly land your emails in the <strong>Spam Folder</strong>.
              </p>
              <p>
                To fix this, our server supports integrating third-party <strong>SMTP Relays</strong> (e.g. SendGrid, Mailgun, Amazon SES).
              </p>
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl mt-4">
                <h4 className="text-emerald-400 font-bold mb-2">How to Setup Sending:</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-300">
                  <li>Navigate to the <strong>SMTP Relay Credentials</strong> tab from the sidebar.</li>
                  <li>Add the Username and Password provided by your SMTP relay service.</li>
                  <li>Ensure your DKIM and SPF records are correctly set up on your domain (see Receive Setup tab).</li>
                  <li>Use the provided API endpoints to dispatch emails globally.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
