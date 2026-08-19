"use client";

import { useState, useEffect } from "react";

export interface MenuItemConfig {
  id: string;
  tab: string;
  path: string;
  label: string;
  desc: string;
  category: string;
  enabled: boolean;
}

interface MenuSetManagerProps {
  apiUrl: string;
  apiPrefix?: string;
  tokenKey?: string;
}

export default function MenuSetManager({
  apiUrl,
  apiPrefix = "/api/devpanel",
  tokenKey = "devpanel_token",
}: MenuSetManagerProps) {
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [resetting, setResetting] = useState<boolean>(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchMenuConfig = async () => {
    if (!apiUrl) return;
    try {
      setLoading(true);
      const token = localStorage.getItem(tokenKey) || localStorage.getItem("dev_admin_token") || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/admin-menu/config`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.menu)) {
          setMenuItems(data.menu);
        }
      } else {
        showToast("Failed to fetch menu configuration", "error");
      }
    } catch (err: any) {
      showToast("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuConfig();
  }, [apiUrl, apiPrefix, tokenKey]);

  const handleToggle = async (item: MenuItemConfig) => {
    if (!apiUrl || togglingId) return;
    const newStatus = !item.enabled;
    setTogglingId(item.id);

    // Optimistic UI update
    setMenuItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, enabled: newStatus } : m))
    );

    try {
      const token = localStorage.getItem(tokenKey) || localStorage.getItem("dev_admin_token") || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/admin-menu/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: item.id, enabled: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.menu)) {
          setMenuItems(data.menu);
          showToast(`"${item.label}" is now ${newStatus ? "VISIBLE" : "HIDDEN"} in Admin Panel`);
        }
      } else {
        // Revert on failure
        setMenuItems((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, enabled: item.enabled } : m))
        );
        showToast("Failed to update menu setting", "error");
      }
    } catch (err: any) {
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, enabled: item.enabled } : m))
      );
      showToast("Error updating menu toggle", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleReset = async () => {
    if (!apiUrl || resetting) return;
    if (!confirm("Are you sure you want to reset all Admin sidebar menu settings to default?")) return;
    try {
      setResetting(true);
      const token = localStorage.getItem(tokenKey) || localStorage.getItem("dev_admin_token") || "";
      const res = await fetch(`${apiUrl}${apiPrefix}/admin-menu/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.menu)) {
          setMenuItems(data.menu);
          showToast("Admin sidebar menu reset to default settings!");
        }
      }
    } catch (err: any) {
      showToast("Error resetting menu settings", "error");
    } finally {
      setResetting(false);
    }
  };

  const categories = ["All", "Core", "Monitoring", "Management", "Tools"];

  const filteredItems = menuItems.filter((item) => {
    const matchesCat = filterCategory === "All" || item.category.toLowerCase() === filterCategory.toLowerCase();
    const matchesSearch =
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const enabledCount = menuItems.filter((m) => m.enabled).length;
  const disabledCount = menuItems.filter((m) => !m.enabled).length;

  const getTabIcon = (tabId: string) => {
    switch (tabId) {
      case "overview-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
          </svg>
        );
      case "api-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "logs-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        );
      case "projects-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        );
      case "domains-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        );
      case "primary-domain-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        );
      case "seeding-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        );
      case "credentials-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        );
      case "explorer-tab":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toastMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300 shadow-emerald-500/20"
              : "bg-rose-950/90 border-rose-500/40 text-rose-300 shadow-rose-500/20"
          }`}>
            <span className="text-lg">{toastMessage.type === "success" ? "✓" : "✕"}</span>
            <span className="text-xs font-semibold">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-violet-900/30 via-[#0E0E22]/60 to-indigo-950/30 border border-violet-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-mono font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
              SUPERADMIN CONTROL
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Admin Sidebar Menu Settings
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
              Dynamically toggle (<span className="text-emerald-400 font-semibold">Show</span> / <span className="text-rose-400 font-semibold">Hide</span>) any tab button in the <strong className="text-white font-mono">Admin Panel (/admin)</strong>. Changes persist automatically and apply in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] px-4 py-2.5 rounded-2xl">
              <div className="text-center px-2">
                <div className="text-xs font-bold text-violet-400 font-mono">{menuItems.length}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Total</div>
              </div>
              <div className="w-[1px] h-6 bg-white/[0.08]"></div>
              <div className="text-center px-2">
                <div className="text-xs font-bold text-emerald-400 font-mono">{enabledCount}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Visible</div>
              </div>
              <div className="w-[1px] h-6 bg-white/[0.08]"></div>
              <div className="text-center px-2">
                <div className="text-xs font-bold text-gray-400 font-mono">{disabledCount}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Hidden</div>
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>{resetting ? "Resetting..." : "Reset Defaults"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/[0.06] rounded-2xl overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === cat
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-lg shadow-violet-500/10"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search menu tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A1A] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-all pl-9"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ListTile Menu Items Grid */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-[#0A0A1A]/80 border border-white/[0.04] rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#0A0A1A]/60 border border-white/[0.06] rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto text-gray-500">
            🔍
          </div>
          <h3 className="text-base font-bold text-white">No Menu Items Found</h3>
          <p className="text-gray-500 text-xs max-w-sm mx-auto">
            No admin menu tabs match your filter or search query. Try clearing the search.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isToggling = togglingId === item.id;
            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-200 ${
                  item.enabled
                    ? "bg-[#0B0B1E]/80 hover:bg-[#0E0E28] border-violet-500/20 shadow-lg shadow-violet-500/[0.02]"
                    : "bg-[#07070F]/60 hover:bg-[#0A0A16] border-white/[0.04] opacity-75 hover:opacity-100"
                }`}
              >
                {/* ListTile Left Content */}
                <div className="flex items-start sm:items-center gap-4 flex-grow min-w-0">
                  {/* Icon Badge */}
                  <div
                    className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center transition-all ${
                      item.enabled
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "bg-white/[0.03] border border-white/[0.06] text-gray-500"
                    }`}
                  >
                    {getTabIcon(item.id)}
                  </div>

                  {/* Title + Route + Description */}
                  <div className="space-y-1 min-w-0 flex-grow">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-white tracking-tight">
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.05] text-gray-400 border border-white/[0.06]">
                        /admin/{item.path}
                      </span>
                      <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        item.category === "Core"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : item.category === "Monitoring"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : item.category === "Management"
                          ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* ListTile Right Controls (Status Badge + Toggle Switch) */}
                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.enabled ? "bg-emerald-400 shadow-[0_0_8px_#10B981]" : "bg-gray-600"
                      }`}
                    ></span>
                    <span
                      className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                        item.enabled ? "text-emerald-400" : "text-gray-500"
                      }`}
                    >
                      {item.enabled ? "Visible In Admin" : "Hidden"}
                    </span>
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    disabled={isToggling}
                    className={`w-14 h-7.5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 focus:outline-none relative shadow-inner ${
                      item.enabled
                        ? "bg-emerald-500 justify-end shadow-emerald-900/50"
                        : "bg-gray-800 justify-start"
                    } ${isToggling ? "opacity-60 cursor-wait" : ""}`}
                    aria-label={`Toggle ${item.label}`}
                  >
                    <div
                      className={`bg-white w-5.5 h-5.5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                        item.enabled ? "translate-x-0" : "translate-x-0"
                      }`}
                    >
                      {isToggling ? (
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : item.enabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-gray-500">
                          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.375l1.091 1.09A4 4 0 007.752 6.69z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
