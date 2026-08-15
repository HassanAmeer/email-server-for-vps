"use client";

import { useState, useEffect } from "react";

interface DomainsManagerProps {
  apiUrl: string;
}

interface AttachedDomain {
  id: number;
  domain: string;
  status: string;
  plan?: string;
  catch_all?: number | boolean;
  is_primary?: number | boolean;
  created_at: string;
}

interface DnsCheckResult {
  valid: boolean;
  details?: string[];
  error?: string;
}

interface VerificationModalState {
  domain: string;
  id: number;
  verified: boolean;
  status: string;
  results: {
    mx: DnsCheckResult;
    a: DnsCheckResult;
    spf: DnsCheckResult;
    dkim: DnsCheckResult;
  };
}

export default function DomainsManager({ apiUrl }: DomainsManagerProps) {
  // Attached Domains State
  const [domains, setDomains] = useState<AttachedDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Add Domain Top Form State
  const [newDomainInput, setNewDomainInput] = useState<string>("");
  const [newDomainPlan, setNewDomainPlan] = useState<"free" | "premium">("free");
  const [newDomainCatchAll, setNewDomainCatchAll] = useState<boolean>(true);
  const [isSubmittingDomain, setIsSubmittingDomain] = useState<boolean>(false);

  // Server IP & DKIM State
  const [serverIp, setServerIp] = useState<string>(process.env.NEXT_PUBLIC_SERVER_IP || "127.0.0.1");
  const [ipCopied, setIpCopied] = useState<boolean>(false);
  const [dkimKey, setDkimKey] = useState<string>("");
  const [loadingDkim, setLoadingDkim] = useState<boolean>(false);
  const [generatingDkim, setGeneratingDkim] = useState<boolean>(false);
  const [showDkimConfirmModal, setShowDkimConfirmModal] = useState<boolean>(false);

  // Right Sheet (Drawer) State
  const [isRightSheetOpen, setIsRightSheetOpen] = useState<boolean>(false);
  const [sheetDomain, setSheetDomain] = useState<string>("");
  const [sheetMode, setSheetMode] = useState<"add" | "view">("add");
  const [activeSheetTab, setActiveSheetTab] = useState<"receive" | "send">("receive");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Verification State
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verificationModal, setVerificationModal] = useState<VerificationModalState | null>(null);

  // Delete Modal State
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<number | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (apiUrl) {
      fetchDomains(true);
      fetchDkimKey();
    }
  }, [apiUrl]);

  const fetchDomains = async (showLoadingState = false) => {
    if (!apiUrl) return;
    if (showLoadingState) {
      setLoadingDomains(true);
    }
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching domains:", err);
    } finally {
      if (showLoadingState) {
        setLoadingDomains(false);
      }
    }
  };

  const fetchDkimKey = async () => {
    if (!apiUrl) return;
    setLoadingDkim(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/serverinfo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDkimKey(data.key || "");
        if (data.ip_address && data.ip_address !== "Failed to get IP") {
          setServerIp(data.ip_address);
        }
      }
    } catch (err) {
      console.error("Error fetching server info & DKIM key:", err);
    } finally {
      setLoadingDkim(false);
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Triggered when user enters domain name at top and submits
  const handleOpenAddSheet = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newDomainInput.trim().toLowerCase();
    if (!formatted) return;

    const cleanDomain = formatted.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    setSheetDomain(cleanDomain);
    setSheetMode("add");
    setActiveSheetTab("receive");
    setIsRightSheetOpen(true);
  };

  // Open Right Sheet in "View" mode for an existing domain
  const handleOpenViewSheet = (domainName: string) => {
    setSheetDomain(domainName);
    setSheetMode("view");
    setActiveSheetTab("receive");
    setIsRightSheetOpen(true);
  };

  // Save domain to DB from Right Sheet
  const handleSaveAndAddDomain = async () => {
    if (!sheetDomain) return;
    setIsSubmittingDomain(true);

    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain: sheetDomain,
          status: "pending",
          plan: newDomainPlan,
          catch_all: newDomainCatchAll ? 1 : 0
        })
      });

      if (res.ok) {
        setNewDomainInput("");
        setIsRightSheetOpen(false);
        await fetchDomains(false);
        showToast(`Domain ${sheetDomain} added with Pending status! Click Verify anytime.`, "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to add domain", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error", "error");
    } finally {
      setIsSubmittingDomain(false);
    }
  };

  // Triggered when clicking Outline "Verify" button on a domain row
  const handleVerifyDomain = async (domainObj: AttachedDomain) => {
    setVerifyingId(domainObj.id);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${domainObj.id}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setDomains(prev => prev.map(d => d.id === domainObj.id ? { ...d, status: data.status } : d));
        }
        setVerificationModal({
          domain: domainObj.domain,
          id: domainObj.id,
          verified: data.verified,
          status: data.status,
          results: data.results || {
            mx: { valid: false },
            a: { valid: false },
            spf: { valid: false },
            dkim: { valid: false }
          }
        });
        if (data.verified) {
          showToast(`Domain ${domainObj.domain} successfully verified and activated!`, "success");
        }
      } else {
        const data = await res.json();
        showToast(data.error || "Verification failed to complete", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to connect to verification service", "error");
    } finally {
      setVerifyingId(null);
    }
  };

  // Force mark active
  const handleForceActivate = async (id: number) => {
    setDomains(prev => prev.map(d => d.id === id ? { ...d, status: "active" } : d));
    setVerificationModal(null);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "active" })
      });
      if (res.ok) {
        showToast("Domain manually marked as Active!", "success");
      } else {
        await fetchDomains(false);
        showToast("Failed to activate domain", "error");
      }
    } catch (err) {
      await fetchDomains(false);
      showToast("Failed to activate domain", "error");
    }
  };

  const handleUpdateDomainStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    // Pure Local State Management: Update immediately in UI
    setDomains(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Domain status updated to ${newStatus}`);
      } else {
        // Rollback state on error
        setDomains(prev => prev.map(d => d.id === id ? { ...d, status: currentStatus } : d));
        showToast("Failed to update status", "error");
      }
    } catch (err) {
      // Rollback state on error
      setDomains(prev => prev.map(d => d.id === id ? { ...d, status: currentStatus } : d));
      showToast("Failed to update status", "error");
    }
  };

  const handleUpdateDomainCatchAll = async (id: number, currentCatchAll: number | boolean | undefined) => {
    const isCurrentlyOn = currentCatchAll === 1 || currentCatchAll === true;
    const newCatchAll = isCurrentlyOn ? 0 : 1;
    // Pure Local State Management: Update immediately in UI
    setDomains(prev => prev.map(d => d.id === id ? { ...d, catch_all: newCatchAll } : d));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ catch_all: newCatchAll })
      });
      if (res.ok) {
        showToast(`Catch-all ${newCatchAll === 1 ? "enabled" : "disabled"}`);
      } else {
        // Rollback state on error
        setDomains(prev => prev.map(d => d.id === id ? { ...d, catch_all: isCurrentlyOn ? 1 : 0 } : d));
        showToast("Failed to update Catch-All status", "error");
      }
    } catch (err) {
      // Rollback state on error
      setDomains(prev => prev.map(d => d.id === id ? { ...d, catch_all: isCurrentlyOn ? 1 : 0 } : d));
      showToast("Failed to update Catch-All status", "error");
    }
  };

  const handleUpdateDomainPlan = async (id: number, currentPlan: string = "free") => {
    const newPlan = currentPlan === "free" ? "premium" : "free";
    // Pure Local State Management: Update immediately in UI
    setDomains(prev => prev.map(d => d.id === id ? { ...d, plan: newPlan } : d));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan: newPlan })
      });
      if (res.ok) {
        showToast(`Domain plan updated to ${newPlan === "premium" ? "Premium" : "Free"}`);
      } else {
        // Rollback state on error
        setDomains(prev => prev.map(d => d.id === id ? { ...d, plan: currentPlan } : d));
        showToast("Failed to update domain plan", "error");
      }
    } catch (err) {
      // Rollback state on error
      setDomains(prev => prev.map(d => d.id === id ? { ...d, plan: currentPlan } : d));
      showToast("Failed to update domain plan", "error");
    }
  };

  const handleDeleteDomain = async () => {
    if (showDeleteConfirmModal === null) return;
    const id = showDeleteConfirmModal;
    const targetDomain = domains.find(d => d.id === id);

    // Optimistically remove from state immediately
    setDomains(prev => prev.filter(d => d.id !== id));
    setShowDeleteConfirmModal(null);

    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        showToast("Domain deleted successfully");
      } else {
        // Rollback
        if (targetDomain) {
          setDomains(prev => [targetDomain, ...prev]);
        }
        const data = await res.json();
        showToast(data.error || "Failed to delete domain", "error");
      }
    } catch (err: any) {
      if (targetDomain) {
        setDomains(prev => [targetDomain, ...prev]);
      }
      showToast("Failed to delete domain", "error");
    }
  };

  // Subnav Tab State (All Domains vs Primary Domain)
  const [activeDomainTab, setActiveDomainTab] = useState<"all" | "primary">("all");

  const handleSetPrimaryDomain = async (id: number) => {
    // Pure Local State Management: Update immediately in UI
    setDomains(prev => prev.map(d => ({
      ...d,
      is_primary: d.id === id ? 1 : 0
    })));
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/domains/${id}/primary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const primaryDomain = domains.find(d => d.id === id);
        showToast(`Domain ${primaryDomain ? primaryDomain.domain : ""} set as Primary Mailbox Domain!`, "success");
      } else {
        await fetchDomains(false);
        showToast("Failed to set Primary Domain", "error");
      }
    } catch (err) {
      await fetchDomains(false);
      showToast("Failed to set Primary Domain", "error");
    }
  };

  const handleConfirmGenerateDkim = async () => {
    setShowDkimConfirmModal(false);
    setGeneratingDkim(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/dkim/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setDkimKey(data.key);
        showToast("Digital Signature (DKIM) successfully generated! Please update your DNS TXT record.", "success");
      } else {
        throw new Error(data.error || "Failed to generate DKIM key");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setGeneratingDkim(false);
    }
  };

  const filteredDomains = domains.filter((d) =>
    d.domain.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const primaryDomainObj = domains.find(d => d.is_primary === 1 || d.is_primary === true) || (domains.length > 0 ? domains[0] : null);

  return (
    <div className="flex flex-col gap-8 animate-fade-in w-full max-w-7xl mx-auto pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 text-sm font-semibold ${
              toastMessage.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-950/50"
                : "bg-red-950/90 border-red-500/30 text-red-300 shadow-red-950/50"
            }`}
          >
            {toastMessage.type === "success" ? (
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#090C16]/80 border border-white/[0.06] rounded-3xl p-6 lg:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-emerald-500/10 via-transparent to-transparent pointer-events-none rounded-full -mr-20 -mt-20"></div>

        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Domains</h1>
              <p className="text-gray-400 text-xs sm:text-sm font-medium mt-0.5">
                Manage custom domains, configure Primary Mailbox routing, and verify email delivery setup.
              </p>
            </div>
          </div>
        </div>

        {/* Server IP Card */}
        <div className="flex items-center gap-3 bg-black/40 border border-white/[0.08] rounded-2xl p-3.5 px-4.5 relative z-10 shrink-0 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Your VPS IP Address</span>
            <span className="text-emerald-400 font-mono text-sm font-bold tracking-wider">{serverIp}</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(serverIp);
              setIpCopied(true);
              setTimeout(() => setIpCopied(false), 2000);
            }}
            className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-emerald-500/20 hover:text-emerald-400 transition-all text-gray-400 cursor-pointer flex items-center justify-center border border-white/5"
            title="Copy Server IP"
          >
            {ipCopied ? (
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* TOP BAR: Add Domain Input Bar */}
      <div className="bg-[#090C16] border border-emerald-500/20 rounded-3xl p-5 lg:p-7 shadow-[0_10px_40px_rgba(16,185,129,0.04)] relative">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Add New Domain
            </h2>
            <span className="text-xs text-gray-500">
              Total attached: <strong className="text-emerald-400">{domains.length}</strong>
            </span>
          </div>

          <form onSubmit={handleOpenAddSheet} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Enter domain name (e.g. mailserver.com or mycompany.org)"
                value={newDomainInput}
                onChange={(e) => setNewDomainInput(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                required
              />
            </div>

            {/* Plan Selector */}
            <div className="flex items-center bg-black/40 border border-white/10 rounded-2xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setNewDomainPlan("free")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newDomainPlan === "free"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Free Plan
              </button>
              <button
                type="button"
                onClick={() => setNewDomainPlan("premium")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  newDomainPlan === "premium"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Premium Plan
              </button>
            </div>

            {/* Catch-All Toggle */}
            <button
              type="button"
              onClick={() => setNewDomainCatchAll(!newDomainCatchAll)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                newDomainCatchAll
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.02] border-white/10 text-gray-400"
              }`}
              title="Catch-all routes any incoming email address for this domain"
            >
              <span className={`w-2 h-2 rounded-full ${newDomainCatchAll ? "bg-emerald-400" : "bg-gray-500"}`}></span>
              Catch-All: {newDomainCatchAll ? "ON" : "OFF"}
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-extrabold px-6 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add Domain</span>
            </button>
          </form>
        </div>
      </div>

          {/* DOMAINS TABLE SECTION */}
          <div className="bg-[#090C16] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Table Header Bar with Search */}
            <div className="p-5 lg:p-6 border-b border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.01]">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Attached Domains
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/[0.05] text-gray-400 border border-white/[0.06]">
                  {filteredDomains.length} of {domains.length}
                </span>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Search domains..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
                <svg className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Table Body */}
            {loadingDomains ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Loading domains...</span>
              </div>
            ) : filteredDomains.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center text-gray-600 mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-gray-300">No Domains Attached</h4>
                <p className="text-gray-500 text-xs max-w-sm mt-1">
                  Enter your domain name above to configure DNS records and start receiving emails.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Domain</th>
                      <th className="py-4 px-6">Plan</th>
                      <th className="py-4 px-6">Catch-All</th>
                      <th className="py-4 px-6">Primary</th>
                      <th className="py-4 px-6">Status & Verification</th>
                      <th className="py-4 px-6">DNS Guide</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-sm">
                    {filteredDomains.map((domain) => (
                      <tr key={domain.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Domain Name */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-white text-sm tracking-wide flex items-center gap-2">
                                {domain.domain}
                                {(domain.is_primary === 1 || domain.is_primary === true) && (
                                  <span className="text-amber-400 text-xs" title="Primary Domain">★</span>
                                )}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                Added {new Date(domain.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-4.5 px-6">
                          <button
                            onClick={() => handleUpdateDomainPlan(domain.id, domain.plan || "free")}
                            className={`px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                              domain.plan === "premium"
                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 shadow-purple-500/10"
                                : "bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 shadow-blue-500/10"
                            }`}
                            title="Click to toggle between Free and Premium plan"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${domain.plan === "premium" ? "bg-purple-400" : "bg-blue-400"}`}></span>
                            {domain.plan === "premium" ? "Premium" : "Free"}
                          </button>
                        </td>

                        {/* Catch-All */}
                        <td className="py-4.5 px-6">
                          <button
                            onClick={() => handleUpdateDomainCatchAll(domain.id, domain.catch_all)}
                            className={`px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-[11px] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                              domain.catch_all === 1 || domain.catch_all === true
                                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-emerald-500/10"
                                : "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 shadow-red-500/10"
                            }`}
                            title="Click to toggle catch-all routing (Enabled / Disabled)"
                          >
                            <span className={`w-2 h-2 rounded-full ${domain.catch_all === 1 || domain.catch_all === true ? "bg-emerald-400" : "bg-red-400"}`}></span>
                            {domain.catch_all === 1 || domain.catch_all === true ? "Enabled" : "Disabled"}
                          </button>
                        </td>

                        {/* Primary Domain Status / Toggle */}
                        <td className="py-4.5 px-6">
                          {domain.is_primary === 1 || domain.is_primary === true ? (
                            <span className="px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm shadow-amber-500/10 w-fit">
                              <span className="text-amber-400">★</span> Primary
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryDomain(domain.id)}
                              className="px-3 py-1.5 rounded-xl font-bold text-[11px] text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 w-fit"
                              title="Click to set this domain as Primary for Mailbox"
                            >
                              <span className="text-gray-500 hover:text-amber-400">☆</span> Set Primary
                            </button>
                          )}
                        </td>

                        {/* Status & Outline Verify Button */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-3 flex-wrap">
                            {domain.status === "active" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                Active
                              </span>
                            ) : domain.status === "paused" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 text-xs font-bold">
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                Pending
                              </span>
                            )}

                            {/* OUTLINE VERIFY BUTTON */}
                            <button
                              onClick={() => handleVerifyDomain(domain)}
                              disabled={verifyingId === domain.id}
                              className="border border-emerald-500/40 hover:border-emerald-400 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
                              title="Verify DNS records (MX, SPF, A, DKIM)"
                            >
                              {verifyingId === domain.id ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Verifying...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Verify</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* View DNS Setup Button */}
                        <td className="py-4.5 px-6">
                          <button
                            onClick={() => handleOpenViewSheet(domain.domain)}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            title="View DNS configuration instructions for this domain"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>DNS Records</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-4.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUpdateDomainStatus(domain.id, domain.status)}
                              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                              title={domain.status === "active" ? "Pause domain" : "Activate domain"}
                            >
                              {domain.status === "active" ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirmModal(domain.id)}
                              className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              title="Delete Domain"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

      {/* ========================================================= */}
      {/* RIGHT SHEET (DRAWER) - ULTRA HIGH-DENSITY COMPACT DRAWER  */}
      {/* ========================================================= */}
      {isRightSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* 
            CRITICAL USER REQUIREMENT:
            Clicking the backdrop must NOT close the sheet!
            Only explicit Close button or Done button will close it.
          */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"></div>

          <div className="fixed inset-y-0 right-0 max-w-3xl w-full flex pl-4 sm:pl-8 z-50">
            <div className="w-full bg-[#090C16] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden">
              {/* Sheet Header - Ultra Compact (Single Line, minimal vertical space) */}
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                  <h3 className="text-sm font-extrabold text-white tracking-tight">DNS Setup Instructions</h3>
                  <span className="text-gray-600 font-normal">·</span>
                  <span className="text-[11px] text-gray-400">Domain:</span>
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {sheetDomain || "yourdomain.com"}
                  </span>
                </div>

                {/* Explicit Close Button */}
                <button
                  type="button"
                  onClick={() => setIsRightSheetOpen(false)}
                  className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all cursor-pointer border border-white/5 shrink-0 ml-2"
                  title="Close instructions"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sheet Tabs - Ultra Compact */}
              <div className="px-4 py-1.5 border-b border-white/[0.06] bg-black/40 shrink-0">
                <div className="flex bg-[#070A13] p-0.5 rounded-lg border border-white/5 gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveSheetTab("receive")}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeSheetTab === "receive"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Receive Email Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSheetTab("send")}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeSheetTab === "send"
                        ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send Email Setup
                  </button>
                </div>
              </div>

              {/* Sheet Scrollable Content - Ultra Dense & Minimal Vertical Space */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {/* ========================================================= */}
                {/* TAB 1: RECEIVE EMAIL SETUP (DNS Records + DKIM) */}
                {/* ========================================================= */}
                {activeSheetTab === "receive" ? (
                  <div className="space-y-3 animate-fade-in">
                    {/* Domain DNS Configuration Table Container */}
                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>Domain DNS Configuration</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold uppercase">
                            4 Records
                          </span>
                        </h4>
                        <span className="text-[10px] text-gray-500">Cloudflare, Namecheap, GoDaddy, Hostinger</span>
                      </div>

                      {/* HIGH DENSITY DNS RECORDS TABLE */}
                      <div className="overflow-x-auto border border-white/5 rounded-lg bg-black/40">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              <th className="py-1.5 px-2.5">Type</th>
                              <th className="py-1.5 px-2.5">Host / Name</th>
                              <th className="py-1.5 px-2.5">Value / Points To</th>
                              <th className="py-1.5 px-2.5">Priority</th>
                              <th className="py-1.5 px-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04] font-mono text-[11px]">
                            {/* 1. A Record */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-1.5 px-2.5">
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 font-bold text-[10px]">A</span>
                              </td>
                              <td className="py-1.5 px-2.5 text-white font-bold">mail</td>
                              <td className="py-1.5 px-2.5 text-emerald-400 font-bold">{serverIp}</td>
                              <td className="py-1.5 px-2.5 text-gray-500 text-[10px] font-sans">Required</td>
                              <td className="py-1.5 px-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(serverIp, "a_ip")}
                                  className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 transition-all cursor-pointer inline-flex items-center justify-center border border-white/5"
                                  title="Copy IP"
                                >
                                  {copiedKey === "a_ip" ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* 2. MX Record */}
                            <tr className="hover:bg-white/[0.02] transition-colors bg-emerald-500/[0.02]">
                              <td className="py-1.5 px-2.5">
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px]">MX</span>
                              </td>
                              <td className="py-1.5 px-2.5 text-white font-bold">@</td>
                              <td className="py-1.5 px-2.5 text-white font-bold">mail.{sheetDomain || "yourdomain.com"}</td>
                              <td className="py-1.5 px-2.5 text-emerald-400 text-[10px] font-bold">Priority 10</td>
                              <td className="py-1.5 px-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`mail.${sheetDomain || "yourdomain.com"}`, "mx_val")}
                                  className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 transition-all cursor-pointer inline-flex items-center justify-center border border-white/5"
                                  title="Copy MX value"
                                >
                                  {copiedKey === "mx_val" ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* 3. SPF Record */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-1.5 px-2.5">
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 font-bold text-[10px]">TXT</span>
                              </td>
                              <td className="py-1.5 px-2.5 text-white font-bold">@</td>
                              <td className="py-1.5 px-2.5 text-gray-300 text-[11px] truncate max-w-[220px]">
                                v=spf1 mx a ip4:{serverIp} ~all
                              </td>
                              <td className="py-1.5 px-2.5 text-gray-500 text-[10px] font-sans">SPF</td>
                              <td className="py-1.5 px-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`v=spf1 mx a ip4:${serverIp} ~all`, "spf_val")}
                                  className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 transition-all cursor-pointer inline-flex items-center justify-center border border-white/5"
                                  title="Copy SPF record"
                                >
                                  {copiedKey === "spf_val" ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* 4. DMARC Record */}
                            <tr className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-1.5 px-2.5">
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 font-bold text-[10px]">TXT</span>
                              </td>
                              <td className="py-1.5 px-2.5 text-white font-bold">_dmarc</td>
                              <td className="py-1.5 px-2.5 text-gray-300 text-[11px]">v=DMARC1; p=none;</td>
                              <td className="py-1.5 px-2.5 text-gray-500 text-[10px] font-sans">DMARC</td>
                              <td className="py-1.5 px-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard("v=DMARC1; p=none;", "dmarc_val")}
                                  className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-gray-300 transition-all cursor-pointer inline-flex items-center justify-center border border-white/5"
                                  title="Copy DMARC record"
                                >
                                  {copiedKey === "dmarc_val" ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 5. DKIM (Digital Signature) Generator Box - Ultra Compact */}
                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">5. DKIM (Digital Signature)</h4>
                          <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded font-bold">
                            TXT Record
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDkimConfirmModal(true)}
                          disabled={generatingDkim}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-sm"
                        >
                          {generatingDkim ? (
                            "Generating..."
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              <span>Generate Signature</span>
                            </>
                          )}
                        </button>
                      </div>

                      {loadingDkim ? (
                        <div className="h-16 bg-[#070A13] border border-white/[0.05] rounded-lg flex items-center justify-center text-gray-500 text-xs">
                          Loading DKIM Key...
                        </div>
                      ) : dkimKey ? (
                        <div className="bg-[#070A13] p-2.5 rounded-lg border border-white/[0.05] space-y-2">
                          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1 rounded border border-white/5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-gray-500 uppercase font-bold">Host / Name:</span>
                              <span className="text-emerald-400 font-mono text-[11px] font-bold">default._domainkey</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard("default._domainkey", "dkim_name")}
                              className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-white transition-all cursor-pointer inline-flex items-center justify-center border border-white/5"
                              title="Copy name"
                            >
                              {copiedKey === "dkim_name" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-gray-500 uppercase font-bold">Value (Public Key):</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(dkimKey, "dkim_val")}
                                className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-white/5 transition-all"
                              >
                                {copiedKey === "dkim_val" ? (
                                  <>
                                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>Copy Key</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <textarea
                              readOnly
                              value={dkimKey}
                              className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-emerald-400 font-mono text-[10px] resize-none outline-none break-all focus:border-emerald-500/50 leading-relaxed font-semibold shadow-inner"
                              rows={4}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-amber-400 text-xs">
                          No DKIM signature found. Click the <strong>Generate Signature</strong> button above to create one.
                        </div>
                      )}

                      {/* Multi-domain DKIM Warning - Ultra Compact */}
                      <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg flex items-start gap-2 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-red-400/90 text-[10px] leading-relaxed">
                          <strong>Multiple Domains:</strong> Same public key works across all domains. If you generate a <strong>NEW</strong> signature, you must update the <code>default._domainkey</code> TXT record on <strong>ALL domains</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ========================================================= */
                  /* TAB 2: SEND EMAIL SETUP (Ports + Outbound SMTP Relay)     */
                  /* ========================================================= */
                  <div className="space-y-3 animate-fade-in">
                    {/* Server Port Requirements Card - 2-Column Side-by-Side */}
                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <h4 className="text-xs font-bold text-white">Server Port Requirements</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-[#070A13] p-2.5 rounded-lg border border-white/[0.05] flex items-start gap-2.5">
                          <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-md flex items-center justify-center text-indigo-400 font-bold text-xs shrink-0">
                            25
                          </div>
                          <div>
                            <h5 className="text-white font-bold text-xs">Live Production (Port 25)</h5>
                            <p className="text-gray-400 text-[10px] mt-0.5 leading-relaxed">
                              Standard SMTP port for incoming emails (Gmail, Yahoo, Outlook). VPS provider must have Port 25 unblocked.
                            </p>
                          </div>
                        </div>

                        <div className="bg-[#070A13] p-2.5 rounded-lg border border-white/[0.05] flex items-start gap-2.5">
                          <div className="w-8 h-8 bg-gray-500/10 border border-gray-500/20 rounded-md flex items-center justify-center text-gray-400 font-bold text-xs shrink-0">
                            2525
                          </div>
                          <div>
                            <h5 className="text-white font-bold text-xs">Local Development (Port 2525)</h5>
                            <p className="text-gray-400 text-[10px] mt-0.5 leading-relaxed">
                              Used in local mode (`live=false` in .env) to receive mail without requiring root privileges.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Outbound Email Configuration Card - Compact */}
                    <div className="bg-slate-900/50 border border-white/[0.06] rounded-xl p-3 space-y-2">
                      <h4 className="text-xs font-bold text-white">Outbound Email Configuration</h4>
                      <p className="text-gray-400 text-[10px] leading-relaxed">
                        Sending directly from fresh VPS IPs can trigger spam filters. Use third-party <strong>SMTP Relays</strong> (SendGrid, Mailgun, Amazon SES) for optimal delivery.
                      </p>

                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg">
                        <h5 className="text-emerald-400 font-bold text-[11px] mb-1">Setup Steps:</h5>
                        <ol className="list-decimal list-inside space-y-0.5 text-gray-300 text-[10px] leading-relaxed">
                          <li>Go to <strong>SMTP Relay Credentials</strong> tab from the sidebar.</li>
                          <li>Add the Username and Password provided by your relay service.</li>
                          <li>Ensure DKIM and SPF records are added on your domain.</li>
                          <li>Dispatch emails via our provided REST API endpoints.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sheet Bottom Footer Actions - Ultra Compact */}
              <div className="px-4 py-2.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRightSheetOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 font-bold text-xs transition-all cursor-pointer"
                >
                  Close
                </button>

                {sheetMode === "add" ? (
                  <button
                    type="button"
                    onClick={handleSaveAndAddDomain}
                    disabled={isSubmittingDomain}
                    className="bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-extrabold px-4.5 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingDomain ? (
                      <>
                        <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Done & Save Domain</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRightSheetOpen(false)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4.5 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VERIFICATION RESULT MODAL */}
      {/* ========================================================= */}
      {verificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setVerificationModal(null)}
          ></div>
          <div className="relative bg-[#090C16] border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-lg shadow-2xl animate-scale-in z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    verificationModal.verified
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {verificationModal.verified ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">DNS Verification</h3>
                  <p className="text-xs font-mono text-gray-400">{verificationModal.domain}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerificationModal(null)}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-2.5 bg-black/40 p-4 rounded-2xl border border-white/5 text-xs">
              {/* MX Record */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      verificationModal.results.mx?.valid ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  ></span>
                  <span className="font-semibold text-gray-300">MX Record (Mail Routing)</span>
                </div>
                <span
                  className={`font-bold font-mono text-[11px] ${
                    verificationModal.results.mx?.valid ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {verificationModal.results.mx?.valid ? "Configured ✓" : "Unresolved"}
                </span>
              </div>

              {/* A Record */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      verificationModal.results.a?.valid ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  ></span>
                  <span className="font-semibold text-gray-300">A Record (Host IP)</span>
                </div>
                <span
                  className={`font-bold font-mono text-[11px] ${
                    verificationModal.results.a?.valid ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {verificationModal.results.a?.valid ? "Configured ✓" : "Pending"}
                </span>
              </div>

              {/* SPF Record */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      verificationModal.results.spf?.valid ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  ></span>
                  <span className="font-semibold text-gray-300">SPF TXT Record</span>
                </div>
                <span
                  className={`font-bold font-mono text-[11px] ${
                    verificationModal.results.spf?.valid ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {verificationModal.results.spf?.valid ? "Configured ✓" : "Optional / Pending"}
                </span>
              </div>

              {/* DKIM Record */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      verificationModal.results.dkim?.valid ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  ></span>
                  <span className="font-semibold text-gray-300">DKIM TXT Record</span>
                </div>
                <span
                  className={`font-bold font-mono text-[11px] ${
                    verificationModal.results.dkim?.valid ? "text-emerald-400" : "text-gray-500"
                  }`}
                >
                  {verificationModal.results.dkim?.valid ? "Configured ✓" : "Optional / Pending"}
                </span>
              </div>
            </div>

            {verificationModal.verified ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Domain DNS is resolved and ready to receive incoming emails!</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <p className="font-bold">DNS propagation in progress</p>
                <p className="text-gray-400 text-[11px]">
                  Newly added DNS records may take a few minutes to propagate worldwide. If you are developing locally, you can force-mark this domain active.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVerificationModal(null)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white font-bold text-xs hover:bg-white/5 transition-all cursor-pointer"
              >
                Close
              </button>
              {!verificationModal.verified && (
                <button
                  type="button"
                  onClick={() => handleForceActivate(verificationModal.id)}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Mark as Active
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {showDeleteConfirmModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirmModal(null)}
          ></div>
          <div className="relative bg-[#090C16] border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-sm shadow-2xl animate-scale-in z-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Delete Domain</h3>
              <p className="text-gray-400 text-xs mt-1">
                Are you sure you want to remove this domain from the server? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold text-xs hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDomain}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-extrabold text-xs transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DKIM GENERATE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {showDkimConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowDkimConfirmModal(false)}
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
                type="button"
                onClick={() => setShowDkimConfirmModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerateDkim}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Yes, Generate New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
