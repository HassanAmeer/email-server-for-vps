"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-config";

interface Attachment {
  filename: string;
  size: number;
  url: string;
  contentType?: string;
  content?: string;
}

interface EmailItem {
  id: number;
  recipient: string;
  sender: string;
  subject: string;
  has_attachment: number;
  attachment_size: number;
  is_deleted?: number;
  created_at: string;
  details?: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    date: string;
    senderIp?: string;
    attachments?: Attachment[];
    rawHeaders?: string;
  };
}

interface MediaFile {
  emailId: number;
  sender: string;
  recipient: string;
  subject?: string;
  date: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export default function MailboxInbox() {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [primaryDomain, setPrimaryDomain] = useState("mailserver10.com");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  const [showMedia, setShowMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "with_attachments" | "simple" | "pinned" | "trash">("all");
  const [trashCount, setTrashCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [pinnedEmails, setPinnedEmails] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Media & Attachments Right Sheet Drawer & Lightbox Modal States
  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<"all" | "images" | "videos" | "documents" | "others">("all");
  const [previewModalFile, setPreviewModalFile] = useState<MediaFile | null>(null);

  // Server Settings (IMAP/POP) Right Sheet Drawer State
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [serverIp, setServerIp] = useState<string>(process.env.NEXT_PUBLIC_SERVER_IP || "187.52.117.2");
  const [userPassword, setUserPassword] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Theme State ("dark" | "light")
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("mailbox_theme") as "dark" | "light") || "dark";
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("mailbox_theme", nextTheme);
  };

  // Checkbox Selection State
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);

  const toggleSelectEmail = (emailId: number, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedEmailIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmailIds.size === visibleEmails.length && visibleEmails.length > 0) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(visibleEmails.map(e => e.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedEmailIds(new Set());
  };

  const handleMoveToTrash = async (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/mailbox/inbox/${emailId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setEmails(prev => prev.filter(email => email.id !== emailId));
        setTotalRecords(prev => Math.max(0, prev - 1));
        setTrashCount(prev => prev + 1);
        setPinnedEmails(prev => {
          const next = new Set(prev);
          next.delete(emailId);
          localStorage.setItem("mailbox_pinned_emails", JSON.stringify(Array.from(next)));
          return next;
        });
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
        setToastMessage("Moved email to Trash");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      alert("Error moving email to trash");
    }
  };

  const handleRestoreEmail = async (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/mailbox/inbox/restore/${emailId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setEmails(prev => prev.filter(email => email.id !== emailId));
        setTotalRecords(prev => Math.max(0, prev - 1));
        setTrashCount(prev => Math.max(0, prev - 1));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
        setToastMessage("Email restored to Inbox");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      alert("Error restoring email");
    }
  };

  const handlePermanentDeleteEmail = async (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this email? This cannot be undone.")) return;
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/mailbox/inbox/${emailId}?permanent=true`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setEmails(prev => prev.filter(email => email.id !== emailId));
        setTotalRecords(prev => Math.max(0, prev - 1));
        setTrashCount(prev => Math.max(0, prev - 1));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
        setToastMessage("Email permanently deleted");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      alert("Error permanently deleting email");
    }
  };

  const handleBatchAction = async (action: "trash" | "restore" | "permanent") => {
    if (selectedEmailIds.size === 0) return;
    const count = selectedEmailIds.size;
    const idsToDelete = Array.from(selectedEmailIds);

    if (action === "permanent") {
      if (!confirm(`Are you sure you want to permanently delete ${count} selected email${count > 1 ? 's' : ''}? This action cannot be undone.`)) return;
    }

    setIsBatchDeleting(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      let url = `${apiBase}/api/mailbox/inbox/delete-selected`;
      if (action === "restore") url = `${apiBase}/api/mailbox/inbox/restore`;
      if (action === "permanent") url = `${apiBase}/api/mailbox/inbox/permanent-delete`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ids: idsToDelete })
      });

      if (res.ok) {
        setEmails(prev => prev.filter(email => !selectedEmailIds.has(email.id)));
        setTotalRecords(prev => Math.max(0, prev - count));
        if (action === "trash") {
          setTrashCount(prev => prev + count);
        } else if (action === "restore" || action === "permanent") {
          setTrashCount(prev => Math.max(0, prev - count));
        }

        setPinnedEmails(prev => {
          const next = new Set(prev);
          idsToDelete.forEach(id => next.delete(id));
          localStorage.setItem("mailbox_pinned_emails", JSON.stringify(Array.from(next)));
          return next;
        });

        if (selectedEmail && selectedEmailIds.has(selectedEmail.id)) {
          setSelectedEmail(null);
        }

        setSelectedEmailIds(new Set());
        const msg = action === "trash" 
          ? `Moved ${count} email${count > 1 ? 's' : ''} to Trash`
          : action === "restore"
          ? `Restored ${count} email${count > 1 ? 's' : ''} to Inbox`
          : `Permanently deleted ${count} email${count > 1 ? 's' : ''}`;
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert("Failed to process selected emails");
      }
    } catch (err) {
      alert("Error processing selected emails");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (trashCount === 0 && emails.length === 0) return;
    if (!confirm("Are you sure you want to empty the Trash? All trashed emails will be permanently deleted from the server.")) return;

    setIsBatchDeleting(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/mailbox/inbox/permanent-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ all: true })
      });

      if (res.ok) {
        if (filterType === "trash") {
          setEmails([]);
          setTotalRecords(0);
          if (selectedEmail) setSelectedEmail(null);
        }
        setTrashCount(0);
        setSelectedEmailIds(new Set());
        setToastMessage("Trash emptied successfully");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert("Failed to empty trash");
      }
    } catch (err) {
      alert("Error emptying trash");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setToastMessage(`Copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchServerSettings = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/mailbox/info`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setServerInfo(data);
          if (data.primaryDomain) setPrimaryDomain(data.primaryDomain);
          if (data.serverIp) setServerIp(data.serverIp);
          if (data.defaultCredentials?.password && !userPassword) {
            setUserPassword(data.defaultCredentials.password);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching server settings:", err);
    }
  };

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [customLimit, setCustomLimit] = useState("100");
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const router = useRouter();

  useEffect(() => {
    fetchServerSettings();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
    const userStr = localStorage.getItem("mailbox_user") || localStorage.getItem("imap_mailbox_user");
    const expiry = localStorage.getItem("mailbox_token_expiry") || localStorage.getItem("imap_mailbox_token_expiry");

    if (!token || !userStr || (expiry && Date.now() > Number(expiry))) {
      handleLogout();
      return;
    }

    try {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      const storedRead = localStorage.getItem("mailbox_read_emails") || localStorage.getItem("imap_mailbox_read_emails");
      if (storedRead) {
        setReadEmails(new Set(JSON.parse(storedRead)));
      }
      const storedPinned = localStorage.getItem("mailbox_pinned_emails") || localStorage.getItem("imap_mailbox_pinned_emails");
      if (storedPinned) {
        setPinnedEmails(new Set(JSON.parse(storedPinned)));
      }
      fetchEmails(token, page, filterType, searchQuery);
    } catch (e) {
      handleLogout();
    }
  }, [router]);

  // Refetch when page, filter, search, or limit changes
  useEffect(() => {
    const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
    if (!token || !user) return;
    fetchEmails(token, page, filterType, searchQuery);
  }, [page, filterType, searchQuery, limit]);

  // Auto-scroll the active page tab into view in the scrollable pagination row
  useEffect(() => {
    const active = document.getElementById(`page-tab-${page}`);
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [page]);

  // Smart Auto-fetch: Polls every 6 seconds when tab is active, pauses in background, and auto-refreshes on tab focus
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
    if (!token) return;

    let isFocused = typeof document !== "undefined" ? !document.hidden : true;

    const handleVisibility = () => {
      isFocused = !document.hidden;
      if (isFocused) {
        fetchEmailsSilent(token, page, filterType, searchQuery);
      }
    };

    const handleFocus = () => {
      fetchEmailsSilent(token, page, filterType, searchQuery);
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("focus", handleFocus);
    }

    const interval = setInterval(() => {
      if (isFocused) {
        fetchEmailsSilent(token, page, filterType, searchQuery);
      }
    }, 6000);

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [user, page, filterType, searchQuery]);

  const fetchEmailsSilent = async (token: string, curPage: number, curFilter: string, curSearch: string) => {
    try {
      const apiBase = getApiBaseUrl();
      const effFilter = curFilter === "pinned" ? "all" : curFilter;
      const effLimit = curFilter === "pinned" ? 500 : limit;
      const effPage = curFilter === "pinned" ? 1 : curPage;
      let url = `${apiBase}/api/mailbox/inbox?page=${effPage}&limit=${effLimit}&filter=${effFilter}`;
      if (curSearch && curSearch.trim().length > 0) {
        url += `&search=${encodeURIComponent(curSearch.trim())}`;
      }

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(text);
        } catch {
          return;
        }
        setEmails(responseData.data || []);
        if (responseData.pagination) {
          setTotalRecords(responseData.pagination.totalRecords || 0);
          setTotalPages(responseData.pagination.totalPages || 1);
        }
        if (responseData.primaryDomain) {
          setPrimaryDomain(responseData.primaryDomain);
        }
        if (typeof responseData.trashCount === 'number') {
          setTrashCount(responseData.trashCount);
        }
      }
    } catch (err) {
      // Silently fail for background polling
    }
  };

  const fetchEmails = async (token: string, curPage: number, curFilter: string, curSearch: string) => {
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl();
      const effFilter = curFilter === "pinned" ? "all" : curFilter;
      const effLimit = curFilter === "pinned" ? 500 : limit;
      const effPage = curFilter === "pinned" ? 1 : curPage;
      let url = `${apiBase}/api/mailbox/inbox?page=${effPage}&limit=${effLimit}&filter=${effFilter}`;
      if (curSearch && curSearch.trim().length > 0) {
        url += `&search=${encodeURIComponent(curSearch.trim())}`;
      }

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const text = await res.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response. Please ensure backend is running.");
      }

      if (res.ok) {
        setEmails(responseData.data || []);
        if (responseData.pagination) {
          setTotalRecords(responseData.pagination.totalRecords || 0);
          setTotalPages(responseData.pagination.totalPages || 1);
        }
        if (responseData.primaryDomain) {
          setPrimaryDomain(responseData.primaryDomain);
        }
        if (typeof responseData.trashCount === 'number') {
          setTrashCount(responseData.trashCount);
        }
      } else {
        setError(responseData.error || "Failed to load emails");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading emails");
    } finally {
      setLoading(false);
    }
  };

  const openMediaSheet = async () => {
    setIsMediaSheetOpen(true);
    setLoadingMedia(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const userStr = localStorage.getItem("mailbox_user") || localStorage.getItem("imap_mailbox_user");
      let emailParam = "";
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          if (parsed.email) emailParam = `?email=${encodeURIComponent(parsed.email)}`;
        } catch (e) {}
      }
      const res = await fetch(`${apiBase}/api/mailbox/media${emailParam}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setMediaFiles(data.media || []);
        } catch {
          // ignore non-json
        }
      }
    } catch (err) {
      console.error("Error fetching media:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const fetchMediaFiles = async () => {
    // Open right sheet directly
    openMediaSheet();
  };

  const getFileExtension = (filename: string): string => {
    if (!filename) return "FILE";
    const parts = filename.split(".");
    if (parts.length > 1) {
      return parts[parts.length - 1].toUpperCase();
    }
    return "FILE";
  };

  const getMediaCategory = (file: MediaFile): "images" | "videos" | "documents" | "others" => {
    const ext = (file.filename?.split(".").pop() || "").toLowerCase();
    const ct = (file.contentType || "").toLowerCase();
    if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico", "avif"].includes(ext)) {
      return "images";
    }
    if (ct.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv", "m4v"].includes(ext)) {
      return "videos";
    }
    if (ct === "application/pdf" || ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "md"].includes(ext)) {
      return "documents";
    }
    return "others";
  };

  const getExtensionBadgeStyle = (ext: string): { bg: string; text: string; border: string; glow: string } => {
    const e = ext.toUpperCase();
    switch (e) {
      case "PDF":
        return { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", glow: "from-rose-500/20 to-red-600/10" };
      case "DOC":
      case "DOCX":
        return { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", glow: "from-blue-500/20 to-indigo-600/10" };
      case "XLS":
      case "XLSX":
      case "CSV":
        return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", glow: "from-emerald-500/20 to-teal-600/10" };
      case "ZIP":
      case "RAR":
      case "7Z":
      case "TAR":
      case "GZ":
        return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", glow: "from-amber-500/20 to-yellow-600/10" };
      case "TXT":
      case "MD":
      case "LOG":
        return { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/30", glow: "from-slate-500/20 to-gray-600/10" };
      case "JSON":
      case "JS":
      case "TS":
      case "HTML":
      case "CSS":
      case "PY":
        return { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30", glow: "from-purple-500/20 to-violet-600/10" };
      default:
        return { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30", glow: "from-indigo-500/20 to-purple-600/10" };
    }
  };

  const togglePin = (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      localStorage.setItem("mailbox_pinned_emails", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("mailbox_token");
    localStorage.removeItem("mailbox_token_expiry");
    localStorage.removeItem("mailbox_user");
    localStorage.removeItem("imap_mailbox_token");
    localStorage.removeItem("imap_mailbox_token_expiry");
    localStorage.removeItem("imap_mailbox_user");
    router.push("/mailbox");
  };

  const handleViewEmail = async (emailRecord: EmailItem) => {
    setShowCompose(false);
    setShowMedia(false);
    setSidebarOpen(false);

    // Mark as read immediately in UI and localStorage
    setReadEmails(prev => {
      const next = new Set(prev);
      next.add(emailRecord.id);
      localStorage.setItem("mailbox_read_emails", JSON.stringify(Array.from(next)));
      return next;
    });

    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const res = await fetch(`${apiBase}/api/mailbox/inbox/${emailRecord.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        alert("Failed to parse email content");
        return;
      }

      if (res.ok && data) {
        setSelectedEmail({ ...emailRecord, details: data });
      } else {
        alert(data?.error || "Failed to load email details");
      }
    } catch (err) {
      alert("Error loading email content");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token");
      const userStr = localStorage.getItem("mailbox_user") || localStorage.getItem("imap_mailbox_user");
      let senderEmail = "admin@micorna.biz";
      try {
        if (userStr) {
          const parsedUser = JSON.parse(userStr);
          if (parsedUser.email) senderEmail = parsedUser.email;
        }
      } catch (e) {}

      const res = await fetch(`${apiBase}/api/admin/smtp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          from: senderEmail,
          to: composeTo,
          subject: composeSubject,
          text: composeMessage,
          html: `<p>${composeMessage.replace(/\n/g, '<br/>')}</p>`
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid response from server when sending email");
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      alert("Email dispatched successfully!");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeMessage("");
      if (token) fetchEmailsSilent(token, page, filterType, searchQuery);
    } catch (err: any) {
      alert(err.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const parseSender = (senderStr: string) => {
    if (!senderStr) return { name: "Unknown Sender", email: "" };
    const str = senderStr.trim();
    
    // Match standard: "Display Name" <email@domain.com> or Display Name <email@domain.com>
    const angleMatch = str.match(/^(?:["']?([^"<]+)["']?\s*)?<([^>]+@[^>]+)>$/);
    if (angleMatch) {
      const email = (angleMatch[2] || "").trim();
      const rawName = (angleMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      const name = rawName.length > 0 ? rawName : email;
      return { name, email };
    }

    // Match parenthetical: Display Name (email@domain.com) or email@domain.com (Display Name)
    const parenMatch = str.match(/^([^(]+)\(([^)]+)\)$/);
    if (parenMatch) {
      const part1 = parenMatch[1].trim().replace(/^["']|["']$/g, "");
      const part2 = parenMatch[2].trim().replace(/^["']|["']$/g, "");
      if (part2.includes("@")) return { name: part1 || part2, email: part2 };
      if (part1.includes("@")) return { name: part2 || part1, email: part1 };
    }

    // If it's a plain email address: service@demo.com or "service@demo.com"
    if (str.includes("@")) {
      const cleanEmail = str.replace(/^["'<]|["'>]$/g, "").trim();
      return { name: cleanEmail, email: cleanEmail };
    }

    return { name: str, email: "" };
  };

  const getAvatarColor = (str: string = "") => {
    const colors = [
      "bg-[#1a73e8]", "bg-[#9334e6]", "bg-[#0d9488]", 
      "bg-[#d97706]", "bg-[#e11d48]", "bg-[#4f46e5]", 
      "bg-[#0284c7]", "bg-[#059669]", "bg-[#db2777]"
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const currentHost = serverInfo?.imap?.host || (primaryDomain ? `mail.${primaryDomain}` : typeof window !== 'undefined' ? window.location.hostname : "mail.server.com");

  if (!user) return null;

  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  const isPinnedFilter = filterType === "pinned";
  const visibleEmails = isPinnedFilter ? emails.filter(e => pinnedEmails.has(e.id)) : emails;
  const pinnedCount = pinnedEmails.size;

  return (
    <div className={`h-dvh font-sans flex flex-col relative overflow-hidden transition-colors duration-200 ${
      theme === "light"
        ? "bg-[#f6f8fc] text-[#202124] selection:bg-[#c2e7ff] selection:text-[#001d35]"
        : "bg-[#030712] text-gray-200 selection:bg-blue-500 selection:text-white"
    }`}>
      {/* Background glowing ambient orbs (Dark mode only) */}
      {theme === "dark" && (
        <>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 blur-[140px] pointer-events-none rounded-full" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 blur-[140px] pointer-events-none rounded-full" />
        </>
      )}

      {/* Top Main Header */}
      <header className={`h-14 sm:h-16 sticky top-0 z-40 flex-shrink-0 relative transition-colors ${
        theme === "light"
          ? "bg-[#ffffff] border-b border-[#e0e3e7] shadow-xs text-[#202124]"
          : "bg-[#0b0f19]/90 backdrop-blur-xl border-b border-white/[0.06] text-white"
      }`}>
        <div className={`absolute bottom-0 left-0 w-full h-px ${
          theme === "light"
            ? "bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"
            : "bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"
        }`}></div>
        <div className="max-w-[1700px] mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={handleLogout}
              className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-white hover:bg-rose-500/20 transition-colors"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
            <div className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center relative overflow-hidden transition-all ${
              theme === "light"
                ? "bg-[#e8f0fe] border border-[#c2e7ff] text-[#1a73e8] shadow-xs"
                : "bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/15"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 relative z-10">
                <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
              </svg>
            </div>
            <div className="flex flex-col items-start justify-center gap-0.5 min-w-0">
              <h1 className={`text-base sm:text-lg font-bold tracking-tight leading-none ${
                theme === "light" ? "text-[#202124]" : "text-white"
              }`}>
                Primary <span className="text-[#1a73e8] dark:text-blue-400">Mailbox</span>
              </h1>
              <span className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                theme === "light"
                  ? "bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]"
                  : "bg-white/[0.06] text-gray-400 border border-white/[0.1]"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Ports 993/143
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button (Light / Dark) */}
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all font-semibold shadow-xs cursor-pointer active:scale-95 ${
                theme === "light"
                  ? "border-[#dadce0] bg-[#ffffff] text-[#444746] hover:bg-[#f1f3f4] hover:text-[#202124]"
                  : "border-white/[0.12] bg-white/[0.04] text-amber-400 hover:text-amber-300 hover:bg-white/[0.08]"
              }`}
              title={theme === "light" ? "Switch to Dark Theme" : "Switch to Light Theme"}
            >
              {theme === "light" ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#444746]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
            </button>

            {/* Server Settings (IMAP/POP) Small Connection Icon Button */}
            <button
              onClick={() => setIsSettingsSheetOpen(true)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all font-semibold shadow-xs cursor-pointer active:scale-95 ${
                theme === "light"
                  ? "border-[#d2e3fc] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500/25 hover:border-blue-500/50"
              }`}
              title="Server Settings & Connection Info (IMAP/POP)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </button>

            <button
              onClick={() => setSidebarOpen(o => !o)}
              className={`lg:hidden flex items-center justify-center w-9 h-9 rounded-xl border transition-colors ${
                theme === "light"
                  ? "border-[#dadce0] bg-white text-[#444746] hover:bg-[#f1f3f4]"
                  : "border-white/[0.12] bg-transparent text-gray-300 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5"
              }`}
              title="Toggle Email List"
            >
              {sidebarOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              )}
            </button>
            <div className="hidden md:flex flex-col items-end">
              <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
                theme === "light" ? "text-[#5f6368]" : "text-gray-500"
              }`}>
                PRIMARY DOMAIN
              </span>
              <span className={`text-xs font-mono font-bold ${
                theme === "light" ? "text-[#202124]" : "text-gray-200"
              }`}>{user.email}</span>
            </div>
            <div className={`h-8 w-px hidden lg:block mx-1 ${
              theme === "light" ? "bg-[#e0e3e7]" : "bg-white/[0.08]"
            }`}></div>
            <button
              onClick={handleLogout}
              className={`hidden lg:flex w-9 h-9 items-center justify-center rounded-xl border transition-colors ${
                theme === "light"
                  ? "border-[#fad2cf] bg-[#fce8e6] text-[#c5221f] hover:bg-[#fad2cf]"
                  : "border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-white hover:bg-rose-500/20"
              }`}
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={`flex-1 max-w-[1700px] mx-auto w-full flex overflow-hidden shadow-2xl my-0 border-x relative z-10 transition-colors ${
        theme === "light"
          ? "bg-[#ffffff] border-[#e0e3e7] shadow-slate-200/50"
          : "bg-[#0b0f19] border-white/[0.04] shadow-black/80"
      }`}>

        {/* Drawer Backdrop */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 top-14 sm:top-16 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        )}

        {/* Email Stream Sidebar (Left Pane) - Drawer on mobile/tablet */}
        <div className={`fixed top-14 sm:top-16 bottom-0 left-0 z-50 lg:top-auto lg:bottom-auto lg:left-auto lg:static lg:z-auto w-[85vw] max-w-[400px] lg:w-[420px] xl:w-[470px] lg:max-w-none flex flex-col border-r overflow-hidden flex-shrink-0 transition-transform duration-300 ease-in-out ${
          theme === "light"
            ? "bg-[#ffffff] lg:bg-[#f6f8fc] border-[#e0e3e7] shadow-lg lg:shadow-none"
            : "bg-[#030712]/95 lg:bg-[#030712]/60 border-white/[0.06] shadow-2xl shadow-black/60"
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          
          {/* Action Header, Search & Filter Controls */}
          <div className={`p-3 sm:p-4 border-b flex flex-col gap-2.5 sm:gap-3 z-10 sticky top-0 shadow-xs relative transition-colors ${
            theme === "light"
              ? "bg-[#ffffff] border-[#e0e3e7]"
              : "bg-[#0b0f19]/95 backdrop-blur-md border-white/[0.06]"
          }`}>
            <div className="flex justify-between items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className={`text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 truncate min-w-0 ${
                  theme === "light" ? "text-[#202124]" : "text-white"
                }`}>
                  Captured Mail
                </h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold flex-shrink-0 ${
                  theme === "light"
                    ? "bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]"
                    : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                }`}>
                  {totalRecords}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token") || "";
                    fetchEmails(token, page, filterType, searchQuery);
                  }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border transition-colors ${
                    theme === "light"
                      ? "border-[#dadce0] bg-white text-[#444746] hover:text-[#1a73e8] hover:border-[#1a73e8] hover:bg-[#e8f0fe]"
                      : "border-white/[0.12] bg-transparent text-gray-300 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5"
                  }`}
                  title="Refresh Email Stream"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin text-blue-400" : ""}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setFilterType("all");
                    setPage(1);
                    const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token") || "";
                    fetchEmails(token, 1, "all", searchQuery);
                  }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border transition-colors ${
                    filterType === "all"
                      ? (theme === "light" ? "text-[#1a73e8] border-[#1a73e8] bg-[#e8f0fe]" : "text-blue-400 border-blue-500/40 bg-blue-500/5")
                      : (theme === "light" ? "border-[#dadce0] text-[#444746] hover:text-[#1a73e8] hover:border-[#1a73e8] hover:bg-[#e8f0fe]" : "border-white/[0.12] text-gray-300 hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/5")
                  }`}
                  title="Incoming Emails"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsSettingsSheetOpen(true)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border transition-colors ${
                    theme === "light"
                      ? "border-[#d2e3fc] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500/25 hover:border-blue-500/50"
                  }`}
                  title="Server Connection Settings (IMAP/POP)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </button>
                <button
                  onClick={openMediaSheet}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                    isMediaSheetOpen
                      ? "border-purple-500 bg-purple-500/20 text-purple-400 font-bold shadow-sm"
                      : theme === "light"
                      ? "border-[#dadce0] bg-white text-[#444746] hover:text-[#673ab7] hover:border-[#673ab7] hover:bg-[#f3e8fd]"
                      : "border-white/[0.12] bg-transparent text-gray-300 hover:text-purple-400 hover:border-purple-500/40 hover:bg-purple-500/10"
                  }`}
                  title="Media & Attachments Gallery (Slide-over)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => { setSelectedEmail(null); setShowMedia(false); setShowCompose(true); setSidebarOpen(false); }}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border transition-colors ${
                    theme === "light"
                      ? "border-[#c2e7ff] bg-[#c2e7ff] text-[#001d35] hover:bg-[#b3d7ff] font-bold"
                      : "border-white/[0.12] bg-transparent text-gray-300 hover:text-white hover:border-blue-500/40 hover:bg-blue-500/10"
                  }`}
                  title="Compose New Message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Fast Search Input (Gmail Style) */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search sender, recipient, subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className={`w-full rounded-xl px-3.5 py-1.5 sm:py-2 pl-9 pr-8 text-xs focus:outline-none transition-all ${
                  theme === "light"
                    ? "bg-[#edf2fa] hover:bg-[#e4ebf5] focus:bg-white text-[#202124] placeholder:text-[#5f6368] border border-transparent focus:border-[#1a73e8] shadow-xs"
                    : "bg-black/60 border border-white/[0.08] focus:border-blue-500/60 text-white placeholder:text-gray-500 font-mono"
                }`}
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-3.5 h-3.5 absolute left-3 top-2 sm:top-2.5 ${
                theme === "light" ? "text-[#5f6368]" : "text-gray-400"
              }`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setPage(1); }}
                  className={`absolute right-2.5 top-1.5 sm:top-2 text-xs p-1 ${
                    theme === "light" ? "text-[#5f6368] hover:text-[#202124]" : "text-gray-400 hover:text-white"
                  }`}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Unified Horizontal Toolbar: Exact Order: 1. Select All -> 2. Trash -> 3. All Emails -> 4. Simple Email -> 5. Attachment -> 6. Pinned */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5 py-0.5 flex-nowrap whitespace-nowrap">
              {/* 1st: Select All Checkmark Button */}
              {visibleEmails.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    selectedEmailIds.size > 0 && selectedEmailIds.size === visibleEmails.length
                      ? (theme === "light" ? "bg-[#c2e7ff] text-[#001d35] border-[#7fcfff]" : "bg-blue-500/20 text-blue-300 border-blue-500/40")
                      : selectedEmailIds.size > 0
                      ? (theme === "light" ? "bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc]" : "bg-blue-500/10 text-blue-300 border-blue-500/30")
                      : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#f2f6fc] border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border-white/[0.05]")
                  }`}
                  title={selectedEmailIds.size === visibleEmails.length ? "Deselect All" : "Select All Visible Emails"}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                    selectedEmailIds.size > 0 && selectedEmailIds.size === visibleEmails.length
                      ? "bg-[#1a73e8] border-[#1a73e8] text-white shadow-xs"
                      : selectedEmailIds.size > 0
                      ? "bg-blue-500/30 border-blue-400 text-blue-500"
                      : (theme === "light" ? "border-[#747775] bg-white" : "border-white/20 bg-black/40")
                  }`}>
                    {selectedEmailIds.size > 0 && selectedEmailIds.size === visibleEmails.length ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    ) : selectedEmailIds.size > 0 ? (
                      <div className="w-1.5 h-0.5 bg-blue-500 rounded-full"></div>
                    ) : null}
                  </div>
                  <span>{selectedEmailIds.size > 0 ? `${selectedEmailIds.size} Sel` : "Select All"}</span>
                </button>
              )}

              {/* Dynamic Batch Actions when items are selected */}
              {selectedEmailIds.size > 0 && (
                <>
                  {filterType === "trash" ? (
                    <>
                      <button
                        onClick={() => handleBatchAction("restore")}
                        disabled={isBatchDeleting}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                          theme === "light"
                            ? "bg-[#c4eed0] hover:bg-[#b2e8c0] border-[#6dd58c] text-[#072711]"
                            : "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300"
                        }`}
                        title="Restore Selected to Inbox"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        <span>Restore ({selectedEmailIds.size})</span>
                      </button>
                      <button
                        onClick={() => handleBatchAction("permanent")}
                        disabled={isBatchDeleting}
                        className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                          theme === "light"
                            ? "bg-[#fce8e6] hover:bg-[#fad2cf] border-[#f5b7b1] text-[#c5221f]"
                            : "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300"
                        }`}
                        title="Delete Selected Permanently"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                        </svg>
                        <span>Delete Perm</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleBatchAction("trash")}
                      disabled={isBatchDeleting}
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                        theme === "light"
                          ? "bg-[#fce8e6] hover:bg-[#fad2cf] border-[#f5b7b1] text-[#c5221f]"
                          : "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300"
                      }`}
                      title="Move Selected to Trash"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                      </svg>
                      <span>Delete ({selectedEmailIds.size})</span>
                    </button>
                  )}

                  <button
                    onClick={handleDeselectAll}
                    className={`p-1 rounded-md transition-colors shrink-0 ${
                      theme === "light" ? "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]" : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
                    }`}
                    title="Clear Selection"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </>
              )}

              {/* 2nd: Trash Tab */}
              <button
                onClick={() => { setFilterType("trash"); setPage(1); setSelectedEmailIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                  filterType === "trash"
                    ? (theme === "light" ? "bg-[#fce8e6] text-[#c5221f] border border-[#f5b7b1]" : "bg-rose-500/20 text-rose-300 border border-rose-500/40")
                    : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#fce8e6] hover:text-[#c5221f] border border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]")
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
                <span>Trash ({trashCount})</span>
              </button>

              {/* Empty Trash Button if in Trash tab and no items selected */}
              {filterType === "trash" && trashCount > 0 && selectedEmailIds.size === 0 && (
                <button
                  onClick={handleEmptyTrash}
                  disabled={isBatchDeleting}
                  className={`flex items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded transition-colors shrink-0 cursor-pointer ${
                    theme === "light"
                      ? "text-[#c5221f] hover:bg-[#fce8e6]"
                      : "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                  <span>Empty Trash</span>
                </button>
              )}

              {/* 3rd: All Tab */}
              <button
                onClick={() => { setFilterType("all"); setPage(1); setSelectedEmailIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "all"
                    ? (theme === "light" ? "bg-[#c2e7ff] text-[#001d35] border border-[#7fcfff]" : "bg-blue-500/20 text-blue-300 border border-blue-500/40")
                    : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#f2f6fc] border border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]")
                }`}
              >
                All
              </button>

              {/* 4th: Simple Tab */}
              <button
                onClick={() => { setFilterType("simple"); setPage(1); setSelectedEmailIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "simple"
                    ? (theme === "light" ? "bg-[#e8def8] text-[#1d192b] border border-[#d0bcff]" : "bg-purple-500/20 text-purple-300 border border-purple-500/40")
                    : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#f2f6fc] border border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]")
                }`}
              >
                Simple
              </button>

              {/* 5th: Attachment Tab */}
              <button
                onClick={() => { setFilterType("with_attachments"); setPage(1); setSelectedEmailIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                  filterType === "with_attachments"
                    ? (theme === "light" ? "bg-[#c4eed0] text-[#072711] border border-[#6dd58c]" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")
                    : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#f2f6fc] border border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]")
                }`}
              >
                Attachment
              </button>

              {/* 6th: Pinned Tab */}
              <button
                onClick={() => { setFilterType("pinned"); setPage(1); setSelectedEmailIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                  filterType === "pinned"
                    ? (theme === "light" ? "bg-[#fee5d9] text-[#7a2e0b] border border-[#fdbb84]" : "bg-amber-500/20 text-amber-300 border border-amber-500/40")
                    : (theme === "light" ? "bg-white text-[#444746] hover:bg-[#f2f6fc] border border-[#dadce0]" : "bg-black/30 text-gray-400 hover:text-gray-200 border border-white/[0.05]")
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <path d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5h10zM15.5 3.5h-7a1 1 0 00-1 1v.5h9v-.5a1 1 0 00-1-1z" />
                </svg>
                <span>Pinned ({pinnedCount})</span>
              </button>

              {/* 7th: Media Gallery Drawer Trigger */}
              <button
                onClick={() => openMediaSheet()}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isMediaSheetOpen
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    : (theme === "light" ? "bg-white text-[#673ab7] hover:bg-[#f3e8fd] border border-[#d0bcff]" : "bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20")
                }`}
                title="Open Media & Attachments Sheet (Slide-over)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-purple-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span>Media &amp; Files</span>
              </button>
            </div>
          </div>

          {/* Email List Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className={`animate-pulse flex flex-col gap-3 p-4 border-b ${
                    theme === "light" ? "border-[#e0e3e7] bg-white" : "border-white/[0.04] bg-white/[0.01]"
                  }`}>
                    <div className="flex justify-between items-center gap-4">
                      <div className={`h-4 rounded-md w-1/3 ${theme === "light" ? "bg-gray-200" : "bg-white/[0.06]"}`}></div>
                      <div className={`h-3 rounded-md w-12 ${theme === "light" ? "bg-gray-200" : "bg-white/[0.03]"}`}></div>
                    </div>
                    <div className={`h-4 rounded-md w-2/3 ${theme === "light" ? "bg-gray-100" : "bg-white/[0.03]"}`}></div>
                    <div className={`h-3 rounded-md w-full mt-1 ${theme === "light" ? "bg-gray-100" : "bg-white/[0.02]"}`}></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className={`p-4 m-4 rounded-xl text-xs font-medium flex items-start gap-3 border ${
                theme === "light" ? "bg-[#fce8e6] border-[#fad2cf] text-[#c5221f]" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mt-0.5 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            ) : isPinnedFilter && pinnedCount === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center">
                <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center border ${
                  theme === "light" ? "bg-[#f1f3f4] text-[#5f6368] border-[#dadce0]" : "bg-white/[0.02] text-gray-600 border-white/[0.05]"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                    <path d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5h10zM15.5 3.5h-7a1 1 0 00-1 1v.5h9v-.5a1 1 0 00-1-1z" />
                  </svg>
                </div>
                <p className={`font-bold text-base ${theme === "light" ? "text-[#202124]" : "text-gray-300"}`}>No Pinned Emails</p>
                <p className={`text-xs mt-1 ${theme === "light" ? "text-[#5f6368]" : "text-gray-500"}`}>
                  Click the pin icon on any email to save it here for quick access.
                </p>
              </div>
            ) : filterType === "trash" && emails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center">
                <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center border ${
                  theme === "light" ? "bg-[#fce8e6] text-[#c5221f] border-[#fad2cf]" : "bg-white/[0.02] text-gray-500 border-white/[0.05]"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className={`font-bold text-base ${theme === "light" ? "text-[#202124]" : "text-gray-300"}`}>Trash is Empty</p>
                <p className={`text-xs mt-1 ${theme === "light" ? "text-[#5f6368]" : "text-gray-500"}`}>
                  Emails moved to Trash will appear here. You can restore them or permanently delete them at any time.
                </p>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center">
                <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center border ${
                  theme === "light" ? "bg-[#f1f3f4] text-[#5f6368] border-[#dadce0]" : "bg-white/[0.02] text-gray-600 border-white/[0.05]"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className={`font-bold text-base ${theme === "light" ? "text-[#202124]" : "text-gray-300"}`}>No Emails Found</p>
                <p className={`text-xs mt-1 ${theme === "light" ? "text-[#5f6368]" : "text-gray-500"}`}>
                  {searchQuery ? `No matches for "${searchQuery}"` : "Inbound emails will stream here automatically in real time."}
                </p>
              </div>
            ) : (
              <div className={`flex flex-col divide-y ${
                theme === "light" ? "bg-[#ffffff] divide-[#f1f3f4]" : "bg-[#0b0f19]/40 divide-white/[0.04]"
              }`}>
                {visibleEmails.map(email => {
                  const isSelected = selectedEmail?.id === email.id;
                  const isChecked = selectedEmailIds.has(email.id);
                  const isRead = readEmails.has(email.id);
                  const isPinned = pinnedEmails.has(email.id);
                  const { name: senderName, email: senderEmail } = parseSender(email.sender);

                  return (
                    <div
                      key={email.id}
                      onClick={() => { setShowMedia(false); handleViewEmail(email); }}
                      className={`p-2.5 sm:p-3.5 cursor-pointer transition-all relative group ${
                        theme === "light"
                          ? isChecked
                            ? 'bg-[#d3e3fd]/60 border-l-4 border-l-[#1a73e8]'
                            : isSelected
                            ? 'bg-[#c2e7ff] hover:bg-[#b3d7ff] border-l-4 border-l-[#1a73e8]'
                            : (isRead ? 'bg-[#ffffff] hover:bg-[#f2f6fc] text-[#444746]' : 'bg-[#ffffff] hover:bg-[#f2f6fc] font-bold text-[#202124]')
                          : isChecked
                          ? 'bg-blue-500/[0.12] border-l-2 border-blue-400'
                          : isSelected
                          ? 'bg-blue-500/10'
                          : (isRead ? 'hover:bg-white/[0.03] opacity-80' : 'bg-blue-500/[0.03] hover:bg-blue-500/[0.06]')
                      }`}
                    >
                      {/* Left border indicator for Dark Mode */}
                      {theme === "dark" && isSelected && !isChecked && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                      )}

                      <div className="flex justify-between items-baseline mb-1.5 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          
                          {/* Checkmark Checkbox */}
                          <div
                            onClick={(e) => toggleSelectEmail(email.id, e)}
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                              isChecked
                                ? (theme === "light" ? "bg-[#1a73e8] border-[#1a73e8] text-white shadow-xs" : "bg-blue-500 border-blue-500 text-white shadow-sm")
                                : (theme === "light" ? "border-[#747775] bg-white hover:border-[#1a73e8]" : "border-white/20 bg-black/40 hover:border-blue-400 opacity-70 group-hover:opacity-100")
                            }`}
                            title={isChecked ? "Deselect" : "Select email"}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>

                          <span className={`truncate text-sm ${
                            theme === "light"
                              ? isSelected
                                ? 'text-[#001d35] font-extrabold'
                                : isChecked
                                ? 'text-[#041e49] font-bold'
                                : (isRead ? 'text-[#444746] font-normal' : 'text-[#202124] font-bold')
                              : isSelected
                              ? 'text-blue-300 font-bold'
                              : isChecked
                              ? 'text-blue-200 font-bold'
                              : (isRead ? 'text-gray-400 font-normal' : 'text-gray-100 font-bold')
                          }`}>
                            {senderName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          {filterType === "trash" ? (
                            <>
                              {/* Restore from Trash */}
                              <button
                                onClick={(e) => handleRestoreEmail(email.id, e)}
                                className={`opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded ${
                                  theme === "light" ? "text-[#5f6368] hover:text-[#137333] hover:bg-[#e6f4ea]" : "text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                }`}
                                title="Restore to Inbox"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                              </button>
                              {/* Permanently Delete */}
                              <button
                                onClick={(e) => handlePermanentDeleteEmail(email.id, e)}
                                className={`opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded ${
                                  theme === "light" ? "text-[#5f6368] hover:text-[#c5221f] hover:bg-[#fce8e6]" : "text-gray-500 hover:text-rose-400 hover:bg-rose-500/10"
                                }`}
                                title="Delete Permanently"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => togglePin(email.id, e)}
                                className={`p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded cursor-pointer ${
                                  isPinned
                                    ? "text-amber-500 opacity-100 bg-amber-500/10"
                                    : (theme === "light" ? "text-[#5f6368] hover:text-amber-500 hover:bg-[#f1f3f4]" : "text-gray-500 hover:text-amber-400 hover:bg-white/[0.06]")
                                }`}
                                title={isPinned ? "Unpin Email" : "Pin Email"}
                              >
                                {isPinned ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5h10zM15.5 3.5h-7a1 1 0 00-1 1v.5h9v-.5a1 1 0 00-1-1z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5m10 0H6.5m10 0a1 1 0 00-1-1h-7a1 1 0 00-1 1" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={(e) => handleMoveToTrash(email.id, e)}
                                className={`opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded ${
                                  theme === "light" ? "text-[#5f6368] hover:text-[#c5221f] hover:bg-[#fce8e6]" : "text-gray-500 hover:text-rose-400 hover:bg-rose-500/10"
                                }`}
                                title="Move to Trash"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                                </svg>
                              </button>
                            </>
                          )}
                          <span className={`text-[11px] font-medium font-mono whitespace-nowrap ${
                            theme === "light"
                              ? isSelected ? 'text-[#0b57d0] font-bold' : 'text-[#5f6368]'
                              : isSelected ? 'text-blue-400' : 'text-gray-500'
                          }`}>
                            {formatDate(email.created_at)}
                          </span>
                          {!isRead && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${
                              theme === "light" ? "bg-[#1a73e8] shadow-[0_0_6px_rgba(26,115,232,0.8)]" : "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                            }`} title="Unread"></span>
                          )}
                        </div>
                      </div>

                      {/* From mail */}
                      {senderEmail && (
                        <div className="mb-1.5 flex items-center gap-1.5 max-w-full">
                          <span className={`text-[10px] font-mono font-semibold flex-shrink-0 ${
                            theme === "light" ? "text-[#5f6368]" : "text-gray-500"
                          }`}>From:</span>
                          <span className={`text-[10px] font-mono truncate ${
                            theme === "light" ? "text-[#5f6368]" : "text-gray-400"
                          }`}>{senderEmail}</span>
                          {email.has_attachment === 1 && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 flex-shrink-0 ${
                              theme === "light" ? "text-[#137333]" : "text-emerald-400"
                            }`} aria-label="Has Attachment">
                              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      )}

                      <div className={`text-xs truncate ${
                        theme === "light"
                          ? isSelected
                            ? 'text-[#001d35] font-semibold'
                            : (isRead ? 'text-[#5f6368]' : 'text-[#1f1f1f] font-semibold')
                          : isSelected
                          ? 'text-blue-100 font-semibold'
                          : 'text-gray-300'
                      }`}>
                        {email.subject || "(No Subject)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SIDEBAR PAGINATION FOOTER (Max 200 emails per page) */}
          <div className={`relative z-10 flex-shrink-0 px-2 sm:px-3 pt-1 pb-2 sm:pb-3 border-t transition-colors ${
            theme === "light"
              ? "bg-[#ffffff] border-[#e0e3e7]"
              : "bg-[#0b0f19]/95 backdrop-blur-md border-white/[0.06]"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono whitespace-nowrap flex-shrink-0 ${
                theme === "light" ? "text-[#5f6368]" : "text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${totalRecords > 0 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-gray-600'}`}></span>
                {isPinnedFilter
                  ? `${pinnedCount} pinned`
                  : totalRecords > 0 ? `${startRecord}-${endRecord} of ${totalRecords}` : "0 emails"}
              </span>

              {/* Scrollable page tabs row */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-0.5 py-0.5 flex-1 min-w-0">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-[11px] font-bold font-mono rounded-lg border transition-all disabled:opacity-30 disabled:pointer-events-none ${
                    theme === "light"
                      ? "bg-white hover:bg-[#f1f3f4] text-[#444746] border-[#dadce0]"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 border-white/[0.06]"
                  }`}
                  title="Previous Page"
                >
                  ←
                </button>

                {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    id={`page-tab-${p}`}
                    onClick={() => setPage(p)}
                    disabled={loading}
                    className={`flex-shrink-0 min-w-[28px] h-7 px-1.5 text-[11px] font-bold font-mono rounded-lg border transition-all ${
                      p === page
                        ? (theme === "light"
                            ? "bg-[#c2e7ff] text-[#001d35] border-[#7fcfff] font-bold shadow-xs"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.2)]")
                        : (theme === "light"
                            ? "bg-white hover:bg-[#f1f3f4] text-[#5f6368] hover:text-[#202124] border-[#dadce0]"
                            : "bg-white/[0.03] hover:bg-white/[0.08] text-gray-500 hover:text-gray-200 border-white/[0.06] hover:border-white/[0.14]")
                    }`}
                    title={`Page ${p}`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || loading}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-[11px] font-bold font-mono rounded-lg border transition-all disabled:opacity-30 disabled:pointer-events-none ${
                    theme === "light"
                      ? "bg-white hover:bg-[#f1f3f4] text-[#444746] border-[#dadce0]"
                      : "bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 border-white/[0.06]"
                  }`}
                  title="Next Page"
                >
                  →
                </button>
              </div>

              {/* Limit Config & Max Tag */}
              <div className="flex items-center gap-1.5 ml-auto relative">
                {/* Config Button */}
                <button
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    isConfigOpen
                      ? (theme === "light" ? "bg-[#d2e3fc] border-[#1a73e8] text-[#1a73e8]" : "bg-blue-500/20 border-blue-500/40 text-blue-400")
                      : (theme === "light" ? "bg-white hover:bg-[#f1f3f4] border-[#dadce0] text-[#5f6368]" : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.06] text-gray-500 hover:text-gray-200")
                  }`}
                  title="Configure Emails Per Page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </button>
                
                {/* Config Popover */}
                {isConfigOpen && (
                  <div className={`absolute right-0 bottom-full mb-2 w-56 rounded-xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)] z-50 p-4 border overflow-hidden ${
                    theme === "light" ? "bg-white border-gray-200" : "bg-[#0b101e] border-white/[0.08]"
                  }`}>
                    <h4 className={`text-xs font-bold mb-3 ${theme === "light" ? "text-gray-800" : "text-gray-200"}`}>
                      Emails Per Page
                    </h4>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={customLimit}
                        onChange={(e) => setCustomLimit(e.target.value)}
                        className={`w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-all ${
                          theme === "light"
                            ? "bg-gray-100 border border-transparent focus:border-blue-500 text-gray-800"
                            : "bg-black/50 border border-white/[0.1] focus:border-blue-500/50 text-white"
                        }`}
                        min="1"
                        max="1000"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const newLimit = parseInt(customLimit) || 100;
                        setLimit(newLimit);
                        setPage(1);
                        setIsConfigOpen(false);
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Apply Changes
                    </button>
                  </div>
                )}
                
                <span className={`flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-lg border ${
                  theme === "light"
                    ? "bg-[#f1f3f4] border-[#dadce0] text-[#5f6368]"
                    : "bg-white/[0.03] border-white/[0.06] text-gray-500"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-blue-500">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5.5c0 .199.079.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.94V5z" clipRule="evenodd" />
                  </svg>
                  {isPinnedFilter ? "Pinned only" : `Max ${limit}/page`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Viewer / Compose Pane (Right Pane) */}
        <div className={`flex-1 flex-col overflow-hidden h-full relative transition-colors ${
          theme === "light" ? "bg-[#ffffff] text-[#202124]" : "bg-[#0b0f19] text-gray-200"
        } ${(selectedEmail || showCompose || showMedia) ? 'flex' : 'flex'}`}>

          {/* MEDIA LIBRARY VIEW */}
          {showMedia ? (
            <div className="flex flex-col flex-1 relative">
              {theme === "dark" && (
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full"></div>
              )}
              
              <div className={`px-4 sm:px-8 py-4 sm:py-6 border-b flex flex-wrap items-center justify-between gap-3 relative z-10 flex-shrink-0 transition-colors ${
                theme === "light" ? "bg-white border-[#e0e3e7]" : "bg-transparent border-white/[0.06]"
              }`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setShowMedia(false); setSidebarOpen(true); }} className={`md:hidden flex items-center justify-center rounded-full w-8 h-8 transition-colors ${
                    theme === "light" ? "text-[#5f6368] hover:text-[#202124] bg-[#f1f3f4]" : "text-gray-500 hover:text-white bg-white/[0.04]"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <h2 className={`text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 ${
                    theme === "light" ? "text-[#202124]" : "text-white"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-[#673ab7]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    Server Media Library
                  </h2>
                </div>
                <div className={`flex items-center gap-4 px-3 sm:px-4 py-2 rounded-xl border ${
                  theme === "light" ? "bg-[#f8f9fa] border-[#dadce0]" : "bg-white/[0.02] border-white/[0.05]"
                }`}>
                  <span className={`text-xs font-medium ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Total Media Size:</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatBytes(mediaFiles.reduce((acc, curr) => acc + (curr.size || 0), 0))}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative z-10 custom-scrollbar">
                {loadingMedia ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="w-10 h-10 border-4 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin"></div>
                  </div>
                ) : mediaFiles.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-64 ${theme === "light" ? "text-[#5f6368]" : "text-gray-500"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-16 h-16 mb-4 opacity-50">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className={`text-base font-bold ${theme === "light" ? "text-[#202124]" : "text-gray-400"}`}>No media attachments found</p>
                    <p className="text-xs mt-1">Attachments will automatically populate here when emails are received.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {mediaFiles.map((file, idx) => {
                      const isImage = file.contentType?.startsWith('image/') || file.filename?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i);
                      const isVideo = file.contentType?.startsWith('video/') || file.filename?.match(/\.(mp4|webm|ogg|mov)$/i);
                      const isPdf = file.contentType === 'application/pdf' || file.filename?.match(/\.pdf$/i);

                      return (
                        <div key={idx} className={`group relative rounded-2xl overflow-hidden border transition-all flex flex-col h-48 ${
                          theme === "light"
                            ? "bg-white border-[#dadce0] hover:border-[#1a73e8] hover:shadow-md"
                            : "bg-[#030712] border-white/[0.08] hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                        }`}>
                          {isImage ? (
                            <div className="absolute inset-0 bg-black">
                              <img src={file.url} alt={file.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent opacity-90 group-hover:opacity-70 transition-opacity"></div>
                            </div>
                          ) : isVideo ? (
                            <div className="absolute inset-0 bg-black overflow-hidden">
                              <video src={file.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" muted loop autoPlay playsInline />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent opacity-90 group-hover:opacity-70 transition-opacity pointer-events-none"></div>
                            </div>
                          ) : isPdf ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-rose-500/50 group-hover:text-rose-400 transition-colors">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02] group-hover:bg-blue-500/5 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-blue-500/40 group-hover:text-blue-400 transition-colors">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                          )}

                          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={file.url}
                              download={file.filename}
                              target="_blank"
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                              Save
                            </a>
                          </div>

                          <div className="relative z-10 p-3 h-full flex flex-col justify-end">
                            <p className="text-xs font-semibold text-gray-200 truncate w-full" title={file.filename}>
                              {file.filename}
                            </p>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{formatBytes(file.size)}</span>
                              <span className="text-[10px] text-gray-500">{formatDate(file.date)}</span>
                            </div>
                            {file.recipient && (
                              <div className="mt-1">
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 block truncate">
                                  To: {file.recipient}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : showCompose ? (
            /* COMPOSE MESSAGE VIEW (Gmail Style) */
            <div className={`flex flex-col flex-1 relative min-h-0 ${theme === "light" ? "bg-[#ffffff]" : "bg-transparent"}`}>
              {theme === "dark" && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              )}
              <div className={`px-4 sm:px-8 py-4 sm:py-6 border-b flex justify-between items-center gap-3 relative z-10 flex-shrink-0 ${
                theme === "light" ? "bg-white border-[#e0e3e7]" : "bg-transparent border-white/[0.06]"
              }`}>
                <h2 className={`text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3 ${
                  theme === "light" ? "text-[#202124]" : "text-white"
                }`}>
                  <button onClick={() => { setShowCompose(false); setSidebarOpen(true); }} className={`md:hidden flex items-center justify-center rounded-full w-8 h-8 mr-1 sm:mr-2 transition-colors ${
                    theme === "light" ? "text-[#5f6368] hover:text-[#202124] bg-[#f1f3f4]" : "text-gray-500 hover:text-white bg-white/[0.04]"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  New Message (Outbound SMTP)
                </h2>
                <button onClick={() => setShowCompose(false)} className={`p-2 rounded-xl transition-colors ${
                  theme === "light" ? "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]" : "text-gray-500 hover:text-white hover:bg-white/[0.08]"
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 bg-transparent relative z-10 min-h-0">
                <div className={`px-3 sm:px-8 py-3 sm:py-4 border-b flex items-center gap-2 transition-colors flex-shrink-0 ${
                  theme === "light"
                    ? "bg-[#f8f9fa] border-[#e0e3e7] focus-within:bg-white"
                    : "bg-black/20 border-white/[0.04] focus-within:bg-black/30"
                }`}>
                  <label className={`text-xs font-bold uppercase tracking-wider w-16 sm:w-20 font-mono flex-shrink-0 ${
                    theme === "light" ? "text-[#5f6368]" : "text-gray-400"
                  }`}>To:</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className={`flex-1 bg-transparent text-sm focus:outline-none font-medium font-mono min-w-0 ${
                      theme === "light" ? "text-[#202124] placeholder:text-[#5f6368]" : "text-white placeholder:text-gray-600"
                    }`}
                  />
                </div>
                <div className={`px-3 sm:px-8 py-3 sm:py-4 border-b flex items-center gap-2 transition-colors flex-shrink-0 ${
                  theme === "light"
                    ? "bg-[#f8f9fa] border-[#e0e3e7] focus-within:bg-white"
                    : "bg-black/20 border-white/[0.04] focus-within:bg-black/30"
                }`}>
                  <label className={`text-xs font-bold uppercase tracking-wider w-16 sm:w-20 font-mono flex-shrink-0 ${
                    theme === "light" ? "text-[#5f6368]" : "text-gray-400"
                  }`}>Subject:</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className={`flex-1 bg-transparent text-sm focus:outline-none font-medium min-w-0 ${
                      theme === "light" ? "text-[#202124] placeholder:text-[#5f6368]" : "text-white placeholder:text-gray-600"
                    }`}
                  />
                </div>
                <div className={`flex flex-col flex-1 px-3 sm:px-8 py-4 sm:py-6 min-h-0 ${
                  theme === "light" ? "bg-white" : "bg-black/40"
                }`}>
                  <textarea
                    value={composeMessage}
                    onChange={e => setComposeMessage(e.target.value)}
                    required
                    placeholder="Write your email body..."
                    className={`w-full flex-1 bg-transparent text-sm focus:outline-none resize-none font-sans leading-relaxed ${
                      theme === "light" ? "text-[#202124] placeholder:text-[#5f6368]" : "text-gray-300 placeholder:text-gray-600"
                    }`}
                  ></textarea>
                </div>
                <div className={`p-3 sm:p-6 border-t flex justify-between items-center flex-shrink-0 gap-2 ${
                  theme === "light" ? "bg-[#ffffff] border-[#e0e3e7]" : "bg-[#030712] border-white/[0.06]"
                }`}>
                  <button type="button" onClick={() => setShowCompose(false)} className={`flex items-center gap-1.5 font-semibold px-3 py-2 transition-colors text-sm ${
                    theme === "light" ? "text-[#5f6368] hover:text-[#c5221f]" : "text-gray-500 hover:text-rose-400"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    <span className="hidden sm:inline">Discard</span>
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className={`font-extrabold px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 active:scale-[0.98] whitespace-nowrap ${
                      theme === "light"
                        ? "bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-md"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    }`}
                  >
                    {sending ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 -ml-1">
                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">Dispatch Email</span>
                    <span className="sm:hidden">Send</span>
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEmail ? (
            /* EMAIL READING PANE (FULL UNIFIED SCROLL - GMAIL STYLE) */
            <div className={`flex-1 overflow-y-auto custom-scrollbar relative min-h-0 flex flex-col transition-colors ${
              theme === "light" ? "bg-[#ffffff]" : "bg-[#0b0f19]"
            }`}>
              {theme === "dark" && (
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              )}

              {/* Trash Notice Banner */}
              {(filterType === "trash" || selectedEmail.is_deleted === 1) && (
                <div className={`border-b px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs relative z-20 shrink-0 ${
                  theme === "light"
                    ? "bg-[#fce8e6] border-[#fad2cf] text-[#c5221f]"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                }`}>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-rose-500 shrink-0">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                    <span>This email is in your <strong>Trash</strong> folder.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreEmail(selectedEmail.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        theme === "light"
                          ? "bg-[#c4eed0] hover:bg-[#b2e8c0] text-[#072711] border-[#6dd58c]"
                          : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      Restore to Inbox
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteEmail(selectedEmail.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        theme === "light"
                          ? "bg-[#fce8e6] hover:bg-[#fad2cf] text-[#c5221f] border-[#f5b7b1]"
                          : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      Delete Permanently
                    </button>
                  </div>
                </div>
              )}

              {/* Main Reading View (Header, Metadata, Content & Attachments all scrolling together in Gmail layout) */}
              <div className="p-4 sm:p-8 space-y-4 max-w-5xl w-full mx-auto relative z-10">
                {/* Top Action Toolbar */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setSelectedEmail(null); setSidebarOpen(true); }} 
                      className={`flex items-center justify-center rounded-lg h-8 px-2.5 gap-1.5 border text-xs font-semibold transition-colors cursor-pointer ${
                        theme === "light"
                          ? "border-[#dadce0] bg-white text-[#444746] hover:bg-[#f1f3f4]"
                          : "border-[#3c4043] bg-[#1e1f20] text-[#c4c7c5] hover:text-white hover:bg-[#2d2e30]"
                      }`}
                      title="Back to inbox"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                      <span className="hidden sm:inline">Back</span>
                    </button>
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                      theme === "light"
                        ? "text-[#1a73e8] bg-[#e8f0fe] border-[#d2e3fc]"
                        : "text-blue-400 bg-blue-500/10 border-blue-500/20"
                    }`}>
                      Message Details
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setViewMode(viewMode === "html" ? "text" : "html")}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition-colors whitespace-nowrap cursor-pointer ${
                        theme === "light"
                          ? "bg-white hover:bg-[#f1f3f4] text-[#444746] border-[#dadce0]"
                          : "bg-[#1e1f20] hover:bg-[#2d2e30] text-[#c4c7c5] border-[#3c4043]"
                      }`}
                    >
                      {viewMode === "html" ? "View Raw Text" : "View HTML Render"}
                    </button>
                    {filterType === "trash" || selectedEmail.is_deleted === 1 ? (
                      <>
                        <button
                          onClick={() => handleRestoreEmail(selectedEmail.id)}
                          className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            theme === "light"
                              ? "text-[#137333] bg-[#e6f4ea] hover:bg-[#ceead6] border-[#ceead6]"
                              : "text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
                          }`}
                          title="Restore to Inbox"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                          </svg>
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteEmail(selectedEmail.id)}
                          className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            theme === "light"
                              ? "text-[#c5221f] bg-[#fce8e6] hover:bg-[#fad2cf] border-[#fad2cf]"
                              : "text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30"
                          }`}
                          title="Delete Permanently"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                          </svg>
                          <span>Delete Permanently</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleMoveToTrash(selectedEmail.id)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          theme === "light"
                            ? "text-[#5f6368] hover:text-[#c5221f] hover:bg-[#fce8e6] border-[#dadce0]"
                            : "text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border-[#3c4043]"
                        }`}
                        title="Move to Trash"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Email Subject Heading (Gmail style clean title) */}
                <div className="py-2 px-1">
                  <h1 className={`text-xl sm:text-2xl font-bold tracking-tight leading-snug break-words ${
                    theme === "light" ? "text-[#202124]" : "text-[#e8eaed]"
                  }`}>
                    {selectedEmail.subject || "(No Subject)"}
                  </h1>
                </div>

                {/* Seamless Gmail Message Layout (No Card Background) */}
                <div className="w-full transition-colors">
                  {/* Sender & Recipient Header */}
                  <div className="py-2.5 px-1">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Avatar + Sender Info */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Circle Avatar with Sender Initial */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base shrink-0 shadow-xs select-none ${
                          getAvatarColor(selectedEmail.sender)
                        }`}>
                          {(parseSender(selectedEmail.sender).name || selectedEmail.sender || "U")[0].toUpperCase()}
                        </div>

                        {/* Sender Name, Email & Recipient */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className={`font-bold text-sm sm:text-base truncate ${
                              theme === "light" ? "text-[#202124]" : "text-[#e8eaed]"
                            }`}>
                              {parseSender(selectedEmail.sender).name || parseSender(selectedEmail.sender).email}
                            </span>
                            {parseSender(selectedEmail.sender).email && parseSender(selectedEmail.sender).name !== parseSender(selectedEmail.sender).email && (
                              <span className={`text-xs font-mono truncate ${
                                theme === "light" ? "text-[#5f6368]" : "text-[#9aa0a6]"
                              }`}>
                                &lt;{parseSender(selectedEmail.sender).email}&gt;
                              </span>
                            )}
                          </div>

                          {/* to: recipient */}
                          <div className={`text-xs flex items-center gap-1 mt-0.5 ${
                            theme === "light" ? "text-[#5f6368]" : "text-[#9aa0a6]"
                          }`}>
                            <span>to</span>
                            <span className={`font-medium ${
                              theme === "light" ? "text-[#202124]" : "text-[#c4c7c5]"
                            }`}>
                              {selectedEmail.recipient || "me"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Date, Time & Star Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs whitespace-nowrap hidden sm:inline ${
                          theme === "light" ? "text-[#5f6368]" : "text-[#9aa0a6]"
                        }`}>
                          {formatDate(selectedEmail.created_at)} ({getFullDate(selectedEmail.created_at)})
                        </span>
                        <span className={`text-xs whitespace-nowrap sm:hidden ${
                          theme === "light" ? "text-[#5f6368]" : "text-[#9aa0a6]"
                        }`}>
                          {formatDate(selectedEmail.created_at)}
                        </span>

                        {/* Pin / Unpin Button */}
                        <button
                          onClick={() => togglePin(selectedEmail.id)}
                          className={`p-1.5 rounded-full transition-all cursor-pointer ${
                            pinnedEmails.has(selectedEmail.id)
                              ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                              : theme === "light"
                                ? "text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4]"
                                : "text-gray-400 hover:text-white hover:bg-white/[0.08]"
                          }`}
                          title={pinnedEmails.has(selectedEmail.id) ? "Unpin Email" : "Pin Email"}
                        >
                          {pinnedEmails.has(selectedEmail.id) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5h10zM15.5 3.5h-7a1 1 0 00-1 1v.5h9v-.5a1 1 0 00-1-1z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 4.5v4.879a1.5 1.5 0 00.44 1.06l1.62 1.621A1.5 1.5 0 0117.5 14.5H13v6a1 1 0 01-2 0v-6H6.5a1.5 1.5 0 01-1.06-2.44l1.62-1.62a1.5 1.5 0 00.44-1.06V4.5m10 0H6.5m10 0a1 1 0 00-1-1h-7a1 1 0 00-1 1" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hairline Divider */}
                  <div className={`border-b my-3 ${
                    theme === "light" ? "border-[#e0e3e7]" : "border-white/[0.08]"
                  }`} />

                  {/* Message Body (Transparent Background) */}
                  <div className="py-3 px-1">
                    {selectedEmail.details ? (
                      <div>
                        {/* HTML View (Transparent background seamless rendering) */}
                        {viewMode === "html" && selectedEmail.details.html ? (
                          <div className="w-full bg-transparent">
                            <iframe
                              srcDoc={`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {
    background-color: transparent !important;
    color: ${theme === "light" ? "#202124" : "#e8eaed"};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
    padding: 4px 0;
    word-break: break-word;
  }
  a { color: ${theme === "light" ? "#1a73e8" : "#8ab4f8"}; text-decoration: underline; }
  a:hover { color: ${theme === "light" ? "#1557b0" : "#aecbfa"}; }
  img { max-width: 100%; height: auto; display: inline-block; }
  table { max-width: 100% !important; }
  blockquote {
    border-left: 3px solid ${theme === "light" ? "#dadce0" : "#5f6368"};
    margin: 12px 0;
    padding-left: 16px;
    color: ${theme === "light" ? "#5f6368" : "#9aa0a6"};
  }
  pre, code {
    background: ${theme === "light" ? "#f1f3f4" : "rgba(255,255,255,0.06)"};
    color: ${theme === "light" ? "#202124" : "#e8eaed"};
    border-radius: 4px;
    font-family: monospace;
    padding: 2px 4px;
  }
</style>
</head>
<body>
  ${selectedEmail.details.html}
</body>
</html>`}
                              className="w-full block border-0 bg-transparent"
                              style={{ backgroundColor: "transparent" }}
                              title="Email Content"
                              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                              onLoad={(e) => {
                                const iframe = e.target as HTMLIFrameElement;
                                try {
                                  const height = Math.max(
                                    iframe.contentWindow?.document.documentElement.scrollHeight || 0,
                                    iframe.contentWindow?.document.body.scrollHeight || 0
                                  );
                                  if (height > 0) {
                                    iframe.style.height = (height + 20) + 'px';
                                  }
                                } catch (err) {}
                              }}
                            />
                          </div>
                        ) : (
                          /* Text View (Transparent background) */
                          <div className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap select-text font-sans bg-transparent ${
                            theme === "light" ? "text-[#202124]" : "text-[#e8eaed]"
                          }`}>
                            {selectedEmail.details.text || "(This message has no plain text content)"}
                          </div>
                        )}

                        {/* Attachments Section */}
                        {selectedEmail.details.attachments && selectedEmail.details.attachments.length > 0 && (
                          <div className={`mt-8 pt-5 border-t ${
                            theme === "light" ? "border-[#e0e3e7]" : "border-white/[0.08]"
                          }`}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 font-mono ${
                              theme === "light" ? "text-[#5f6368]" : "text-[#9aa0a6]"
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
                                <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                              </svg>
                              Attachments ({selectedEmail.details.attachments.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {selectedEmail.details.attachments.map((att, idx) => {
                                const isBase64Img = att.content && (att.content.startsWith('iVBORw0K') || att.content.startsWith('/9j/') || att.content.startsWith('R0lGOD') || att.content.startsWith('UklGR'));
                                const isImage = att.contentType?.startsWith('image/') || att.filename?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i) || isBase64Img;

                                const getImgSrc = () => {
                                  if (att.content?.startsWith('iVBORw0K')) return `data:image/png;base64,${att.content}`;
                                  if (att.content?.startsWith('/9j/')) return `data:image/jpeg;base64,${att.content}`;
                                  if (att.content?.startsWith('R0lGOD')) return `data:image/gif;base64,${att.content}`;
                                  if (att.content?.startsWith('UklGR')) return `data:image/webp;base64,${att.content}`;
                                  return att.url || `data:${att.contentType || 'image/png'};base64,${att.content}`;
                                };

                                return (
                                  <a
                                    key={idx}
                                    href={att.url || getImgSrc()}
                                    download={att.filename}
                                    target="_blank"
                                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all group relative overflow-hidden ${
                                      theme === "light"
                                        ? "bg-white border-[#dadce0] hover:border-[#1a73e8] hover:shadow-md text-[#202124]"
                                        : "bg-[#2d2e30] border-[#3c4043] hover:bg-[#35373a] hover:border-blue-400/50 text-[#e8eaed]"
                                    }`}
                                  >
                                    {isImage ? (
                                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#dadce0] dark:border-[#3c4043] bg-black relative shadow-sm">
                                        <img src={getImgSrc()} alt={att.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 opacity-90 group-hover:opacity-100" />
                                      </div>
                                    ) : (
                                      <div className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-colors shadow-xs flex-shrink-0 ${
                                        theme === "light"
                                          ? "bg-[#e8f0fe] border-[#d2e3fc] text-[#1a73e8]"
                                          : "bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20"
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-bold truncate ${
                                        theme === "light" ? "text-[#202124]" : "text-[#e8eaed] group-hover:text-white"
                                      }`}>{att.filename}</p>
                                      <p className={`text-[10px] font-mono mt-0.5 ${
                                        theme === "light" ? "text-[#1a73e8]" : "text-gray-400 group-hover:text-blue-400"
                                      }`}>{formatBytes(att.size)}</p>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-3 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* EMPTY SELECTION STATE */
            <div className={`flex-1 flex flex-col items-center justify-center p-8 h-full relative z-10 transition-colors ${
              theme === "light" ? "bg-[#f6f8fc] text-[#5f6368]" : "bg-[#030712]/80 text-gray-500"
            }`}>
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 border transition-colors ${
                theme === "light"
                  ? "bg-white border-[#dadce0] shadow-xs text-[#5f6368]"
                  : "bg-[#0b0f19] border-white/[0.04] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] text-gray-600"
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className={`text-xl font-bold mb-1.5 tracking-tight ${
                theme === "light" ? "text-[#202124]" : "text-gray-300"
              }`}>Select an Email to Inspect</p>
              <p className={`text-xs max-w-sm text-center ${
                theme === "light" ? "text-[#5f6368]" : "text-gray-500"
              }`}>
                Click any message from the primary domain live feed on the left to read HTML bodies, inspect raw headers, and download media.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* RIGHT SHEET (DRAWER) FOR MEDIA & ATTACHMENTS GALLERY       */}
      {/* ========================================================= */}
      {isMediaSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMediaSheetOpen(false)}
          ></div>

          <div className="fixed inset-y-0 right-0 max-w-xl sm:max-w-2xl w-full flex pl-3 sm:pl-6 z-50">
            <div className={`w-full border-l shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden transition-colors ${
              theme === "light"
                ? "bg-[#ffffff] border-[#dadce0] text-[#202124]"
                : "bg-[#050a15] border-white/10 text-white"
            }`}>
              
              {/* Top Navigation Header */}
              <div className={`px-5 py-4 border-b flex items-center justify-between backdrop-blur-md shrink-0 ${
                theme === "light" ? "bg-[#f8f9fa] border-[#dadce0]" : "bg-[#0a0f1d]/90 border-white/[0.08]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm sm:text-base font-bold ${theme === "light" ? "text-[#202124]" : "text-white"}`}>
                        Mailbox Media &amp; Files
                      </h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        {mediaFiles.length} files
                      </span>
                    </div>
                    <p className={`text-[11px] ${theme === "light" ? "text-gray-500" : "text-gray-400"}`}>
                      All images, videos, and document attachments received
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-xl border text-right ${
                    theme === "light" ? "bg-white border-gray-200" : "bg-white/[0.03] border-white/[0.06]"
                  }`}>
                    <span className="text-[10px] text-gray-500 block uppercase tracking-wider font-mono">Storage Used</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {formatBytes(mediaFiles.reduce((acc, f) => acc + (f.size || 0), 0))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMediaSheetOpen(false)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      theme === "light" ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white"
                    }`}
                    title="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Pills */}
              <div className={`p-4 border-b space-y-3 shrink-0 ${
                theme === "light" ? "bg-white border-[#dadce0]" : "bg-[#060a14] border-white/[0.06]"
              }`}>
                <div className="relative">
                  <input
                    type="text"
                    value={mediaSearchQuery}
                    onChange={(e) => setMediaSearchQuery(e.target.value)}
                    placeholder="Search by filename, extension (.pdf, .png, .mp4)..."
                    className={`w-full text-xs rounded-xl px-3.5 py-2 pl-9 focus:outline-none transition-all font-mono ${
                      theme === "light"
                        ? "bg-gray-100 border border-gray-300 text-gray-900 focus:border-purple-500"
                        : "bg-white/[0.03] border border-white/[0.08] text-white focus:border-purple-500/50"
                    }`}
                  />
                  <svg className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>

                {/* Filter Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: "all", label: "All Files", count: mediaFiles.length },
                    { id: "images", label: "Images", count: mediaFiles.filter(f => getMediaCategory(f) === "images").length },
                    { id: "videos", label: "Videos", count: mediaFiles.filter(f => getMediaCategory(f) === "videos").length },
                    { id: "documents", label: "Documents", count: mediaFiles.filter(f => getMediaCategory(f) === "documents").length },
                    { id: "others", label: "Others", count: mediaFiles.filter(f => getMediaCategory(f) === "others").length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMediaCategoryFilter(tab.id as any)}
                      className={`text-[11px] font-mono px-3 py-1 rounded-lg shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        mediaCategoryFilter === tab.id
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                          : theme === "light"
                          ? "text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200"
                          : "text-gray-400 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04]"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] opacity-70">({tab.count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-grow custom-scrollbar">
                {loadingMedia ? (
                  <div className="flex flex-col justify-center items-center h-64 gap-3">
                    <div className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                    <span className="text-xs font-mono text-gray-500">Loading attachments...</span>
                  </div>
                ) : mediaFiles.filter(file => {
                  const matchesSearch = !mediaSearchQuery || 
                    file.filename.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
                    (file.subject && file.subject.toLowerCase().includes(mediaSearchQuery.toLowerCase())) ||
                    (file.sender && file.sender.toLowerCase().includes(mediaSearchQuery.toLowerCase()));
                  const cat = getMediaCategory(file);
                  const matchesCat = mediaCategoryFilter === "all" || cat === mediaCategoryFilter;
                  return matchesSearch && matchesCat;
                }).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-300">No attachments found</p>
                    <p className="text-xs text-gray-500 mt-1">Attachments will appear here automatically when emails arrive.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                    {mediaFiles.filter(file => {
                      const matchesSearch = !mediaSearchQuery || 
                        file.filename.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
                        (file.subject && file.subject.toLowerCase().includes(mediaSearchQuery.toLowerCase())) ||
                        (file.sender && file.sender.toLowerCase().includes(mediaSearchQuery.toLowerCase()));
                      const cat = getMediaCategory(file);
                      const matchesCat = mediaCategoryFilter === "all" || cat === mediaCategoryFilter;
                      return matchesSearch && matchesCat;
                    }).map((file, idx) => {
                      const category = getMediaCategory(file);
                      const ext = getFileExtension(file.filename);
                      const badgeStyle = getExtensionBadgeStyle(ext);

                      return (
                        <div
                          key={idx}
                          onClick={() => setPreviewModalFile(file)}
                          className={`group relative rounded-2xl border overflow-hidden flex flex-col justify-between cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                            theme === "light"
                              ? "bg-white border-gray-200 hover:border-purple-500 hover:shadow-purple-500/10"
                              : "bg-[#070c18] border-white/[0.08] hover:border-purple-500/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]"
                          }`}
                        >
                          {/* Thumbnail Area */}
                          <div className="relative h-28 w-full overflow-hidden bg-black/40 flex items-center justify-center">
                            {category === "images" ? (
                              <img
                                src={file.url}
                                alt={file.filename}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : category === "videos" ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-black">
                                <video src={file.url} className="w-full h-full object-cover opacity-60 pointer-events-none" muted />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                                  <div className="w-9 h-9 rounded-full bg-purple-500/80 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Document & Other File Formats (Shows text extension) */
                              <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${badgeStyle.glow} p-3`}>
                                <span className={`text-xl sm:text-2xl font-black font-mono tracking-widest px-2.5 py-1 rounded-xl border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} shadow-inner`}>
                                  .{ext}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider">
                                  {file.contentType ? file.contentType.split("/")[1] || ext : ext}
                                </span>
                              </div>
                            )}

                            {/* Type Badge */}
                            <div className="absolute top-2 left-2">
                              <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
                                category === "images"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 backdrop-blur-md"
                                  : category === "videos"
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 backdrop-blur-md"
                                  : `${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} backdrop-blur-md`
                              }`}>
                                {ext}
                              </span>
                            </div>

                            {/* Hover View overlay */}
                            <div className="absolute inset-0 bg-purple-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="text-[11px] font-bold font-mono text-white bg-purple-600/80 px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Preview
                              </span>
                            </div>
                          </div>

                          {/* Card Details */}
                          <div className="p-2.5 flex flex-col justify-between flex-grow">
                            <div>
                              <p className="text-xs font-semibold text-gray-200 truncate" title={file.filename}>
                                {file.filename}
                              </p>
                              {file.subject && (
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                  {file.subject}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.04] text-[10px] font-mono">
                              <span className="text-purple-400 font-bold">{formatBytes(file.size)}</span>
                              <span className="text-gray-500">{formatDate(file.date).split(",")[0]}</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer of Drawer */}
              <div className={`p-4 border-t flex items-center justify-between text-xs font-mono shrink-0 ${
                theme === "light" ? "bg-[#f8f9fa] border-[#dadce0] text-gray-600" : "bg-[#060a14] border-white/[0.08] text-gray-400"
              }`}>
                <span>Showing {mediaFiles.filter(file => {
                  const matchesSearch = !mediaSearchQuery || 
                    file.filename.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
                    (file.subject && file.subject.toLowerCase().includes(mediaSearchQuery.toLowerCase())) ||
                    (file.sender && file.sender.toLowerCase().includes(mediaSearchQuery.toLowerCase()));
                  const cat = getMediaCategory(file);
                  const matchesCat = mediaCategoryFilter === "all" || cat === mediaCategoryFilter;
                  return matchesSearch && matchesCat;
                }).length} of {mediaFiles.length} attachments</span>
                <button
                  onClick={() => openMediaSheet()}
                  disabled={loadingMedia}
                  className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  title="Refresh media files"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className={`w-3.5 h-3.5 ${loadingMedia ? "animate-spin" : ""}`}
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

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LARGE POPUP / LIGHTBOX MODAL FOR MEDIA PREVIEW             */}
      {/* ========================================================= */}
      {previewModalFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setPreviewModalFile(null)}
          ></div>

          {/* Modal Card */}
          <div className={`relative z-10 max-w-4xl w-full max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up ${
            theme === "light"
              ? "bg-white border-gray-300 text-gray-900"
              : "bg-[#080d1a] border-white/[0.12] text-white"
          }`}>
            
            {/* Modal Top Bar */}
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between backdrop-blur-sm bg-black/20">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg border uppercase ${
                  getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).bg
                } ${getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).text} ${
                  getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).border
                }`}>
                  .{getFileExtension(previewModalFile.filename)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold truncate" title={previewModalFile.filename}>
                    {previewModalFile.filename}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                    <span>{formatBytes(previewModalFile.size)}</span>
                    <span>•</span>
                    <span>{formatDate(previewModalFile.date)}</span>
                    {previewModalFile.sender && (
                      <>
                        <span>•</span>
                        <span className="truncate">From: {previewModalFile.sender}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.filename}
                  className="text-xs font-bold font-mono px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  <span>Download</span>
                </a>
                <a
                  href={previewModalFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Open in new tab"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
                <button
                  onClick={() => setPreviewModalFile(null)}
                  className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.15] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Preview Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-black/40 min-h-[300px]">
              {getMediaCategory(previewModalFile) === "images" ? (
                <img
                  src={previewModalFile.url}
                  alt={previewModalFile.filename}
                  className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-2xl"
                />
              ) : getMediaCategory(previewModalFile) === "videos" ? (
                <video
                  src={previewModalFile.url}
                  controls
                  autoPlay
                  className="max-h-[65vh] max-w-full rounded-xl shadow-2xl bg-black"
                />
              ) : previewModalFile.filename.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewModalFile.url}
                  className="w-full h-[65vh] rounded-xl border border-white/10 bg-white"
                  title={previewModalFile.filename}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border ${
                    getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).bg
                  } ${getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).border} mb-4 shadow-xl`}>
                    <span className={`text-2xl font-black font-mono ${getExtensionBadgeStyle(getFileExtension(previewModalFile.filename)).text}`}>
                      .{getFileExtension(previewModalFile.filename)}
                    </span>
                  </div>
                  <h4 className="text-base font-bold mb-1">{previewModalFile.filename}</h4>
                  <p className="text-xs text-gray-400 font-mono mb-6">
                    {formatBytes(previewModalFile.size)} • {previewModalFile.contentType || "Binary file"}
                  </p>
                  <a
                    href={previewModalFile.url}
                    download={previewModalFile.filename}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    <span>Download {previewModalFile.filename}</span>
                  </a>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RIGHT SHEET (DRAWER) FOR SERVER SETTINGS (IMAP/POP)        */}
      {/* ========================================================= */}
      {isSettingsSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSettingsSheetOpen(false)}
          ></div>

          <div className="fixed inset-y-0 right-0 max-w-lg w-full flex pl-3 sm:pl-6 z-50">
            <div className={`w-full border-l shadow-2xl flex flex-col justify-between animate-slide-left overflow-hidden transition-colors ${
              theme === "light"
                ? "bg-[#ffffff] border-[#dadce0] text-[#202124]"
                : "bg-[#000000] sm:bg-[#121214] border-white/10 text-white"
            }`}>
              
              {/* Navigation Bar */}
              <div className={`px-4 py-3 border-b flex items-center justify-between backdrop-blur-md shrink-0 ${
                theme === "light"
                  ? "bg-[#f8f9fa] border-[#dadce0]"
                  : "bg-[#1C1C1E]/80 border-white/[0.08]"
              }`}>
                <button
                  type="button"
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className={`text-xs font-medium cursor-pointer ${
                    theme === "light" ? "text-[#1a73e8] hover:text-[#1557b0]" : "text-[#0A84FF] hover:text-[#409CFF]"
                  }`}
                >
                  Cancel
                </button>
                <div className="flex flex-col items-center text-center">
                  <h3 className={`text-xs font-semibold ${theme === "light" ? "text-[#202124]" : "text-white"}`}>Server Settings (IMAP/POP)</h3>
                  <span className={`text-[10px] font-mono truncate max-w-[200px] ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>{user?.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className={`text-xs font-semibold cursor-pointer ${
                    theme === "light" ? "text-[#1a73e8] hover:text-[#1557b0]" : "text-[#0A84FF] hover:text-[#409CFF]"
                  }`}
                >
                  Done
                </button>
              </div>

              {/* Drawer Content: Full Server Settings (IMAP / POP3 / SMTP) */}
              <div className="p-3.5 overflow-y-auto space-y-3 flex-grow">
                <div className="flex flex-col gap-3">
                  
                  {/* POP3 Group */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Incoming Server (POP3 — Gmail Web)
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        theme === "light" ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-white/[0.05] text-gray-400"
                      }`}>
                        Port 110 / 995 SSL
                      </span>
                    </div>

                    <div className={`rounded-xl border divide-y overflow-hidden text-xs ${
                      theme === "light"
                        ? "bg-[#f8f9fa] border-[#dadce0] divide-[#e0e3e7]"
                        : "bg-[#1C1C1E] border-white/[0.08] divide-white/[0.06]"
                    }`}>
                      
                      {/* Connected Server Node */}
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex flex-col shrink-0">
                          <span className={`text-[11px] font-medium ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>POP Server</span>
                          <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                        </div>
                        
                        <div className={`inline-flex items-stretch rounded-lg overflow-hidden border shadow-xs ${
                          theme === "light" ? "bg-white border-[#dadce0]" : "border-white/10 bg-black/40"
                        }`}>
                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-white hover:bg-[#f1f3f4]" : "bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{currentHost}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(currentHost, "pop_host")}
                              className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer"
                              title="Copy Domain"
                            >
                              {copiedKey === "pop_host" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className={`flex items-center justify-center px-1.5 border-x text-[9px] font-black uppercase tracking-wider select-none ${
                            theme === "light"
                              ? "bg-[#edf2fa] border-[#dadce0] text-amber-700"
                              : "bg-[#2C2C2E] border-white/10 text-amber-400"
                          }`}>
                            OR
                          </div>

                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-amber-50 hover:bg-amber-100" : "bg-amber-500/10 hover:bg-amber-500/15"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${
                              theme === "light" ? "text-amber-800" : "text-amber-300"
                            }`}>{serverIp}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(serverIp, "pop_ip")}
                              className="text-gray-400 hover:text-amber-500 p-0.5 cursor-pointer"
                              title="Copy Server IP"
                            >
                              {copiedKey === "pop_ip" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Port</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-right flex-1 pr-2">110 (Plain) / 995 (SSL)</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard("110", "pop_port")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Port"
                        >
                          {copiedKey === "pop_port" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>User Name</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{user?.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user?.email, "pop_user")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Username"
                        >
                          {copiedKey === "pop_user" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Password</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${
                          theme === "light" ? "text-amber-800" : "text-amber-300"
                        }`}>{userPassword || "••••••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(userPassword, "pop_pwd")}
                          className="text-gray-400 hover:text-amber-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Password"
                        >
                          {copiedKey === "pop_pwd" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                  {/* IMAP Group */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[10px] font-semibold text-[#1a73e8] dark:text-[#0A84FF] uppercase tracking-wider">
                        Incoming Server (IMAP — Apps & Mobile)
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        theme === "light" ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-white/[0.05] text-gray-400"
                      }`}>
                        Port 993 SSL / 143
                      </span>
                    </div>

                    <div className={`rounded-xl border divide-y overflow-hidden text-xs ${
                      theme === "light"
                        ? "bg-[#f8f9fa] border-[#dadce0] divide-[#e0e3e7]"
                        : "bg-[#1C1C1E] border-white/[0.08] divide-white/[0.06]"
                    }`}>
                      
                      {/* Connected Server Node */}
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex flex-col shrink-0">
                          <span className={`text-[11px] font-medium ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>IMAP Server</span>
                          <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                        </div>
                        
                        <div className={`inline-flex items-stretch rounded-lg overflow-hidden border shadow-xs ${
                          theme === "light" ? "bg-white border-[#dadce0]" : "border-white/10 bg-black/40"
                        }`}>
                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-white hover:bg-[#f1f3f4]" : "bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{currentHost}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(currentHost, "imap_host")}
                              className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer"
                              title="Copy Domain"
                            >
                              {copiedKey === "imap_host" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className={`flex items-center justify-center px-1.5 border-x text-[9px] font-black uppercase tracking-wider select-none ${
                            theme === "light"
                              ? "bg-[#edf2fa] border-[#dadce0] text-[#1a73e8]"
                              : "bg-[#2C2C2E] border-white/10 text-[#0A84FF]"
                          }`}>
                            OR
                          </div>

                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-blue-50 hover:bg-blue-100" : "bg-blue-500/10 hover:bg-blue-500/15"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${
                              theme === "light" ? "text-blue-700" : "text-blue-300"
                            }`}>{serverIp}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(serverIp, "imap_ip")}
                              className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer"
                              title="Copy Server IP"
                            >
                              {copiedKey === "imap_ip" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Port</span>
                        <span className="font-mono text-[#1a73e8] dark:text-[#0A84FF] font-semibold text-right flex-1 pr-2">993 (SSL) / 143</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard("993", "imap_port")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Port"
                        >
                          {copiedKey === "imap_port" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>User Name</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{user?.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user?.email, "imap_user")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Username"
                        >
                          {copiedKey === "imap_user" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Password</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${
                          theme === "light" ? "text-amber-800" : "text-amber-300"
                        }`}>{userPassword || "••••••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(userPassword, "imap_pwd")}
                          className="text-gray-400 hover:text-amber-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Password"
                        >
                          {copiedKey === "imap_pwd" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* SMTP Group */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-1">
                      <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        Outgoing Server (SMTP)
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                        theme === "light" ? "bg-[#f3e8fd] text-[#673ab7]" : "bg-white/[0.05] text-gray-400"
                      }`}>
                        Port 587 / 25 / 465
                      </span>
                    </div>

                    <div className={`rounded-xl border divide-y overflow-hidden text-xs ${
                      theme === "light"
                        ? "bg-[#f8f9fa] border-[#dadce0] divide-[#e0e3e7]"
                        : "bg-[#1C1C1E] border-white/[0.08] divide-white/[0.06]"
                    }`}>
                      
                      {/* Connected Server Node */}
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <div className="flex flex-col shrink-0">
                          <span className={`text-[11px] font-medium ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>SMTP Server</span>
                          <span className="text-[9px] text-gray-500 font-mono">Domain ya IP</span>
                        </div>
                        
                        <div className={`inline-flex items-stretch rounded-lg overflow-hidden border shadow-xs ${
                          theme === "light" ? "bg-white border-[#dadce0]" : "border-white/10 bg-black/40"
                        }`}>
                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-white hover:bg-[#f1f3f4]" : "bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{currentHost}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(currentHost, "smtp_host")}
                              className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer"
                              title="Copy Domain"
                            >
                              {copiedKey === "smtp_host" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className={`flex items-center justify-center px-1.5 border-x text-[9px] font-black uppercase tracking-wider select-none ${
                            theme === "light"
                              ? "bg-[#edf2fa] border-[#dadce0] text-purple-700"
                              : "bg-[#2C2C2E] border-white/10 text-purple-400"
                          }`}>
                            OR
                          </div>

                          <div className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                            theme === "light" ? "bg-purple-50 hover:bg-purple-100" : "bg-purple-500/10 hover:bg-purple-500/15"
                          }`}>
                            <span className={`font-semibold text-xs font-mono ${
                              theme === "light" ? "text-purple-700" : "text-purple-300"
                            }`}>{serverIp}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(serverIp, "smtp_ip")}
                              className="text-gray-400 hover:text-purple-500 p-0.5 cursor-pointer"
                              title="Copy Server IP"
                            >
                              {copiedKey === "smtp_ip" ? (
                                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Port</span>
                        <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold text-right flex-1 pr-2">587 (TLS) / 25 / 465 (SSL)</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard("587", "smtp_port")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Port"
                        >
                          {copiedKey === "smtp_port" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>User Name</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${theme === "light" ? "text-[#202124]" : "text-white"}`}>{user?.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user?.email, "smtp_user")}
                          className="text-gray-400 hover:text-blue-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Username"
                        >
                          {copiedKey === "smtp_user" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`text-[11px] font-medium w-20 shrink-0 ${theme === "light" ? "text-[#5f6368]" : "text-gray-400"}`}>Password</span>
                        <span className={`font-mono font-semibold truncate text-right flex-1 pr-2 ${
                          theme === "light" ? "text-amber-800" : "text-amber-300"
                        }`}>{userPassword || "••••••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(userPassword, "smtp_pwd")}
                          className="text-gray-400 hover:text-amber-500 p-0.5 cursor-pointer shrink-0"
                          title="Copy Password"
                        >
                          {copiedKey === "smtp_pwd" ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                  {/* Helpful Tip */}
                  <div className={`p-3 rounded-xl flex items-start gap-2 text-xs border ${
                    theme === "light"
                      ? "bg-[#e8f0fe] border-[#d2e3fc] text-[#1a73e8]"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-[#1a73e8]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <span>Connect Outlook, Gmail, Apple Mail, Thunderbird, or Laravel Mailer to this VPS email server seamlessly using standard IMAP/POP3 &amp; SMTP protocols.</span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-xs font-semibold rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce ${
          theme === "light"
            ? "bg-slate-800 text-white border-slate-700"
            : "bg-slate-900/90 text-white border-white/20"
        }`}>
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
