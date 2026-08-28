"use client";

import { useState, useEffect } from "react";

interface PrimaryDomainManagerProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
}

interface AttachedDomain {
  id: number;
  domain: string;
  status: string;
  plan?: string;
  catch_all?: number | boolean;
  is_primary?: number | boolean;
  primary_prefix?: string;
  route_to_primary?: number | boolean;
  created_at: string;
}

export default function PrimaryDomainManager({ apiUrl, apiPrefix = "/api/admin", tokenKey = "admin_token" }: PrimaryDomainManagerProps) {
  const [domains, setDomains] = useState<AttachedDomain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [serverIp, setServerIp] = useState<string>(process.env.NEXT_PUBLIC_SERVER_IP || "127.0.0.1");
  const [ipCopied, setIpCopied] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<number | null>(null);

  // Form State: Choose & Create Primary Domain / Mailbox
  const [selectedDomainId, setSelectedDomainId] = useState<number | string>("");
  const [primaryPrefix, setPrimaryPrefix] = useState<string>("my");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Right Sheet / Drawer State for DNS inspection
  const [isRightSheetOpen, setIsRightSheetOpen] = useState<boolean>(false);
  const [sheetDomain, setSheetDomain] = useState<string>("");
  const [activeSheetTab, setActiveSheetTab] = useState<"receive" | "send">("receive");
  const [dkimKey, setDkimKey] = useState<string>("");

  // Settings Sheet / Drawer State for Mailbox Login Credentials
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState<boolean>(false);
  const [settingsDomain, setSettingsDomain] = useState<string>("");
  const [settingsTab, setSettingsTab] = useState<"credentials" | "forwarding">("credentials");
  const [mailboxUserEmail, setMailboxUserEmail] = useState<string>("");
  const [mailboxUserPassword, setMailboxUserPassword] = useState<string>("");
  const [mailboxUserId, setMailboxUserId] = useState<number | null>(null);
  const [mailboxLoading, setMailboxLoading] = useState<boolean>(false);
  const [mailboxSaving, setMailboxSaving] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [defaultProjectId, setDefaultProjectId] = useState<number>(1);

  // Routing Sheet / Drawer State for Multi-Domain Routing to Primary
  const [isRoutingSheetOpen, setIsRoutingSheetOpen] = useState<boolean>(false);
  const [routingSearchQuery, setRoutingSearchQuery] = useState<string>("");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (apiUrl) {
      fetchDomains(true);
      fetchServerInfo();
    }
  }, [apiUrl, apiPrefix, tokenKey]);

  const fetchDomains = async (showLoadingSpinner = false) => {
    if (!apiUrl) return;
    if (showLoadingSpinner) setLoading(true);
    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/domains`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const domainList: AttachedDomain[] = Array.isArray(data) ? data : [];
        setDomains(domainList);

        const currentPrim = domainList.find((d) => d.is_primary === 1 || d.is_primary === true);
        if (currentPrim) {
          setSelectedDomainId(currentPrim.id);
          if (currentPrim.primary_prefix) setPrimaryPrefix(currentPrim.primary_prefix);
        } else if (domainList.length > 0) {
          setSelectedDomainId(domainList[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching domains:", err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const fetchServerInfo = async () => {
    if (!apiUrl) return;
    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/serverinfo`, {
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
      console.error("Error fetching server info:", err);
    }
  };

  // Fetch Credentials for Mailbox
  const fetchMailboxCredentials = async (domain: string, prefix?: string) => {
    const domainObj = domains.find((d) => d.domain === domain);
    const prefixToUse = prefix || domainObj?.primary_prefix || primaryPrefix || "admin";
    const defaultEmail = `${prefixToUse.trim().toLowerCase()}@${domain}`;

    setSettingsDomain(domain);
    setMailboxLoading(true);

    try {
      const token = localStorage.getItem(tokenKey) || "";

      // 1. Fetch projects to get a valid default project_id
      const projRes = await fetch(`${apiUrl}${apiPrefix}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (projRes.ok) {
        const projData = await projRes.json();
        if (Array.isArray(projData) && projData.length > 0) {
          setDefaultProjectId(projData[0].id);
        }
      }

      // 2. Fetch existing mailbox users
      const usersRes = await fetch(`${apiUrl}${apiPrefix}/mailbox-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (Array.isArray(usersData)) {
          const matchedUser =
            usersData.find((u: any) => u.email?.toLowerCase() === defaultEmail.toLowerCase()) ||
            usersData.find((u: any) => u.email?.toLowerCase().endsWith(`@${domain.toLowerCase()}`));
          if (matchedUser) {
            setMailboxUserId(matchedUser.id);
            setMailboxUserEmail(matchedUser.email);
            setMailboxUserPassword(matchedUser.plain_password || "");
          } else {
            setMailboxUserEmail(defaultEmail);
            handleGeneratePassword();
          }
        }
      }
    } catch (err) {
      console.error("Error loading mailbox credentials:", err);
    } finally {
      setMailboxLoading(false);
    }
  };

  // Open Settings Sheet & Fetch Credentials for Primary Mailbox
  const handleOpenSettingsSheet = async (domain: string) => {
    setSettingsDomain(domain);
    setShowPassword(false);
    setIsSettingsSheetOpen(true);
    await fetchMailboxCredentials(domain);
  };

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMailboxUserPassword(pwd);
  };

  const handleSaveMailboxCredentials = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mailboxUserEmail || !mailboxUserPassword) {
      showToast("Email and password are required", "error");
      return;
    }

    setMailboxSaving(true);
    try {
      const token = localStorage.getItem(tokenKey) || "";
      let res;
      if (mailboxUserId) {
        // Update existing user email & password
        res = await fetch(`${apiUrl}${apiPrefix}/mailbox-users/${mailboxUserId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: mailboxUserEmail,
            password: mailboxUserPassword,
            project_id: defaultProjectId
          })
        });
      } else {
        // Create new mailbox user
        res = await fetch(`${apiUrl}${apiPrefix}/mailbox-users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            email: mailboxUserEmail,
            password: mailboxUserPassword,
            project_id: defaultProjectId
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (data.id) setMailboxUserId(data.id);

        const emailParts = mailboxUserEmail.split("@");
        const newPrefix = emailParts[0]?.trim().toLowerCase();
        const emailDomain = emailParts[1]?.trim().toLowerCase();

        if (newPrefix && emailDomain) {
          setPrimaryPrefix(newPrefix);
          setDomains((prev) =>
            prev.map((d) =>
              d.domain.toLowerCase() === emailDomain.toLowerCase() && (d.is_primary === 1 || d.is_primary === true)
                ? { ...d, primary_prefix: newPrefix }
                : d
            )
          );
        }

        showToast("Mailbox login credentials saved successfully! IMAP & POP3 updated.", "success");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save mailbox credentials", "error");
    } finally {
      setMailboxSaving(false);
    }
  };

  // Set / Create Primary Domain Handler
  const handleSavePrimaryDomain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedDomainId) {
      showToast("Please choose a domain from the dropdown", "error");
      return;
    }

    const id = Number(selectedDomainId);
    const target = domains.find((d) => d.id === id);
    const cleanPrefix = (primaryPrefix || "my").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

    setIsSubmitting(true);
    const previousDomains = [...domains];

    // Optimistic UI state update
    setDomains((prev) =>
      prev.map((d) => ({
        ...d,
        is_primary: d.id === id ? 1 : 0,
        primary_prefix: d.id === id ? cleanPrefix : d.primary_prefix
      }))
    );

    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/domains/${id}/primary`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prefix: cleanPrefix })
      });

      if (res.ok) {
        showToast(`Primary Domain set to "${target?.domain}" with mailbox "${cleanPrefix}@${target?.domain}"!`, "success");
        if (target?.domain) {
          fetchMailboxCredentials(target.domain, cleanPrefix);
        }
      } else {
        setDomains(previousDomains);
        const data = await res.json();
        showToast(data.error || "Failed to set Primary Domain", "error");
      }
    } catch (err: any) {
      setDomains(previousDomains);
      showToast("Network error setting Primary Domain", "error");
    } finally {
      setIsSubmitting(false);
    }
  };



  // Delete Domain Handler
  const handleDeleteDomain = async () => {
    if (showDeleteConfirmModal === null) return;
    const id = showDeleteConfirmModal;
    const targetDomain = domains.find((d) => d.id === id);
    const wasPrimary = targetDomain?.is_primary === 1 || targetDomain?.is_primary === true;

    setDomains((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (wasPrimary && remaining.length > 0) {
        remaining[0].is_primary = 1;
      }
      return remaining;
    });
    setShowDeleteConfirmModal(null);

    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/domains/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        showToast(`Domain "${targetDomain?.domain}" deleted successfully.`, "success");
      } else {
        if (targetDomain) setDomains((prev) => [targetDomain, ...prev]);
        const data = await res.json();
        showToast(data.error || "Failed to delete domain", "error");
      }
    } catch (err) {
      if (targetDomain) setDomains((prev) => [targetDomain, ...prev]);
      showToast("Network error deleting domain", "error");
    }
  };

  // Toggle individual domain routing to primary
  const handleToggleDomainRouting = async (domainId: number, currentRouting: number | boolean | undefined) => {
    const isCurrentlyOn = currentRouting === 1 || currentRouting === true;
    const newRouting = isCurrentlyOn ? 0 : 1;
    const targetDomain = domains.find((d) => d.id === domainId);

    // Optimistic UI update
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, route_to_primary: newRouting } : d))
    );

    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/domains/${domainId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ route_to_primary: newRouting })
      });

      if (res.ok) {
        showToast(
          newRouting === 1
            ? `"${targetDomain?.domain}" linked to Primary Mailbox! All emails will be routed.`
            : `"${targetDomain?.domain}" unlinked from Primary Mailbox.`,
          "success"
        );
      } else {
        setDomains((prev) =>
          prev.map((d) => (d.id === domainId ? { ...d, route_to_primary: isCurrentlyOn ? 1 : 0 } : d))
        );
        showToast("Failed to update domain routing", "error");
      }
    } catch (err) {
      setDomains((prev) =>
        prev.map((d) => (d.id === domainId ? { ...d, route_to_primary: isCurrentlyOn ? 1 : 0 } : d))
      );
      showToast("Network error updating domain routing", "error");
    }
  };

  // Bulk toggle all domains routing to primary
  const handleBulkToggleRouting = async (routeAll: boolean) => {
    const targetFlag = routeAll ? 1 : 0;
    const previousDomains = [...domains];

    // Optimistic UI update
    setDomains((prev) => prev.map((d) => ({ ...d, route_to_primary: targetFlag })));

    try {
      const token = localStorage.getItem(tokenKey) || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/domains/bulk-routing`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ route_to_primary: targetFlag })
      });

      if (res.ok) {
        showToast(
          routeAll
            ? "All domains successfully linked to Primary Mailbox!"
            : "All secondary domains unlinked from Primary Mailbox.",
          "success"
        );
      } else {
        setDomains(previousDomains);
        showToast("Failed to bulk update domain routing", "error");
      }
    } catch (err) {
      setDomains(previousDomains);
      showToast("Network error during bulk routing update", "error");
    }
  };

  const handleOpenDnsSheet = (domainName: string) => {
    setSheetDomain(domainName);
    setActiveSheetTab("receive");
    setIsRightSheetOpen(true);
  };

  const primaryDomain = domains.find((d) => d.is_primary === 1 || d.is_primary === true) || null;

  const selectedDomainObj = domains.find((d) => String(d.id) === String(selectedDomainId)) || primaryDomain;
  const targetDeleteDomain = domains.find((d) => d.id === showDeleteConfirmModal);

  const activePrefix = primaryDomain?.primary_prefix || "my";
  const activeFullEmail = primaryDomain ? `${activePrefix}@${primaryDomain.domain}` : "my@yourdomain.com";
  const currentHost = settingsDomain || primaryDomain?.domain || "mailserver10.com";

  return (
    <div className="flex flex-col gap-8 animate-fade-in w-full max-w-7xl mx-auto pb-24">
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

      {/* Header Section (Clean Card-Free Title) */}
      <div className="flex flex-col gap-2 pt-1 pb-2">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 shrink-0">
            <span className="text-xl">⭐</span>
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Primary Domain & Mailbox</h1>
            <p className="text-gray-400 text-xs sm:text-sm font-medium mt-0.5">
              Choose a domain from your attached list, customize the primary mailbox address, and route all incoming emails to one central node.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: CHOOSE & CREATE PRIMARY DOMAIN FORM            */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-b from-[#090e1d] to-[#040711] border border-amber-500/25 rounded-3xl p-5 lg:p-7 shadow-[0_15px_50px_rgba(0,0,0,0.75)] relative overflow-hidden">
        {/* Top ambient highlight laser line */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-90"></div>
        <div className="absolute -top-24 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <form onSubmit={handleSavePrimaryDomain} className="flex flex-col lg:flex-row items-stretch lg:items-end gap-4 relative z-10">
          
          {/* 1. Mailbox Prefix Input */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <span>✉️</span>
                <span>Mailbox Username</span>
              </label>
              <span className="text-[10px] font-mono text-gray-500">MIME Root</span>
            </div>
            <div className="relative flex items-center bg-[#02050c] border border-white/10 hover:border-amber-500/40 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl px-4 py-1 transition-all shadow-inner">
              <span className="text-gray-500 font-mono text-xs mr-2 font-bold select-none">prefix:</span>
              <input
                type="text"
                value={primaryPrefix}
                onChange={(e) => setPrimaryPrefix(e.target.value)}
                placeholder="my"
                className="w-full bg-transparent py-2.5 text-sm text-amber-300 font-mono font-bold placeholder-gray-600 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Glowing Center @ Connector Socket */}
          <div className="hidden lg:flex items-center justify-center pb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-950/40 border border-amber-500/40 flex items-center justify-center text-amber-300 font-mono font-black text-sm shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0">
              @
            </div>
          </div>

          {/* 2. Choose Domain Dropdown */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <span>🌐</span>
                <span>Attached Domain</span>
              </label>
              <span className="text-[10px] font-mono text-gray-500">{domains.length} connected</span>
            </div>
            <div className="relative flex items-center bg-[#02050c] border border-white/10 hover:border-amber-500/40 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl transition-all shadow-inner">
              <select
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
                className="w-full bg-transparent py-3.5 px-4 text-sm text-white font-mono font-bold focus:outline-none cursor-pointer appearance-none pr-10"
                required
              >
                {domains.length === 0 ? (
                  <option value="">No domains attached</option>
                ) : (
                  domains.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-950 text-white font-mono py-2">
                      {d.domain} {d.is_primary === 1 || d.is_primary === true ? "★ (Primary)" : ""}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute right-4 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 3. Sleek Thin Outlined Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || domains.length === 0}
            className="px-6 py-3.5 rounded-2xl border border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 active:scale-98 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap self-stretch lg:self-end disabled:opacity-50"
          >
            <span className="text-sm">⭐</span>
            <span>Set Primary Domain</span>
          </button>
        </form>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: PRIMARY DOMAIN SUMMARY TABLE                   */}
      {/* ========================================================= */}
      <div className="bg-[#090C16] border border-white/[0.08] rounded-[10px] overflow-hidden flex flex-col">
        
        {/* Table Card Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-sm">⭐</span>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Primary Domains
            </h3>
          </div>

          <span className="px-2.5 py-0.5 rounded-[6px] text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Active Records
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
            <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-400 rounded-full animate-spin"></div>
            <span className="text-xs font-medium">Loading primary domain info...</span>
          </div>
        ) : !primaryDomain ? (
          <div className="py-14 text-center text-gray-500 text-xs font-mono">
            No primary domain designated yet. Select one from the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-black/40 text-gray-400 text-xs font-bold">
                  <th className="py-3 px-5">Domain</th>
                  <th className="py-3 px-5">Routing Mode</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  
                  {/* Domain Name Cell */}
                  <td className="py-3.5 px-5">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-white text-sm">
                        {primaryDomain.domain}
                      </span>
                      <span className="text-gray-400 text-xs font-mono mt-0.5">
                        {activeFullEmail}
                      </span>
                    </div>
                  </td>

                  {/* Routing Mode Cell */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                      <span>Catch-All Active</span>
                    </div>
                  </td>

                  {/* Live Status Cell */}
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                      </span>
                      <span>Live & Receiving</span>
                    </div>
                  </td>

                  {/* Action Buttons Cell */}
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      
                      {/* Routes / Linked Domains Drawer Trigger Button */}
                      <button
                        onClick={() => setIsRoutingSheetOpen(true)}
                        className="px-3 py-1.5 rounded-[8px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm shadow-emerald-500/10"
                        title="Configure Domain Routing & Catch-All Links in Right Drawer"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>Routes</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {domains.filter(d => d.route_to_primary === 1 || d.route_to_primary === true || d.route_to_primary === undefined || d.is_primary === 1 || d.is_primary === true).length}
                        </span>
                      </button>

                      {/* Settings Button */}
                      <button
                        onClick={() => handleOpenSettingsSheet(primaryDomain.domain)}
                        className="px-3 py-1.5 rounded-[8px] bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                        title="Configure Primary Mailbox Login & Password"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Settings</span>
                      </button>

                      {/* Mailbox UI Button */}
                      <a
                        href="/mailbox"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-[8px] border border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                      >
                        <span>Mailbox UI</span>
                        <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>

                      {/* Delete Button */}
                      <button
                        onClick={() => setShowDeleteConfirmModal(primaryDomain.id)}
                        className="p-1.5 rounded-[8px] bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 text-xs transition-all cursor-pointer flex items-center justify-center active:scale-95"
                        title="Delete Domain"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>

                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: UNIFIED HOLOGRAPHIC ROUTING MATRIX CANVAS       */}
      {/* ========================================================= */}
      <div className="pt-16 pb-10 relative">
        {/* Sleek Half Horizontal Gradient Divider Line */}
        <div className="w-full flex items-center justify-center mb-14">
          <div className="w-1/2 max-w-2xl h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>

        <div className="bg-[#030611] rounded-3xl p-5 lg:p-8 relative overflow-hidden">
          {/* Holographic background cyber meshes & ambient lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none"></div>
          <div className="absolute -top-24 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col gap-5 relative z-10">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm sm:text-base font-extrabold text-white uppercase tracking-wider">
                  Forwarding Emails
                </h3>
                <span className="text-[11px] text-gray-400">
                  All incoming emails from all domains (including simple text and attachments) are automatically forwarded to the primary domain.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-inner">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Primary Domains
              </span>
            </div>
          </div>

          {/* Unified High-Precision SVG Diagram (100% Aligned & Locked) */}
          <div className="w-full overflow-x-auto py-2">
            <svg
              className="w-full min-w-[900px] h-[370px] select-none"
              viewBox="0 0 1100 360"
              fill="none"
            >
              <defs>
                {/* Glow Filter */}
                <filter id="matrixGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Laser Linear Gradients */}
                <linearGradient id="laserGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.95" />
                </linearGradient>

                <linearGradient id="laserGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
                </linearGradient>

                {/* Card Background Gradients */}
                <linearGradient id="cardGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0b1329" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#070d1c" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="cardGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#081b29" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#06121c" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="cardGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#101129" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0a0a1c" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="cardGrad4" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1a0b29" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0f071c" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="coreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#064e3b" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#022c22" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="goldChamberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2e1a05" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#120c04" stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* ========================================================= */}
              {/* CONNECTING BEZIER WIRES (Starting EXACTLY at Node Sockets) */}
              {/* ========================================================= */}
              <path d="M 280 50 C 400 50, 440 170, 520 170" stroke="url(#laserGradLeft)" strokeWidth="2.5" filter="url(#matrixGlow)" opacity="0.8" />
              <path d="M 280 50 C 400 50, 440 170, 520 170" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              <path d="M 280 130 C 400 130, 440 170, 520 170" stroke="url(#laserGradLeft)" strokeWidth="2.5" filter="url(#matrixGlow)" opacity="0.8" />
              <path d="M 280 130 C 400 130, 440 170, 520 170" stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              <path d="M 280 210 C 400 210, 440 170, 520 170" stroke="url(#laserGradLeft)" strokeWidth="2.5" filter="url(#matrixGlow)" opacity="0.8" />
              <path d="M 280 210 C 400 210, 440 170, 520 170" stroke="#818cf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              <path d="M 280 290 C 400 290, 440 170, 520 170" stroke="url(#laserGradLeft)" strokeWidth="2.5" filter="url(#matrixGlow)" opacity="0.8" />
              <path d="M 280 290 C 400 290, 440 170, 520 170" stroke="#c084fc" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

              {/* Animated Light Packets */}
              <circle r="4.5" fill="#60a5fa" filter="url(#matrixGlow)">
                <animateMotion dur="2.2s" repeatCount="indefinite" path="M 280 50 C 400 50, 440 170, 520 170" />
              </circle>
              <circle r="4.5" fill="#22d3ee" filter="url(#matrixGlow)">
                <animateMotion dur="1.8s" repeatCount="indefinite" path="M 280 130 C 400 130, 440 170, 520 170" />
              </circle>
              <circle r="4.5" fill="#818cf8" filter="url(#matrixGlow)">
                <animateMotion dur="2.4s" repeatCount="indefinite" path="M 280 210 C 400 210, 440 170, 520 170" />
              </circle>
              <circle r="4.5" fill="#c084fc" filter="url(#matrixGlow)">
                <animateMotion dur="1.6s" repeatCount="indefinite" path="M 280 290 C 400 290, 440 170, 520 170" />
              </circle>

              {/* Floating Animated Badges (Text, PDF, Images, Catch-all) */}
              <text fontSize="13" fill="#93c5fd" opacity="0.95">
                ✉️
                <animateMotion dur="2.8s" repeatCount="indefinite" path="M 280 50 C 400 50, 440 170, 520 170" />
              </text>
              <text fontSize="13" fill="#67e8f9" opacity="0.95">
                📎
                <animateMotion dur="2.4s" repeatCount="indefinite" path="M 280 130 C 400 130, 440 170, 520 170" />
              </text>
              <text fontSize="13" fill="#a5b4fc" opacity="0.95">
                📁
                <animateMotion dur="3s" repeatCount="indefinite" path="M 280 210 C 400 210, 440 170, 520 170" />
              </text>
              <text fontSize="13" fill="#e9d5ff" opacity="0.95">
                ★
                <animateMotion dur="2.2s" repeatCount="indefinite" path="M 280 290 C 400 290, 440 170, 520 170" />
              </text>

              {/* Output High-Throughput Pipeline */}
              <path d="M 578 170 L 760 170" stroke="url(#laserGradRight)" strokeWidth="4.5" filter="url(#matrixGlow)" />
              <path d="M 578 170 L 760 170" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.9" />

              {/* Fast Streaming Energy Pulses into Primary Destination */}
              <circle r="5.5" fill="#fde047" filter="url(#matrixGlow)">
                <animateMotion dur="1.1s" repeatCount="indefinite" path="M 578 170 L 760 170" />
              </circle>
              <circle r="4.5" fill="#f59e0b" filter="url(#matrixGlow)">
                <animateMotion dur="1.1s" begin="0.55s" repeatCount="indefinite" path="M 578 170 L 760 170" />
              </circle>

              {/* Floating Stream of Both Text Mails & Attachments arriving into Primary Mailbox */}
              <text fontSize="14" fill="#fde047" opacity="0.95">
                ✉️
                <animateMotion dur="1.6s" repeatCount="indefinite" path="M 578 170 L 760 170" />
              </text>
              <text fontSize="14" fill="#f59e0b" opacity="0.95">
                📎
                <animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path="M 578 170 L 760 170" />
              </text>

              {/* ========================================================= */}
              {/* TIER 1: LEFT INBOUND DOMAIN NODES (Exactly Bound to Wires) */}
              {/* ========================================================= */}

              {/* Node 1: Domain 1 */}
              <g>
                <rect x="25" y="24" width="255" height="52" rx="14" fill="url(#cardGrad1)" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" />
                <circle cx="52" cy="50" r="14" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.5" />
                <text x="52" y="54" textAnchor="middle" fill="#bfdbfe" fontSize="11" fontWeight="bold" fontFamily="monospace">01</text>
                <text x="75" y="44" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">*@domain1.com</text>
                <rect x="180" y="32" width="60" height="16" rx="4" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6" />
                <text x="210" y="44" textAnchor="middle" fill="#93c5fd" fontSize="9" fontWeight="bold" fontFamily="monospace">✉️ Text</text>
                <text x="75" y="63" fill="#64748b" fontSize="10" fontFamily="sans-serif">Domain 1 · Standard Inbound</text>
                {/* Right Socket Port */}
                <circle cx="280" cy="50" r="5.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" filter="url(#matrixGlow)" />
              </g>

              {/* Node 2: Domain 2 */}
              <g>
                <rect x="25" y="104" width="255" height="52" rx="14" fill="url(#cardGrad2)" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.4" />
                <circle cx="52" cy="130" r="14" fill="#164e63" stroke="#22d3ee" strokeWidth="1.5" />
                <text x="52" y="134" textAnchor="middle" fill="#a5f3fc" fontSize="11" fontWeight="bold" fontFamily="monospace">02</text>
                <text x="75" y="124" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">*@domain2.com</text>
                <rect x="175" y="112" width="85" height="16" rx="4" fill="#164e63" stroke="#06b6d4" strokeWidth="0.8" strokeOpacity="0.6" />
                <text x="217" y="124" textAnchor="middle" fill="#67e8f9" fontSize="9" fontWeight="bold" fontFamily="monospace">📎 Attachments</text>
                <text x="75" y="143" fill="#64748b" fontSize="10" fontFamily="sans-serif">Domain 2 · PDF & Invoices</text>
                {/* Right Socket Port */}
                <circle cx="280" cy="130" r="5.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" filter="url(#matrixGlow)" />
              </g>

              {/* Node 3: Domain 3 */}
              <g>
                <rect x="25" y="184" width="255" height="52" rx="14" fill="url(#cardGrad3)" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.4" />
                <circle cx="52" cy="210" r="14" fill="#312e81" stroke="#818cf8" strokeWidth="1.5" />
                <text x="52" y="214" textAnchor="middle" fill="#c7d2fe" fontSize="11" fontWeight="bold" fontFamily="monospace">03</text>
                <text x="75" y="204" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">*@domain3.com</text>
                <rect x="175" y="192" width="85" height="16" rx="4" fill="#312e81" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.6" />
                <text x="217" y="204" textAnchor="middle" fill="#a5b4fc" fontSize="9" fontWeight="bold" fontFamily="monospace">📁 Media Files</text>
                <text x="75" y="223" fill="#64748b" fontSize="10" fontFamily="sans-serif">Domain 3 · Images & ZIP</text>
                {/* Right Socket Port */}
                <circle cx="280" cy="210" r="5.5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" filter="url(#matrixGlow)" />
              </g>

              {/* Node 4: All Attached Domains (Catch-All) */}
              <g>
                <rect x="25" y="264" width="255" height="52" rx="14" fill="url(#cardGrad4)" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.4" />
                <circle cx="52" cy="290" r="14" fill="#581c87" stroke="#c084fc" strokeWidth="1.5" />
                <text x="52" y="294" textAnchor="middle" fill="#f3e8ff" fontSize="13" fontWeight="bold">★</text>
                <text x="75" y="284" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">*@all-domains.com</text>
                <rect x="180" y="272" width="70" height="16" rx="4" fill="#581c87" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.6" />
                <text x="215" y="284" textAnchor="middle" fill="#d8b4fe" fontSize="9" fontWeight="bold" fontFamily="monospace">✉️+📎 All</text>
                <text x="75" y="303" fill="#64748b" fontSize="10" fontFamily="sans-serif">Catch-All · Multi-Domain Stream</text>
                {/* Right Socket Port */}
                <circle cx="280" cy="290" r="5.5" fill="#a855f7" stroke="#ffffff" strokeWidth="2" filter="url(#matrixGlow)" />
              </g>

              {/* ========================================================= */}
              {/* TIER 2: CENTRAL CONVERGENCE NEXUS CORE                    */}
              {/* ========================================================= */}
              <g transform="translate(540, 170)">
                {/* Outer Rotating Dashed Radar Ring */}
                <circle cx="0" cy="0" r="48" stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 6" fill="none" opacity="0.6" />
                
                {/* Main Futuristic Hub Orb */}
                <circle cx="0" cy="0" r="38" fill="url(#coreGradient)" stroke="#34d399" strokeWidth="2" filter="url(#matrixGlow)" />
                <text x="0" y="9" textAnchor="middle" fontSize="26" fill="#6ee7b7">⚡</text>

                {/* Left & Right Socket Port Nodes */}
                <circle cx="-38" cy="0" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx="38" cy="0" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />

                {/* Core Title & Capabilities */}
                <text x="0" y="65" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="extrabold" letterSpacing="0.5">
                  Central Convergence Core
                </text>
                <text x="0" y="82" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="monospace">
                  Aggregates Plain Text + Binary Attachments
                </text>

                {/* Stream Telemetry Badges */}
                <rect x="-95" y="92" width="90" height="20" rx="6" fill="#064e3b" stroke="#059669" strokeWidth="1" />
                <text x="-50" y="106" textAnchor="middle" fill="#a7f3d0" fontSize="9.5" fontWeight="bold" fontFamily="monospace">✉️ Plain MIME</text>

                <rect x="5" y="92" width="90" height="20" rx="6" fill="#78350f" stroke="#d97706" strokeWidth="1" />
                <text x="50" y="106" textAnchor="middle" fill="#fde68a" fontSize="9.5" fontWeight="bold" fontFamily="monospace">📎 0-Loss Files</text>
              </g>

              {/* ========================================================= */}
              {/* TIER 3: PRIMARY DOMAINS DESTINATION TERMINAL             */}
              {/* ========================================================= */}
              <g transform="translate(760, 95)">
                {/* Destination Chamber Card */}
                <rect x="0" y="0" width="315" height="150" rx="20" fill="url(#goldChamberGrad)" stroke="#f59e0b" strokeWidth="1.8" filter="url(#matrixGlow)" />
                
                {/* Left Incoming Socket Port */}
                <circle cx="0" cy="75" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />

                {/* Golden Star Icon Orb */}
                <circle cx="40" cy="48" r="18" fill="#78350f" stroke="#fbbf24" strokeWidth="1.5" />
                <text x="40" y="55" textAnchor="middle" fontSize="16">⭐</text>

                {/* Primary Domains Title */}
                <text x="68" y="44" fill="#fbbf24" fontSize="16" fontWeight="extrabold" letterSpacing="0.5">
                  Primary Domains
                </text>
                <rect x="225" y="31" width="75" height="16" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="0.8" />
                <text x="262" y="43" textAnchor="middle" fill="#6ee7b7" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                  ALL MAILS
                </text>

                <text x="68" y="66" fill="#94a3b8" fontSize="10.5" fontFamily="sans-serif">
                  Receives all simple emails + attachments
                </text>

                {/* Action Link: Open Primary Mailbox Inbox */}
                <foreignObject x="68" y="86" width="220" height="42">
                  <a
                    href="/mailbox"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-98 text-slate-950 text-xs font-extrabold transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Open Mailbox Inbox</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </foreignObject>
              </g>

            </svg>
          </div>
        </div>
      </div>
    </div>

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL                                 */}
      {/* ========================================================= */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirmModal(null)}
          ></div>
          <div className="relative bg-[#090C16] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 flex flex-col gap-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Domain?</h3>
              <p className="text-gray-400 text-xs mt-1">
                Are you sure you want to remove <strong className="text-white font-mono">{targetDeleteDomain?.domain}</strong>?
                {targetDeleteDomain?.is_primary === 1 && (
                  <span className="block text-amber-400 mt-1">
                    ⚠️ Note: This is your currently active primary domain. Removing it will automatically assign the next available domain as primary.
                  </span>
                )}
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
      {/* RIGHT SHEET (DRAWER) FOR DNS CONFIGURATION                */}
      {/* ========================================================= */}
      {isRightSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"></div>

          <div className="fixed inset-y-0 right-0 max-w-3xl w-full flex pl-4 sm:pl-8 z-50">
            <div className="w-full bg-[#090C16] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden">
              {/* Sheet Header */}
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                  <h3 className="text-sm font-extrabold text-white tracking-tight">DNS Setup Instructions</h3>
                  <span className="text-gray-600 font-normal">·</span>
                  <span className="text-[11px] text-gray-400">Domain:</span>
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {sheetDomain || "yourdomain.com"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRightSheetOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/10"
                  title="Close Drawer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sub-Tabs: Receiving vs Sending DNS */}
              <div className="flex border-b border-white/[0.06] bg-black/40 px-4 shrink-0">
                <button
                  onClick={() => setActiveSheetTab("receive")}
                  className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSheetTab === "receive"
                      ? "border-emerald-400 text-emerald-400"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>📥 Receiving Setup (Required for Mailbox)</span>
                </button>
                <button
                  onClick={() => setActiveSheetTab("send")}
                  className={`py-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSheetTab === "send"
                      ? "border-emerald-400 text-emerald-400"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>📤 Sending Setup (DKIM & SPF)</span>
                </button>
              </div>

              {/* Sheet Content Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-grow">
                {activeSheetTab === "receive" ? (
                  <>
                    {/* Record 1: MX Record */}
                    <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">MX</span>
                          Mail Exchange Record
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">Priority: 10</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Host / Name</span>
                            <span className="font-mono text-gray-200 font-semibold">@ (or {sheetDomain})</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard("@", "mx_host")}
                            className="text-gray-400 hover:text-emerald-400 p-1 cursor-pointer"
                          >
                            {copiedKey === "mx_host" ? (
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
                        <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Points to (Value)</span>
                            <span className="font-mono text-emerald-400 font-semibold">mail.{sheetDomain}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(`mail.${sheetDomain}`, "mx_val")}
                            className="text-gray-400 hover:text-emerald-400 p-1 cursor-pointer"
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
                        </div>
                      </div>
                    </div>

                    {/* Record 2: A Record */}
                    <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">A</span>
                          Mail Host Address Record
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Host / Name</span>
                            <span className="font-mono text-gray-200 font-semibold">mail</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard("mail", "a_host")}
                            className="text-gray-400 hover:text-emerald-400 p-1 cursor-pointer"
                          >
                            {copiedKey === "a_host" ? (
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
                        <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Points to (Server IP)</span>
                            <span className="font-mono text-emerald-400 font-semibold">{serverIp}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(serverIp, "a_val")}
                            className="text-gray-400 hover:text-emerald-400 p-1 cursor-pointer"
                          >
                            {copiedKey === "a_val" ? (
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
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* SPF Record */}
                    <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px]">TXT</span>
                        Sender Policy Framework (SPF)
                      </span>
                      <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
                        <span className="font-mono text-xs text-gray-300">v=spf1 ip4:{serverIp} ~all</span>
                        <button
                          onClick={() => copyToClipboard(`v=spf1 ip4:${serverIp} ~all`, "spf_val")}
                          className="text-gray-400 hover:text-emerald-400 p-1 cursor-pointer"
                        >
                          {copiedKey === "spf_val" ? (
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* DKIM Record */}
                    <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-3 flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px]">TXT</span>
                        DomainKeys Identified Mail (DKIM)
                      </span>
                      <div className="bg-black/50 p-2.5 rounded-lg border border-white/5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1.5">
                            Host: <code className="text-emerald-400 font-mono text-[11px] font-bold">default._domainkey</code>
                            <button
                              onClick={() => copyToClipboard("default._domainkey", "dkim_host")}
                              className="text-gray-400 hover:text-emerald-400 text-xs font-bold cursor-pointer"
                              title="Copy Host Name"
                            >
                              {copiedKey === "dkim_host" ? (
                                <span className="text-emerald-400 text-[10px]">Copied</span>
                              ) : (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </span>
                          <button
                            onClick={() => copyToClipboard(dkimKey ? `v=DKIM1; k=rsa; p=${dkimKey}` : "v=DKIM1; k=rsa; p=...", "dkim_val")}
                            className="text-gray-400 hover:text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === "dkim_val" ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                Copied
                              </span>
                            ) : (
                              <span>Copy Value</span>
                            )}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          rows={4}
                          value={dkimKey ? `v=DKIM1; k=rsa; p=${dkimKey}` : "Generate DKIM key in Domains tab to view public signature..."}
                          className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-[11px] text-emerald-400 focus:outline-none resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sheet Footer */}
              <div className="p-3 bg-black/60 border-t border-white/[0.08] flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRightSheetOpen(false)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RIGHT SHEET (DRAWER) FOR MAILBOX LOGIN CREDENTIALS        */}
      {/* ========================================================= */}
      {isSettingsSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsSettingsSheetOpen(false)}
          ></div>

          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex pl-3 sm:pl-6 z-50">
            <div className="w-full bg-[#000000] sm:bg-[#121214] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden">
              
              {/* iOS Navigation Bar */}
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-[#1C1C1E]/80 backdrop-blur-md shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className="text-xs font-medium text-[#0A84FF] hover:text-[#409CFF] cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex flex-col items-center">
                  <h3 className="text-xs font-semibold text-white">Mailbox Login</h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">{mailboxUserEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className="text-xs font-semibold text-[#0A84FF] hover:text-[#409CFF] cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* iOS Segmented Control */}
              <div className="px-3.5 pt-2.5 pb-1 shrink-0">
                <div className="bg-[#1C1C1E] p-0.5 rounded-lg border border-white/[0.08] flex items-center">
                  <button
                    type="button"
                    onClick={() => setSettingsTab("credentials")}
                    className={`flex-1 py-1 px-2 text-center text-xs font-medium rounded-md transition-all cursor-pointer ${
                      settingsTab === "credentials"
                        ? "bg-[#636366]/40 text-white shadow-sm font-semibold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Mailbox Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsTab("forwarding")}
                    className={`flex-1 py-1 px-2 text-center text-xs font-medium rounded-md transition-all cursor-pointer ${
                      settingsTab === "forwarding"
                        ? "bg-[#636366]/40 text-white shadow-sm font-semibold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Server Settings (IMAP/POP)
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-3.5 overflow-y-auto space-y-3 flex-grow">
                {mailboxLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                    <div className="w-5 h-5 border-2 border-[#0A84FF] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-medium">Loading...</span>
                  </div>
                ) : settingsTab === "credentials" ? (
                  <form onSubmit={handleSaveMailboxCredentials} className="flex flex-col gap-3">
                    
                    {/* iOS Grouped Card: Mailbox Login */}
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 block">
                        Mailbox Login
                      </span>
                      <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
                        
                        {/* Email Row */}
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Email</span>
                          <input
                            type="text"
                            value={mailboxUserEmail}
                            onChange={(e) => setMailboxUserEmail(e.target.value)}
                            placeholder="admin@domain.com"
                            className="bg-transparent text-xs text-white font-mono font-medium focus:outline-none flex-1 text-right pr-2"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserEmail, "sheet_email")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Email"
                          >
                            {copiedKey === "sheet_email" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Password Row */}
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Password</span>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={mailboxUserPassword}
                            onChange={(e) => setMailboxUserPassword(e.target.value)}
                            placeholder="Password"
                            className="bg-transparent text-xs text-amber-300 font-mono font-medium focus:outline-none flex-1 text-right pr-2"
                            required
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                              title={showPassword ? "Hide" : "Show"}
                            >
                              {showPassword ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleGeneratePassword}
                              className="text-[10px] text-[#0A84FF] hover:text-[#409CFF] font-semibold px-1 cursor-pointer"
                              title="Generate random password"
                            >
                              🎲
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(mailboxUserPassword, "sheet_pwd")}
                              className="text-gray-400 hover:text-amber-400 p-0.5 cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedKey === "sheet_pwd" ? (
                                <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* iOS Action Button */}
                    <button
                      type="submit"
                      disabled={mailboxSaving}
                      className="w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] text-white font-semibold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 shadow-sm"
                    >
                      {mailboxSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Account Changes</span>
                      )}
                    </button>

                    {/* iOS Grouped Link: Webmail */}
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 block">
                        Webmail
                      </span>
                      <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] overflow-hidden">
                        <a
                          href="/mailbox"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.04] transition-colors"
                        >
                          <span className="text-xs font-medium text-white">Open Webmail Inbox</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1 font-mono">
                            <span>/mailbox</span>
                            <span className="text-gray-500 font-sans text-sm">›</span>
                          </span>
                        </a>
                      </div>
                    </div>

                  </form>
                ) : (
                  /* TAB 2: IOS GROUPED SERVER SETTINGS */
                  <div className="flex flex-col gap-3">
                    
                    {/* iOS Group 1: POP3 (Gmail Web) */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                          Incoming Server (POP3 — Gmail Web)
                        </span>
                        <span className="text-[9px] font-mono text-gray-400 bg-white/[0.05] px-1.5 py-0.2 rounded">
                          Port 110 / 995 SSL
                        </span>
                      </div>

                      <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden text-xs">
                        
                        {/* Connected Server Node (Domain OR IP) */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <div className="flex flex-col shrink-0">
                            <span className="text-[11px] font-medium text-gray-400">POP Server</span>
                            <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                          </div>
                          
                          {/* Connected Node Group */}
                          <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-white/10 shadow-sm bg-black/40">
                            {/* Domain Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                              <span className="text-white font-semibold text-xs font-mono">{currentHost}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentHost, "pop_host")}
                                className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                                title="Copy Domain"
                              >
                                {copiedKey === "pop_host" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>

                            {/* Connected Center OR Node */}
                            <div className="flex items-center justify-center px-1.5 bg-[#2C2C2E] border-x border-white/10 text-[9px] font-black text-amber-400 uppercase tracking-wider select-none">
                              OR
                            </div>

                            {/* Server IP Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/15 transition-colors">
                              <span className="text-amber-300 font-semibold text-xs font-mono">{serverIp}</span>
                              <button
                                onClick={() => copyToClipboard(serverIp, "pop_ip")}
                                className="text-gray-400 hover:text-amber-400 p-0.5 cursor-pointer"
                                title="Copy Server IP"
                              >
                                {copiedKey === "pop_ip" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Port */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Port</span>
                          <span className="font-mono text-emerald-400 font-semibold text-right flex-1 pr-2">110 (Plain) / 995 (SSL)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("110", "pop_port")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Port"
                          >
                            {copiedKey === "pop_port" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* User Name */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">User Name</span>
                          <span className="font-mono text-white font-semibold truncate text-right flex-1 pr-2">{mailboxUserEmail}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserEmail, "pop_user")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Username"
                          >
                            {copiedKey === "pop_user" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Password</span>
                          <span className="font-mono text-amber-300 font-semibold truncate text-right flex-1 pr-2">{mailboxUserPassword || "••••••••••••"}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserPassword, "pop_pwd")}
                            className="text-gray-400 hover:text-amber-400 p-0.5 cursor-pointer shrink-0"
                            title="Copy Password"
                          >
                            {copiedKey === "pop_pwd" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* iOS Group 2: IMAP (Apps & Mobile) */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-[10px] font-semibold text-[#0A84FF] uppercase tracking-wider">
                          Incoming Server (IMAP — Apps & Mobile)
                        </span>
                        <span className="text-[9px] font-mono text-gray-400 bg-white/[0.05] px-1.5 py-0.2 rounded">
                          Port 993 SSL / 143
                        </span>
                      </div>

                      <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden text-xs">
                        
                        {/* Connected Server Node (Domain OR IP) */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <div className="flex flex-col shrink-0">
                            <span className="text-[11px] font-medium text-gray-400">IMAP Server</span>
                            <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                          </div>
                          
                          {/* Connected Node Group */}
                          <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-white/10 shadow-sm bg-black/40">
                            {/* Domain Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                              <span className="text-white font-semibold text-xs font-mono">{currentHost}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentHost, "imap_host")}
                                className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                                title="Copy Domain"
                              >
                                {copiedKey === "imap_host" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>

                            {/* Connected Center OR Node */}
                            <div className="flex items-center justify-center px-1.5 bg-[#2C2C2E] border-x border-white/10 text-[9px] font-black text-[#0A84FF] uppercase tracking-wider select-none">
                              OR
                            </div>

                            {/* Server IP Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/15 transition-colors">
                              <span className="text-blue-300 font-semibold text-xs font-mono">{serverIp}</span>
                              <button
                                onClick={() => copyToClipboard(serverIp, "imap_ip")}
                                className="text-gray-400 hover:text-blue-400 p-0.5 cursor-pointer"
                                title="Copy Server IP"
                              >
                                {copiedKey === "imap_ip" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Port */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Port</span>
                          <span className="font-mono text-[#0A84FF] font-semibold text-right flex-1 pr-2">993 (SSL) / 143</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("993", "imap_port")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Port"
                          >
                            {copiedKey === "imap_port" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* User Name */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">User Name</span>
                          <span className="font-mono text-white font-semibold truncate text-right flex-1 pr-2">{mailboxUserEmail}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserEmail, "imap_user")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Username"
                          >
                            {copiedKey === "imap_user" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-20 shrink-0">Password</span>
                          <span className="font-mono text-amber-300 font-semibold truncate text-right flex-1 pr-2">{mailboxUserPassword || "••••••••••••"}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserPassword, "imap_pwd")}
                            className="text-gray-400 hover:text-amber-400 p-0.5 cursor-pointer shrink-0"
                            title="Copy Password"
                          >
                            {copiedKey === "imap_pwd" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* iOS Group 3: SMTP (Outgoing) */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-1">
                        <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                          Outgoing Server (SMTP)
                        </span>
                        <span className="text-[9px] font-mono text-gray-400 bg-white/[0.05] px-1.5 py-0.2 rounded">
                          Port 587 / 25
                        </span>
                      </div>

                      <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden text-xs">
                        
                        {/* Connected Server Node (Domain OR IP) */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <div className="flex flex-col shrink-0">
                            <span className="text-[11px] font-medium text-gray-400">SMTP Server</span>
                            <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                          </div>
                          
                          {/* Connected Node Group */}
                          <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-white/10 shadow-sm bg-black/40">
                            {/* Domain Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                              <span className="text-white font-semibold text-xs font-mono">{currentHost}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(currentHost, "smtp_host")}
                                className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                                title="Copy Domain"
                              >
                                {copiedKey === "smtp_host" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>

                            {/* Connected Center OR Node */}
                            <div className="flex items-center justify-center px-1.5 bg-[#2C2C2E] border-x border-white/10 text-[9px] font-black text-purple-400 uppercase tracking-wider select-none">
                              OR
                            </div>

                            {/* Server IP Node */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/15 transition-colors">
                              <span className="text-purple-300 font-semibold text-xs font-mono">{serverIp}</span>
                              <button
                                onClick={() => copyToClipboard(serverIp, "smtp_ip")}
                                className="text-gray-400 hover:text-purple-400 p-0.5 cursor-pointer"
                                title="Copy Server IP"
                              >
                                {copiedKey === "smtp_ip" ? (
                                  <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Port */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-24 shrink-0">Port</span>
                          <span className="font-mono text-purple-400 font-semibold text-right flex-1 pr-2">587 (STARTTLS) / 25</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("587", "smtp_port")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Port"
                          >
                            {copiedKey === "smtp_port" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* User Name */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-24 shrink-0">User Name</span>
                          <span className="font-mono text-white font-semibold truncate text-right flex-1 pr-2">{mailboxUserEmail}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserEmail, "smtp_user")}
                            className="text-gray-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                            title="Copy Username"
                          >
                            {copiedKey === "smtp_user" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-24 shrink-0">Password</span>
                          <span className="font-mono text-amber-300 font-semibold truncate text-right flex-1 pr-2">{mailboxUserPassword || "••••••••••••"}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(mailboxUserPassword, "smtp_pwd")}
                            className="text-gray-400 hover:text-amber-400 p-0.5 cursor-pointer shrink-0"
                            title="Copy Password"
                          >
                            {copiedKey === "smtp_pwd" ? (
                              <svg className="w-3.5 h-3.5 text-[#30D158]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Authentication Type */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-24 shrink-0">Authentication</span>
                          <span className="font-mono text-emerald-400 font-semibold text-right flex-1 text-[11px] pr-1">Password / Plain (Required)</span>
                        </div>

                        {/* Encryption */}
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-[11px] font-medium text-gray-400 w-24 shrink-0">Encryption</span>
                          <span className="font-mono text-purple-300 font-semibold text-right flex-1 text-[11px] pr-1">STARTTLS / TLS (Port 587)</span>
                        </div>

                      </div>

                      {/* Step-by-Step Setup Guide */}
                      <div className="mt-2 bg-[#1C1C1E] border border-white/[0.08] rounded-xl p-3 text-[11px] text-gray-300 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-xs">
                          <span>⚙️</span>
                          <span>SMTP Setup Steps:</span>
                        </div>
                        <div className="space-y-1 text-[10.5px] text-gray-400 leading-relaxed">
                          <div><strong className="text-white">1. Outgoing Server:</strong> Enter <code className="text-purple-300 font-mono bg-white/5 px-1 py-0.2 rounded">{currentHost}</code> (or IP <code className="text-purple-300 font-mono bg-white/5 px-1 py-0.2 rounded">{serverIp}</code>).</div>
                          <div><strong className="text-white">2. Port &amp; Encryption:</strong> Port <code className="text-white font-mono bg-white/5 px-1 py-0.2 rounded">587</code> with <code className="text-emerald-300 font-mono bg-white/5 px-1 py-0.2 rounded">STARTTLS</code> (or Port 25).</div>
                          <div><strong className="text-white">3. Authentication:</strong> Enable <code className="text-white font-mono bg-white/5 px-1 py-0.2 rounded">"My outgoing server requires authentication"</code> / <code className="text-white font-mono bg-white/5 px-1 py-0.2 rounded">Password</code>.</div>
                          <div><strong className="text-white">4. Credentials:</strong> Use your primary email <code className="text-amber-300 font-mono bg-white/5 px-1 py-0.2 rounded">{mailboxUserEmail}</code> and mailbox password.</div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* iOS Bottom Action Bar */}
              <div className="px-4 py-2 bg-[#1C1C1E]/60 border-t border-white/[0.08] flex items-center justify-between shrink-0">
                <span className="text-[10px] text-gray-500 font-mono">TLS/STARTTLS Supported</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className="px-4 py-1 bg-[#0A84FF] hover:bg-[#0071E3] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RIGHT SHEET DRAWER: MULTI-DOMAIN ROUTING (iOS Cupertino)  */}
      {/* ========================================================= */}
      {isRoutingSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* iOS Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsRoutingSheetOpen(false)}
          ></div>

          {/* Slide-over Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex pl-3 sm:pl-6 z-50">
            <div className="w-full bg-[#000000] sm:bg-[#121214] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden">
              
              {/* iOS Navigation Bar Header */}
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between bg-[#1C1C1E]/80 backdrop-blur-md shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRoutingSheetOpen(false)}
                  className="text-xs font-medium text-[#0A84FF] hover:text-[#409CFF] cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex flex-col items-center">
                  <h3 className="text-xs font-semibold text-white">Route Domains</h3>
                  <span className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">{activeFullEmail}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRoutingSheetOpen(false)}
                  className="text-xs font-semibold text-[#0A84FF] hover:text-[#409CFF] cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* iOS Search Bar */}
              <div className="px-3.5 pt-2.5 pb-1 shrink-0 bg-[#121214]">
                <div className="relative">
                  <input
                    type="text"
                    value={routingSearchQuery}
                    onChange={(e) => setRoutingSearchQuery(e.target.value)}
                    placeholder="Search domains"
                    className="w-full bg-[#1C1C1E] border border-white/[0.06] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#0A84FF]"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {routingSearchQuery && (
                    <button
                      onClick={() => setRoutingSearchQuery("")}
                      className="absolute right-2.5 top-1.5 w-4 h-4 rounded-full bg-gray-600 text-gray-200 text-[10px] flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* iOS Grouped Inset Content List (Compact Gaps) */}
              <div className="p-3.5 overflow-y-auto space-y-3 flex-grow">
                
                {/* Attached Domains List */}
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 block">
                    Attached Domains ({domains.length})
                  </span>
                  <div className="bg-[#1C1C1E] rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-hidden">
                    {domains.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-xs">
                        No attached domains found
                      </div>
                    ) : (
                      domains
                        .filter(d => d.domain.toLowerCase().includes(routingSearchQuery.toLowerCase()))
                        .map((domain) => {
                          const isPrimary = domain.domain === primaryDomain?.domain || domain.is_primary === 1 || domain.is_primary === true;
                          const isLinked = isPrimary ? true : (domain.route_to_primary === 1 || domain.route_to_primary === true);

                          return (
                            <div
                              key={domain.id}
                              onClick={() => !isPrimary && handleToggleDomainRouting(domain.id, domain.route_to_primary)}
                              className={`flex items-center justify-between px-3 py-2 transition-colors select-none ${
                                isPrimary ? "bg-amber-500/[0.04]" : "hover:bg-white/[0.03] cursor-pointer"
                              }`}
                            >
                              {/* Left: Checkmark Box + Domain info */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 border transition-all ${
                                    isPrimary
                                      ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm"
                                      : isLinked
                                      ? "bg-[#0A84FF] border-[#0A84FF] text-white shadow-sm"
                                      : "border-zinc-600 bg-transparent text-transparent hover:border-zinc-400"
                                  }`}
                                >
                                  {(isLinked || isPrimary) ? (
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : null}
                                </div>

                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-medium text-white text-xs truncate">
                                      {domain.domain}
                                    </span>
                                    {isPrimary && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 truncate">
                                    {isPrimary
                                      ? "Master Mailbox"
                                      : isLinked
                                      ? `↳ Routed to ${activeFullEmail}`
                                      : "Isolated mailbox"}
                                  </span>
                                </div>
                              </div>

                              {/* Right: iOS Status Badge */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${
                                    isLinked
                                      ? "bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/25"
                                      : "bg-white/5 text-gray-400 border border-white/[0.06]"
                                  }`}
                                >
                                  <span className={`w-1 h-1 rounded-full ${isLinked ? "bg-[#30D158]" : "bg-gray-500"}`} />
                                  {isLinked ? "Linked" : "Isolated"}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

              </div>

              {/* iOS Bottom Fixed Section (Transparent, No Background Box, No Top Border) */}
              <div className="px-3.5 pt-2 pb-3 bg-transparent flex flex-col gap-2 shrink-0">
                {/* Centered Note Text (No background) */}
                <p className="text-center text-[10.5px] text-gray-400 flex items-center justify-center gap-1.5 select-none">
                  <span className="text-xs">💡</span>
                  <span>Transfer All Emails From Multi Domains to Single Primary Domain/Email</span>
                </p>

                {/* Bottom Controls Row */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
                  {/* Left: Counter & Status */}
                  <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[#30D158] shrink-0"></span>
                    <span className="truncate">
                      <strong className="text-white font-semibold">
                        {domains.filter(d => d.route_to_primary === 1 || d.route_to_primary === true || d.is_primary === 1 || d.is_primary === true || d.domain === primaryDomain?.domain).length}
                      </strong> of {domains.length} linked
                    </span>
                  </div>

                  {/* Right: Quick Bulk Actions + Done Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBulkToggleRouting(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#30D158]/15 hover:bg-[#30D158]/25 text-[#30D158] border border-[#30D158]/30 text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      Link All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleRouting(false)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      Unlink All
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRoutingSheetOpen(false)}
                      className="px-3.5 py-1 bg-[#0A84FF] hover:bg-[#0071E3] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 ml-1"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
