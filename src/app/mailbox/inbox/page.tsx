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
  const router = useRouter();

  // Core Data States
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [primaryDomain, setPrimaryDomain] = useState("mailserver10.com");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  // Filter & Search States
  const [filterType, setFilterType] = useState<"all" | "with_attachments" | "simple" | "pinned" | "trash" | "sent" | "drafts">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [trashCount, setTrashCount] = useState<number>(0);
  const [readEmails, setReadEmails] = useState<Set<number>>(new Set());
  const [pinnedEmails, setPinnedEmails] = useState<Set<number>>(new Set());
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Layout & UI States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [selectDropdownOpen, setSelectDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Compose Modal States (Gmail-Style Floating Window)
  const [showCompose, setShowCompose] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Media Sheet Drawer & Lightbox Modal States
  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<"all" | "images" | "videos" | "documents" | "others">("all");
  const [previewModalFile, setPreviewModalFile] = useState<MediaFile | null>(null);

  // Server Settings (IMAP/POP/SMTP) Drawer States
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [serverIp, setServerIp] = useState<string>(process.env.NEXT_PUBLIC_SERVER_IP || "187.52.117.2");
  const [userPassword, setUserPassword] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Theme initialization
  useEffect(() => {
    const savedTheme = (localStorage.getItem("mailbox_theme") as "dark" | "light") || "light";
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("mailbox_theme", nextTheme);
  };

  // Auth and Initial Fetch
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
      fetchServerSettings();
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

  // Smart polling every 6 seconds when tab is active
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

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setSelectDropdownOpen(false);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, []);

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

  const fetchEmailsSilent = async (token: string, curPage: number, curFilter: string, curSearch: string) => {
    try {
      const apiBase = getApiBaseUrl();
      const effFilter = curFilter === "pinned" ? "all" : (curFilter === "sent" || curFilter === "drafts" ? "all" : curFilter);
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
      const effFilter = curFilter === "pinned" ? "all" : (curFilter === "sent" || curFilter === "drafts" ? "all" : curFilter);
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
    // Mark as read immediately in state & localStorage
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
    if (!composeTo.trim()) {
      alert("Please enter a recipient email");
      return;
    }
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

      setToastMessage("Message sent successfully");
      setTimeout(() => setToastMessage(null), 3000);
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

  // Star / Pin Toggle
  const togglePin = (emailId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
        setToastMessage("Removed star");
      } else {
        next.add(emailId);
        setToastMessage("Starred email");
      }
      setTimeout(() => setToastMessage(null), 2000);
      localStorage.setItem("mailbox_pinned_emails", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Selection handlers
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

  const handleSelectFilter = (type: "all" | "none" | "read" | "unread" | "starred") => {
    if (type === "none") {
      setSelectedEmailIds(new Set());
    } else if (type === "all") {
      setSelectedEmailIds(new Set(visibleEmails.map(e => e.id)));
    } else if (type === "read") {
      setSelectedEmailIds(new Set(visibleEmails.filter(e => readEmails.has(e.id)).map(e => e.id)));
    } else if (type === "unread") {
      setSelectedEmailIds(new Set(visibleEmails.filter(e => !readEmails.has(e.id)).map(e => e.id)));
    } else if (type === "starred") {
      setSelectedEmailIds(new Set(visibleEmails.filter(e => pinnedEmails.has(e.id)).map(e => e.id)));
    }
    setSelectDropdownOpen(false);
  };

  // Trash & Permanent Deletion
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
        setToastMessage("Moved conversation to Trash");
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
    if (!confirm("Are you sure you want to permanently delete this message? This cannot be undone.")) return;
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

  const handleBatchAction = async (action: "trash" | "restore" | "permanent" | "markRead" | "markUnread") => {
    if (selectedEmailIds.size === 0) return;
    const count = selectedEmailIds.size;
    const ids = Array.from(selectedEmailIds);

    if (action === "markRead") {
      setReadEmails(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        localStorage.setItem("mailbox_read_emails", JSON.stringify(Array.from(next)));
        return next;
      });
      setSelectedEmailIds(new Set());
      setToastMessage(`Marked ${count} as read`);
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    if (action === "markUnread") {
      setReadEmails(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        localStorage.setItem("mailbox_read_emails", JSON.stringify(Array.from(next)));
        return next;
      });
      setSelectedEmailIds(new Set());
      setToastMessage(`Marked ${count} as unread`);
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

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
        body: JSON.stringify({ ids })
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
          ids.forEach(id => next.delete(id));
          localStorage.setItem("mailbox_pinned_emails", JSON.stringify(Array.from(next)));
          return next;
        });

        if (selectedEmail && selectedEmailIds.has(selectedEmail.id)) {
          setSelectedEmail(null);
        }

        setSelectedEmailIds(new Set());
        const msg = action === "trash" 
          ? `Moved ${count} conversation${count > 1 ? 's' : ''} to Trash`
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
    if (!confirm("Empty Trash now? All trashed emails will be permanently deleted from the server.")) return;

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

  // Media Gallery Drawer Handlers
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
        } catch {}
      }
    } catch (err) {
      console.error("Error fetching media:", err);
    } finally {
      setLoadingMedia(false);
    }
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
        return { bg: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30", glow: "from-rose-500/20 to-red-600/10" };
      case "DOC":
      case "DOCX":
        return { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", glow: "from-blue-500/20 to-indigo-600/10" };
      case "XLS":
      case "XLSX":
      case "CSV":
        return { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30", glow: "from-emerald-500/20 to-teal-600/10" };
      case "ZIP":
      case "RAR":
        return { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30", glow: "from-amber-500/20 to-yellow-600/10" };
      default:
        return { bg: "bg-purple-500/15", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30", glow: "from-purple-500/20 to-indigo-600/10" };
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setToastMessage("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const getFullDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const parseSender = (senderStr: string) => {
    if (!senderStr) return { name: "Unknown Sender", email: "" };
    const str = senderStr.trim();
    const angleMatch = str.match(/^(?:["']?([^"<]+)["']?\s*)?<([^>]+@[^>]+)>$/);
    if (angleMatch) {
      const email = (angleMatch[2] || "").trim();
      const rawName = (angleMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      const name = rawName.length > 0 ? rawName : email;
      return { name, email };
    }
    const parenMatch = str.match(/^([^(]+)\(([^)]+)\)$/);
    if (parenMatch) {
      const part1 = parenMatch[1].trim().replace(/^["']|["']$/g, "");
      const part2 = parenMatch[2].trim().replace(/^["']|["']$/g, "");
      if (part2.includes("@")) return { name: part1 || part2, email: part2 };
      if (part1.includes("@")) return { name: part2 || part1, email: part1 };
    }
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

  if (!user) return null;

  const isPinnedFilter = filterType === "pinned";
  const visibleEmails = isPinnedFilter
    ? emails.filter(e => pinnedEmails.has(e.id))
    : filterType === "with_attachments"
    ? emails.filter(e => e.has_attachment === 1)
    : filterType === "simple"
    ? emails.filter(e => e.has_attachment === 0)
    : emails;

  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);

  return (
    <div className={`h-screen flex flex-col font-sans select-none overflow-hidden transition-colors duration-200 ${
      theme === "light"
        ? "bg-[#f6f8fc] text-[#202124]"
        : "bg-[#030712] text-gray-200"
    }`}>
      {/* ========================================================= */}
      {/* 1. TOP HEADER (GMAIL LOGO, SEARCH BAR, UTILITY ICONS)     */}
      {/* ========================================================= */}
      <header className={`h-16 px-4 flex items-center justify-between gap-3 shrink-0 z-30 transition-colors ${
        theme === "light"
          ? "bg-[#f6f8fc] border-b border-transparent"
          : "bg-[#0b0f19] border-b border-white/[0.06]"
      }`}>
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center gap-3 w-60 shrink-0">
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileSidebarOpen(o => !o);
              } else {
                setSidebarCollapsed(c => !c);
              }
            }}
            className={`p-2.5 rounded-full cursor-pointer transition-colors ${
              theme === "light"
                ? "hover:bg-[#e8eaed] text-[#444746]"
                : "hover:bg-white/[0.08] text-gray-300"
            }`}
            title="Main menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Gmail Style Logo */}
          <div 
            onClick={() => { setSelectedEmail(null); setFilterType("all"); }} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7">
                <path fill="#4285F4" d="M2.5 19h4v-9.5L2.5 6.5z" />
                <path fill="#EA4335" d="M17.5 19h4v-12.5L17.5 9.5z" />
                <path fill="#34A853" d="M6.5 9.5V19h11V9.5z" opacity="0.1" />
                <path fill="#EA4335" d="M20.5 4.5h-17a2 2 0 0 0-2 2v.5l10.5 7.5 10.5-7.5v-.5a2 2 0 0 0-2-2z" />
                <path fill="#FBBC05" d="M2.5 7v2.5l9.5 6.5 9.5-6.5V7l-9.5 6.5z" opacity="0.2" />
                <path d="M21.5 6.5L12 13.5 2.5 6.5" fill="none" stroke="#4285F4" strokeWidth="1.5" />
              </svg>
            </div>
            <span className={`text-[22px] font-normal tracking-tight ${
              theme === "light" ? "text-[#444746]" : "text-white"
            }`}>
              Gmail
            </span>
          </div>
        </div>

        {/* Center: Search Bar (Rounded Pill with Filter icon) */}
        <div className="flex-1 max-w-2xl px-2">
          <div className={`relative flex items-center w-full h-11 rounded-full transition-all ${
            theme === "light"
              ? "bg-[#eaf1fb] focus-within:bg-white focus-within:shadow-md text-[#1f1f1f]"
              : "bg-[#1e293b]/60 focus-within:bg-[#1e293b] focus-within:shadow-md text-white border border-white/[0.08]"
          }`}>
            <div className="pl-4 pr-3 text-[#5f6368] dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search mail"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-sm focus:outline-none placeholder-[#5f6368] dark:placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setPage(1); }}
                className="p-1.5 mr-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* Filter Adjustment Slider Icon */}
            <button
              onClick={() => setIsSettingsSheetOpen(true)}
              className={`p-2 mr-2 rounded-full cursor-pointer transition-colors ${
                theme === "light"
                  ? "hover:bg-[#dadce0]/50 text-[#444746]"
                  : "hover:bg-white/[0.08] text-gray-300"
              }`}
              title="Show search options / connection parameters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right: Actions, Theme, Settings & User Avatar */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsSheetOpen(true)}
            className={`p-2.5 rounded-full cursor-pointer transition-colors ${
              theme === "light"
                ? "hover:bg-[#e8eaed] text-[#444746]"
                : "hover:bg-white/[0.08] text-gray-300"
            }`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Theme Toggle (Sun / Moon / Gemini Star) */}
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-full cursor-pointer transition-colors ${
              theme === "light"
                ? "hover:bg-[#e8eaed] text-[#444746]"
                : "hover:bg-white/[0.08] text-amber-400"
            }`}
            title={theme === "light" ? "Dark Theme" : "Light Theme"}
          >
            {theme === "light" ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            )}
          </button>

          {/* User Account Circle Avatar Button (Opens Account & Server Info Drawer) */}
          <button
            onClick={() => setIsAccountSheetOpen(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-700 hover:opacity-90 text-white font-bold flex items-center justify-center text-sm ring-2 ring-emerald-500/30 cursor-pointer transition-transform active:scale-95 shadow-sm shrink-0"
            title={`${user?.email || "Account"} - Primary Mailbox & Server Info`}
          >
            {(user?.email || "A")[0].toUpperCase()}
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BODY CONTAINER: SIDEBAR + MAIN EMAIL CONTAINER          */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile Sidebar Backdrop */}
        {mobileSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Left Navigation Sidebar */}
        <aside className={`fixed lg:static top-16 bottom-0 left-0 z-40 flex flex-col py-2 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? "w-18" : "w-64"
        } ${
          mobileSidebarOpen ? "translate-x-0 w-64 bg-white dark:bg-[#0b0f19] shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${
          theme === "light" ? "bg-[#f6f8fc]" : "bg-[#030712]"
        }`}>
          {/* Compose Button (Pill shaped with pencil icon) */}
          <div className="px-3 py-2 mb-2">
            <button
              onClick={() => {
                setShowCompose(true);
                setComposeMinimized(false);
                if (window.innerWidth < 1024) setMobileSidebarOpen(false);
              }}
              className={`group flex items-center gap-4 cursor-pointer transition-all duration-200 ${
                sidebarCollapsed
                  ? "w-12 h-12 rounded-2xl justify-center mx-auto shadow-sm hover:shadow-md"
                  : "h-14 px-6 rounded-2xl shadow-sm hover:shadow-md active:scale-98"
              } ${
                theme === "light"
                  ? "bg-[#c2e7ff] hover:bg-[#b3d7ff] text-[#001d35]"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
              }`}
              title="Compose"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
                <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
              </svg>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium tracking-tight">Compose</span>
              )}
            </button>
          </div>

          {/* Navigation Folders */}
          <nav className="flex-1 overflow-y-auto space-y-0.5 pr-2 custom-scrollbar">
            {/* 1. Inbox */}
            <button
              onClick={() => {
                setSelectedEmail(null);
                setFilterType("all");
                setPage(1);
                if (window.innerWidth < 1024) setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-sm transition-colors ${
                filterType === "all"
                  ? theme === "light"
                    ? "bg-[#d3e3fd] text-[#001d35] font-bold"
                    : "bg-blue-500/20 text-blue-300 font-bold"
                  : theme === "light"
                  ? "hover:bg-[#e8eaed] text-[#444746]"
                  : "hover:bg-white/[0.05] text-gray-300"
              }`}
              title="Inbox"
            >
              <div className="flex items-center gap-4 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                  <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Inbox</span>}
              </div>
              {!sidebarCollapsed && totalRecords > 0 && (
                <span className="text-xs font-semibold">{totalRecords.toLocaleString()}</span>
              )}
            </button>

            {/* 2. Starred */}
            <button
              onClick={() => {
                setSelectedEmail(null);
                setFilterType("pinned");
                setPage(1);
                if (window.innerWidth < 1024) setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-sm transition-colors ${
                filterType === "pinned"
                  ? theme === "light"
                    ? "bg-[#d3e3fd] text-[#001d35] font-bold"
                    : "bg-blue-500/20 text-blue-300 font-bold"
                  : theme === "light"
                  ? "hover:bg-[#e8eaed] text-[#444746]"
                  : "hover:bg-white/[0.05] text-gray-300"
              }`}
              title="Starred"
            >
              <div className="flex items-center gap-4 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={pinnedEmails.size > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={`w-4 h-4 shrink-0 ${pinnedEmails.size > 0 ? "text-amber-500" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Starred</span>}
              </div>
              {!sidebarCollapsed && pinnedEmails.size > 0 && (
                <span className="text-xs font-semibold">{pinnedEmails.size}</span>
              )}
            </button>

            {/* 3. Sent */}
            <button
              onClick={() => {
                setShowCompose(true);
                setToastMessage("Ready to compose sent mail");
                setTimeout(() => setToastMessage(null), 2000);
              }}
              className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-sm transition-colors ${
                theme === "light"
                  ? "hover:bg-[#e8eaed] text-[#444746]"
                  : "hover:bg-white/[0.05] text-gray-300"
              }`}
              title="Sent"
            >
              <div className="flex items-center gap-4 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Sent</span>}
              </div>
            </button>

            {/* 4. Trash */}
            <button
              onClick={() => {
                setSelectedEmail(null);
                setFilterType("trash");
                setPage(1);
                if (window.innerWidth < 1024) setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-sm transition-colors ${
                filterType === "trash"
                  ? theme === "light"
                    ? "bg-[#fce8e6] text-[#c5221f] font-bold"
                    : "bg-rose-500/20 text-rose-300 font-bold"
                  : theme === "light"
                  ? "hover:bg-[#e8eaed] text-[#444746]"
                  : "hover:bg-white/[0.05] text-gray-300"
              }`}
              title="Trash"
            >
              <div className="flex items-center gap-4 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Trash</span>}
              </div>
              {!sidebarCollapsed && trashCount > 0 && (
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{trashCount}</span>
              )}
            </button>

            {/* Labels Divider & Section */}
            {!sidebarCollapsed && (
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between px-5 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#444746] dark:text-gray-400">
                    Labels
                  </span>
                  <button 
                    onClick={() => openMediaSheet()} 
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                    title="View Media Attachments"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>

                {/* Account Label Pill - Exactly like screenshot (e.g. admin@micorna.biz 10,186) */}
                <button
                  onClick={() => {
                    setSelectedEmail(null);
                    setFilterType("all");
                    setPage(1);
                  }}
                  className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-xs transition-colors ${
                    theme === "light"
                      ? "hover:bg-[#e8eaed] text-[#444746]"
                      : "hover:bg-white/[0.05] text-gray-300"
                  }`}
                  title={user.email}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-gray-500">
                      <path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" />
                    </svg>
                    <span className="truncate font-mono">{user.email}</span>
                  </div>
                  {totalRecords > 0 && (
                    <span className="text-[11px] font-mono text-gray-500">{totalRecords.toLocaleString()}</span>
                  )}
                </button>

                {/* Media & Attachments Label */}
                <button
                  onClick={() => openMediaSheet()}
                  className={`w-full flex items-center justify-between rounded-r-full h-8 px-5 cursor-pointer text-xs transition-colors ${
                    theme === "light"
                      ? "hover:bg-[#e8eaed] text-[#444746]"
                      : "hover:bg-white/[0.05] text-gray-300"
                  }`}
                  title="All Media & Attachments"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-purple-500">
                      <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">Attachments Gallery</span>
                  </div>
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* ========================================================= */}
        {/* 3. MAIN EMAIL CONTAINER (WHITE CARD LAYOUT IN GMAIL)       */}
        {/* ========================================================= */}
        <main className={`flex-1 m-0 lg:mr-4 lg:mb-4 rounded-2xl flex flex-col overflow-hidden shadow-xs border transition-colors ${
          theme === "light"
            ? "bg-white border-[#e0e3e7]"
            : "bg-[#0b0f19] border-white/[0.08]"
        }`}>

          {/* Top Sub-Toolbar (Checkbox Dropdown, Refresh, More, Pagination) */}
          <div className={`h-12 px-4 flex items-center justify-between border-b shrink-0 transition-colors ${
            theme === "light" ? "border-[#f1f3f4]" : "border-white/[0.06]"
          }`}>
            {/* Left Tools */}
            <div className="flex items-center gap-1">
              {/* Checkbox with Dropdown Chevron */}
              <div className="relative flex items-center">
                <button
                  onClick={handleSelectAll}
                  className={`p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-[#444746] dark:text-gray-300 cursor-pointer`}
                  title={selectedEmailIds.size === visibleEmails.length && visibleEmails.length > 0 ? "Deselect all" : "Select all"}
                >
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                    selectedEmailIds.size > 0 && selectedEmailIds.size === visibleEmails.length
                      ? "bg-[#1a73e8] border-[#1a73e8] text-white"
                      : selectedEmailIds.size > 0
                      ? "border-[#1a73e8] bg-blue-500/20 text-[#1a73e8]"
                      : "border-gray-500 dark:border-gray-400 bg-transparent"
                  }`}>
                    {selectedEmailIds.size > 0 && selectedEmailIds.size === visibleEmails.length ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    ) : selectedEmailIds.size > 0 ? (
                      <div className="w-2 h-0.5 bg-[#1a73e8] rounded-full" />
                    ) : null}
                  </div>
                </button>

                {/* Chevron Dropdown Trigger */}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectDropdownOpen(o => !o); }}
                  className="p-1 -ml-1 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                  title="Select filter"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Select Options Dropdown */}
                {selectDropdownOpen && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-0 top-full mt-1 w-36 rounded-xl shadow-lg border py-1.5 z-30 ${
                      theme === "light"
                        ? "bg-white border-[#dadce0] text-[#202124]"
                        : "bg-[#1e293b] border-white/10 text-white"
                    }`}
                  >
                    {[
                      { id: "all", label: "All" },
                      { id: "none", label: "None" },
                      { id: "read", label: "Read" },
                      { id: "unread", label: "Unread" },
                      { id: "starred", label: "Starred" }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectFilter(item.id as any)}
                        className={`w-full text-left px-4 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons: Batch Actions or Default (Refresh, More) */}
              {selectedEmailIds.size > 0 ? (
                <div className="flex items-center gap-1 ml-2">
                  {filterType === "trash" ? (
                    <>
                      <button
                        onClick={() => handleBatchAction("restore")}
                        className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        title="Restore selected"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleBatchAction("permanent")}
                        className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-rose-600 dark:text-rose-400 cursor-pointer"
                        title="Delete permanently"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleBatchAction("trash")}
                        className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-[#444746] dark:text-gray-300 hover:text-rose-600 cursor-pointer"
                        title="Move selected to Trash"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleBatchAction("markRead")}
                        className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-[#444746] dark:text-gray-300 cursor-pointer"
                        title="Mark as read"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m4.179-2.51v4.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleBatchAction("markUnread")}
                        className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-[#444746] dark:text-gray-300 cursor-pointer"
                        title="Mark as unread"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </button>
                    </>
                  )}
                  <span className="text-xs font-semibold text-gray-500 pl-2">
                    {selectedEmailIds.size} selected
                  </span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("mailbox_token") || localStorage.getItem("imap_mailbox_token") || "";
                      fetchEmails(token, page, filterType, searchQuery);
                    }}
                    className="p-2 rounded hover:bg-[#e8eaed] dark:hover:bg-white/10 text-[#444746] dark:text-gray-300 cursor-pointer"
                    title="Refresh"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                </>
              )}

              {/* Trash Notice & Empty Trash Button */}
              {filterType === "trash" && trashCount > 0 && selectedEmailIds.size === 0 && (
                <button
                  onClick={handleEmptyTrash}
                  className="ml-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Empty Trash now
                </button>
              )}
            </div>

            {/* Right: Pagination (e.g. 1-50 of 10,304 < >) */}
            <div className="flex items-center gap-3 text-xs text-[#5f6368] dark:text-gray-400">
              {totalRecords > 0 ? (
                <span>
                  {startRecord}–{endRecord} of {totalRecords.toLocaleString()}
                </span>
              ) : (
                <span>0 of 0</span>
              )}

              <div className="flex items-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-full hover:bg-[#e8eaed] dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                  title="Newer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-full hover:bg-[#e8eaed] dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
                  title="Older"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. MAIN CONTENT VIEW: LIST VS READING PANE                 */}
          {/* ========================================================= */}
          {selectedEmail ? (
            /* EMAIL READING PANE (FULL-PAGE GMAIL STYLE) */
            <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar transition-colors ${
              theme === "light" ? "bg-white" : "bg-[#0b0f19]"
            }`}>
              {/* Back to Inbox Toolbar */}
              <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 ${
                theme === "light" ? "border-[#f1f3f4] bg-[#f8f9fa]" : "border-white/[0.06] bg-[#0e1424]"
              }`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                    title="Back to inbox"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span>Back</span>
                  </button>

                  <div className="h-4 w-px bg-gray-300 dark:bg-white/10 mx-1" />

                  {filterType === "trash" ? (
                    <>
                      <button
                        onClick={() => handleRestoreEmail(selectedEmail.id)}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                        title="Restore to Inbox"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteEmail(selectedEmail.id)}
                        className="p-2 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-rose-600 dark:text-rose-400 cursor-pointer"
                        title="Delete permanently"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleMoveToTrash(selectedEmail.id)}
                      className="p-2 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-rose-600 cursor-pointer"
                      title="Move to Trash"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                      </svg>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setReadEmails(prev => {
                        const next = new Set(prev);
                        next.delete(selectedEmail.id);
                        localStorage.setItem("mailbox_read_emails", JSON.stringify(Array.from(next)));
                        return next;
                      });
                      setSelectedEmail(null);
                    }}
                    className="p-2 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 cursor-pointer"
                    title="Mark as unread"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode(v => v === "html" ? "text" : "html")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      theme === "light"
                        ? "bg-white border-gray-300 hover:bg-gray-100 text-gray-700"
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-200"
                    }`}
                  >
                    {viewMode === "html" ? "View Raw Text" : "View HTML Render"}
                  </button>
                </div>
              </div>

              {/* Email Content Details */}
              <div className="p-6 max-w-5xl w-full mx-auto space-y-6">
                {/* Subject Heading */}
                <h1 className={`text-xl sm:text-2xl font-semibold tracking-tight ${
                  theme === "light" ? "text-[#1f1f1f]" : "text-white"
                }`}>
                  {selectedEmail.subject || "(no subject)"}
                </h1>

                {/* Sender & Recipient Bar */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base shrink-0 ${
                      getAvatarColor(selectedEmail.sender)
                    }`}>
                      {(parseSender(selectedEmail.sender).name || selectedEmail.sender || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`font-bold text-sm sm:text-base ${
                          theme === "light" ? "text-[#1f1f1f]" : "text-white"
                        }`}>
                          {parseSender(selectedEmail.sender).name}
                        </span>
                        {parseSender(selectedEmail.sender).email && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            &lt;{parseSender(selectedEmail.sender).email}&gt;
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                        <span>to:</span>
                        <span className={`font-medium ${
                          theme === "light" ? "text-gray-800" : "text-gray-200"
                        }`}>
                          {selectedEmail.recipient || "me"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Timestamp and Star button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(selectedEmail.created_at)} ({getFullDate(selectedEmail.created_at)})
                    </span>
                    <button
                      onClick={() => togglePin(selectedEmail.id)}
                      className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer ${
                        pinnedEmails.has(selectedEmail.id) ? "text-amber-500" : "text-gray-400"
                      }`}
                      title={pinnedEmails.has(selectedEmail.id) ? "Starred" : "Not starred"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={pinnedEmails.has(selectedEmail.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Email Body */}
                <div className="pt-4 border-t border-gray-200 dark:border-white/10 min-h-[200px]">
                  {selectedEmail.details ? (
                    viewMode === "html" && selectedEmail.details.html ? (
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
    padding: 8px 0;
    word-break: break-word;
  }
  a { color: ${theme === "light" ? "#1a73e8" : "#8ab4f8"}; text-decoration: underline; }
  img { max-width: 100%; height: auto; display: inline-block; }
  blockquote {
    border-left: 3px solid ${theme === "light" ? "#dadce0" : "#5f6368"};
    margin: 12px 0;
    padding-left: 16px;
    color: ${theme === "light" ? "#5f6368" : "#9aa0a6"};
  }
</style>
</head>
<body>
  ${selectedEmail.details.html}
</body>
</html>`}
                        className="w-full block border-0 bg-transparent min-h-[300px]"
                        title="Email Body"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        onLoad={(e) => {
                          const iframe = e.target as HTMLIFrameElement;
                          try {
                            const height = Math.max(
                              iframe.contentWindow?.document.documentElement.scrollHeight || 0,
                              iframe.contentWindow?.document.body.scrollHeight || 0
                            );
                            if (height > 0) {
                              iframe.style.height = (height + 30) + 'px';
                            }
                          } catch (err) {}
                        }}
                      />
                    ) : (
                      <div className={`text-sm leading-relaxed whitespace-pre-wrap font-sans ${
                        theme === "light" ? "text-gray-800" : "text-gray-200"
                      }`}>
                        {selectedEmail.details.text || "(This message has no plain text content)"}
                      </div>
                    )
                  ) : (
                    <div className="flex justify-center items-center py-16">
                      <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                {selectedEmail.details?.attachments && selectedEmail.details.attachments.length > 0 && (
                  <div className="pt-6 border-t border-gray-200 dark:border-white/10">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
                        <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                      </svg>
                      Attachments ({selectedEmail.details.attachments.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedEmail.details.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.url || `data:${att.contentType || "application/octet-stream"};base64,${att.content}`}
                          download={att.filename}
                          target="_blank"
                          className={`p-3 rounded-xl border flex items-center gap-3 transition-all hover:shadow-md ${
                            theme === "light"
                              ? "bg-white border-gray-200 hover:border-blue-500 text-gray-900"
                              : "bg-[#1e293b]/60 border-white/10 hover:border-blue-500 text-white"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {getFileExtension(att.filename)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{att.filename}</p>
                            <p className="text-[10px] text-gray-500">{formatBytes(att.size)}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EMAIL LIST VIEW WITH CATEGORY TABS (EXACTLY MATCHING GMAIL SCREENSHOT) */
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Email List Scrollable Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <div key={i} className={`h-11 px-4 border-b flex items-center gap-3 animate-pulse ${
                        theme === "light" ? "border-[#f1f3f4] bg-white" : "border-white/[0.04] bg-white/[0.01]"
                      }`}>
                        <div className="w-4 h-4 rounded bg-gray-200 dark:bg-white/10 shrink-0" />
                        <div className="w-4 h-4 rounded bg-gray-200 dark:bg-white/10 shrink-0" />
                        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-white/10 shrink-0" />
                        <div className="w-24 h-4 rounded bg-gray-100 dark:bg-white/5 shrink-0" />
                        <div className="flex-1 h-4 rounded bg-gray-100 dark:bg-white/5" />
                        <div className="w-14 h-4 rounded bg-gray-100 dark:bg-white/5 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : visibleEmails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-72 text-center p-6 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="w-12 h-12 mb-2 text-gray-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <p className="text-sm font-semibold">{filterType === "trash" ? "Trash is empty" : isPinnedFilter ? "No starred emails" : "Your inbox is empty"}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {searchQuery ? `No results for "${searchQuery}"` : "Inbound messages will arrive here in real time."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                    {visibleEmails.map((email) => {
                      const isRead = readEmails.has(email.id);
                      const isStarred = pinnedEmails.has(email.id);
                      const isChecked = selectedEmailIds.has(email.id);
                      const { name: senderName } = parseSender(email.sender);

                      return (
                        <div
                          key={email.id}
                          onClick={() => handleViewEmail(email)}
                          className={`group h-11 px-4 flex items-center gap-3 cursor-pointer text-sm transition-colors relative ${
                            isChecked
                              ? theme === "light" ? "bg-[#c2e7ff]/50" : "bg-blue-500/15"
                              : isRead
                              ? theme === "light" ? "bg-[#f2f6fc]/50 hover:bg-[#f2f6fc] text-[#444746]" : "bg-transparent hover:bg-white/[0.04] text-gray-400"
                              : theme === "light" ? "bg-white hover:bg-[#f2f6fc] text-[#202124] font-bold" : "bg-white/[0.02] hover:bg-white/[0.05] text-white font-bold"
                          }`}
                        >
                          {/* Left: Checkbox */}
                          <div
                            onClick={(e) => toggleSelectEmail(email.id, e)}
                            className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                          >
                            <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                              isChecked
                                ? "bg-[#1a73e8] border-[#1a73e8] text-white"
                                : "border-gray-400 dark:border-gray-500 bg-transparent hover:border-gray-700"
                            }`}>
                              {isChecked && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Star Button */}
                          <div
                            onClick={(e) => togglePin(email.id, e)}
                            className={`p-1 cursor-pointer transition-colors ${
                              isStarred ? "text-amber-500" : "text-gray-300 dark:text-gray-600 hover:text-gray-500"
                            }`}
                            title={isStarred ? "Starred" : "Not starred"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          </div>

                          {/* Sender Name */}
                          <div className="w-36 sm:w-44 truncate shrink-0">
                            <span>{senderName}</span>
                          </div>

                          {/* Recipient Pill Tag (Exactly like screenshot: admin@micorna.biz) */}
                          <div className="shrink-0 hidden md:block">
                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-sm border ${
                              theme === "light"
                                ? "bg-[#f1f3f4] text-[#444746] border-[#e0e3e7]"
                                : "bg-white/[0.06] text-gray-300 border-white/10"
                            }`}>
                              {email.recipient || user.email}
                            </span>
                          </div>

                          {/* Subject & Snippet Preview */}
                          <div className="flex-1 truncate min-w-0 pr-2">
                            <span className={!isRead ? "font-bold" : "font-medium"}>
                              {email.subject || "(no subject)"}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 font-normal ml-2">
                              — Click to inspect received message body and media attachments...
                            </span>
                          </div>

                          {/* Attachment Icon if present */}
                          {email.has_attachment === 1 && (
                            <div className="text-gray-400 shrink-0" title="Has attachment">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}

                          {/* Right: Timestamp & Hover Action Buttons */}
                          <div className="w-20 text-right shrink-0 relative flex items-center justify-end">
                            {/* Normal State: Date/Time */}
                            <span className="text-xs text-gray-500 group-hover:hidden whitespace-nowrap">
                              {formatDate(email.created_at)}
                            </span>

                            {/* Hover State: Gmail Action Icons */}
                            <div className="hidden group-hover:flex items-center gap-1">
                              {filterType === "trash" ? (
                                <button
                                  onClick={(e) => handleRestoreEmail(email.id, e)}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  title="Restore to Inbox"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleMoveToTrash(email.id, e)}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 hover:text-rose-600 cursor-pointer"
                                  title="Move to Trash"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                                  </svg>
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReadEmails(prev => {
                                    const next = new Set(prev);
                                    if (isRead) next.delete(email.id);
                                    else next.add(email.id);
                                    localStorage.setItem("mailbox_read_emails", JSON.stringify(Array.from(next)));
                                    return next;
                                  });
                                }}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                                title={isRead ? "Mark as unread" : "Mark as read"}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 5. FLOATING COMPOSE WINDOW (GMAIL STYLE BOTTOM-RIGHT)      */}
      {/* ========================================================= */}
      {showCompose && (
        <div className={`fixed bottom-0 right-6 z-50 rounded-t-xl shadow-2xl border transition-all duration-200 flex flex-col ${
          composeExpanded
            ? "w-[800px] h-[600px] max-w-[95vw] max-h-[90vh]"
            : composeMinimized
            ? "w-64 h-11"
            : "w-[540px] h-[480px] max-w-[95vw]"
        } ${
          theme === "light"
            ? "bg-white border-[#dadce0] text-[#202124]"
            : "bg-[#1e293b] border-white/15 text-white shadow-black/80"
        }`}>
          {/* Header Bar */}
          <div 
            onClick={() => setComposeMinimized(m => !m)}
            className={`h-10 px-4 flex items-center justify-between rounded-t-xl cursor-pointer ${
              theme === "light" ? "bg-[#f2f6fc]" : "bg-[#0f172a]"
            }`}
          >
            <span className="text-sm font-semibold truncate">New Message</span>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setComposeMinimized(m => !m)}
                className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                title="Minimize"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setComposeExpanded(e => !e)}
                className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                title="Full screen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              </button>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1 rounded hover:bg-gray-300 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                title="Save & close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body Form if not minimized */}
          {!composeMinimized && (
            <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden">
              {/* Recipient Input */}
              <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex items-center">
                <span className="text-xs text-gray-400 w-12 shrink-0">To</span>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Recipients"
                  className="w-full text-sm bg-transparent focus:outline-none"
                />
              </div>

              {/* Subject Input */}
              <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex items-center">
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full text-sm bg-transparent focus:outline-none"
                />
              </div>

              {/* Message Body Area */}
              <div className="flex-1 p-4 overflow-y-auto">
                <textarea
                  required
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  placeholder="Write your email here..."
                  className="w-full h-full text-sm bg-transparent focus:outline-none resize-none"
                />
              </div>

              {/* Footer Toolbar with Send Button */}
              <div className="h-14 px-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={sending}
                    className="h-9 px-5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white font-medium text-sm flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {sending ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <span>Send</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openMediaSheet()}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                    title="Insert attachments"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 hover:text-rose-600 cursor-pointer"
                  title="Discard draft"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.158-3.21c-1.338-.25-2.687-.45-4.04-.59m-4.04.59c-1.338.25-2.687.45-4.04.59m4.04-.59l.5-1.5A1.5 1.5 0 0110.5 3h3a1.5 1.5 0 011.41 1.01l.5 1.5" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5.5. ACCOUNT & SERVER PROFILE SLIDE-OVER DRAWER           */}
      {/* ========================================================= */}
      {isAccountSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsAccountSheetOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex pl-6 z-50">
            <div className={`w-full border-l shadow-2xl flex flex-col justify-between overflow-hidden transition-colors ${
              theme === "light"
                ? "bg-white border-[#dadce0] text-[#202124]"
                : "bg-[#0b0f19] border-white/10 text-white"
            }`}>
              {/* Drawer Header (Old Header Look & Status) */}
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                theme === "light" ? "bg-[#f8f9fa] border-gray-200" : "bg-[#0f172a] border-white/10"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center relative overflow-hidden transition-all ${
                    theme === "light"
                      ? "bg-[#e8f0fe] border border-[#c2e7ff] text-[#1a73e8] shadow-xs"
                      : "bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/15"
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 relative z-10">
                      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <h3 className={`text-base font-bold tracking-tight leading-tight ${
                      theme === "light" ? "text-[#202124]" : "text-white"
                    }`}>
                      Primary <span className="text-[#1a73e8] dark:text-blue-400">Mailbox</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                        theme === "light"
                          ? "bg-[#e8f0fe] text-[#1a73e8] border border-[#d2e3fc]"
                          : "bg-white/[0.06] text-gray-300 border border-white/[0.1]"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Ports 993/143 Active
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsAccountSheetOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 hover:text-gray-800 dark:hover:text-white cursor-pointer transition-colors"
                  title="Close sheet"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                {/* 1. Account Profile Card */}
                <div className={`p-4 rounded-2xl border ${
                  theme === "light" ? "bg-gray-50/80 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-white/10">
                    <div className="w-12 h-12 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-lg ring-4 ring-emerald-500/20 shadow-md shrink-0">
                      {(user?.email || "A")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          theme === "light" ? "bg-blue-100 text-blue-800" : "bg-blue-500/20 text-blue-300"
                        }`}>
                          PRIMARY DOMAIN
                        </span>
                      </div>
                      <p className="text-sm font-bold truncate mt-0.5">{user?.email || "User"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{primaryDomain}</p>
                    </div>
                  </div>

                  {/* Credentials / Key Details */}
                  <div className="pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Account Email:</span>
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        <span className="truncate max-w-[190px]">{user?.email}</span>
                        <button
                          onClick={() => copyToClipboard(user?.email, "user-email")}
                          className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                          title="Copy Email"
                        >
                          {copiedKey === "user-email" ? (
                            <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied!</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Primary Domain:</span>
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        <span>{primaryDomain}</span>
                        <button
                          onClick={() => copyToClipboard(primaryDomain, "domain")}
                          className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                          title="Copy Domain"
                        >
                          {copiedKey === "domain" ? (
                            <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied!</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {userPassword && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Password:</span>
                        <div className="flex items-center gap-1.5 font-mono font-medium">
                          <span>••••••••••••</span>
                          <button
                            onClick={() => copyToClipboard(userPassword, "pwd")}
                            className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                            title="Copy Password"
                          >
                            {copiedKey === "pwd" ? (
                              <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied!</span>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Server IP & Host Infrastructure Card */}
                <div className={`p-4 rounded-2xl border space-y-2.5 ${
                  theme === "light" ? "bg-gray-50/80 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold uppercase tracking-wider text-[10px]">Server &amp; Host Configuration</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Online</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500 dark:text-gray-400">Server IP Address:</span>
                    <div className="flex items-center gap-1.5 font-mono font-semibold">
                      <span>{serverIp}</span>
                      <button
                        onClick={() => copyToClipboard(serverIp, "server-ip")}
                        className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                        title="Copy Server IP"
                      >
                        {copiedKey === "server-ip" ? (
                          <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied!</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500 dark:text-gray-400">IMAP Host:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span>{serverInfo?.imap?.host || `mail.${primaryDomain}`}</span>
                      <button
                        onClick={() => copyToClipboard(serverInfo?.imap?.host || `mail.${primaryDomain}`, "imap-host")}
                        className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                        title="Copy IMAP Host"
                      >
                        {copiedKey === "imap-host" ? (
                          <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied!</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500 dark:text-gray-400">IMAP SSL Port:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">993 (SSL) / 143 (Plain)</span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500 dark:text-gray-400">POP3 SSL Port:</span>
                    <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">995 (SSL) / 110 (Plain)</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500 dark:text-gray-400">SMTP Outgoing Port:</span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">465 (SSL) / 587 (TLS)</span>
                  </div>
                </div>

                {/* 3. Theme & Quick Navigation */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  theme === "light" ? "bg-gray-50/80 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs">Display Theme</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Switch between light and dark visual modes</p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition-all ${
                        theme === "light"
                          ? "border-[#dadce0] bg-white text-[#444746] hover:bg-[#f1f3f4]"
                          : "border-white/[0.12] bg-white/[0.06] text-amber-400 hover:bg-white/[0.1]"
                      }`}
                    >
                      {theme === "light" ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-gray-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                          </svg>
                          <span>Dark Mode</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-amber-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                          </svg>
                          <span>Light Mode</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-white/10 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setIsAccountSheetOpen(false); setIsSettingsSheetOpen(true); }}
                      className={`px-3 py-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        theme === "light"
                          ? "bg-white hover:bg-gray-100 border-gray-200 text-gray-700"
                          : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-gray-200"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-blue-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                      <span>Full Settings</span>
                    </button>

                    <button
                      onClick={() => { setIsAccountSheetOpen(false); setIsMediaSheetOpen(true); }}
                      className={`px-3 py-2 rounded-xl border font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        theme === "light"
                          ? "bg-white hover:bg-gray-100 border-gray-200 text-gray-700"
                          : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-gray-200"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 text-purple-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span>Media Gallery</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer with Logout button */}
              <div className={`p-4 border-t ${
                theme === "light" ? "bg-[#f8f9fa] border-gray-200" : "bg-[#0f172a] border-white/10"
              }`}>
                <button
                  onClick={handleLogout}
                  className={`w-full py-2.5 px-4 rounded-xl border font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                    theme === "light"
                      ? "border-[#fad2cf] bg-[#fce8e6] text-[#c5221f] hover:bg-[#fad2cf]"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-400 hover:text-white hover:bg-rose-500/20"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span>Sign Out of Mailbox</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. SERVER SETTINGS SLIDE-OVER DRAWER (IMAP/POP/SMTP)      */}
      {/* ========================================================= */}
      {isSettingsSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSettingsSheetOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex pl-6 z-50">
            <div className={`w-full border-l shadow-2xl flex flex-col justify-between overflow-hidden transition-colors ${
              theme === "light"
                ? "bg-white border-[#dadce0] text-[#202124]"
                : "bg-[#0b0f19] border-white/10 text-white"
            }`}>
              {/* Drawer Header */}
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                theme === "light" ? "bg-[#f8f9fa] border-gray-200" : "bg-[#0f172a] border-white/10"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Mailbox Connection Settings</h3>
                    <p className="text-xs text-gray-500">IMAP, POP3 &amp; SMTP Parameters</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsSheetOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-5 custom-scrollbar text-xs">
                {/* IMAP Card */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${
                  theme === "light" ? "bg-gray-50 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="text-blue-600 dark:text-blue-400">Incoming (IMAP)</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">SSL/TLS Active</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500">Host:</span>
                    <span className="font-mono font-semibold">{serverInfo?.imap?.host || `mail.${primaryDomain}`}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500">SSL Port:</span>
                    <span className="font-mono font-semibold">993 (SSL) / 143 (Plain)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Server IP:</span>
                    <span className="font-mono font-semibold">{serverIp}</span>
                  </div>
                </div>

                {/* POP3 Card */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${
                  theme === "light" ? "bg-gray-50 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="text-purple-600 dark:text-purple-400">Incoming (POP3)</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">SSL/TLS Active</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500">Host:</span>
                    <span className="font-mono font-semibold">{serverInfo?.pop3?.host || `mail.${primaryDomain}`}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">SSL Port:</span>
                    <span className="font-mono font-semibold">995 (SSL) / 110 (Plain)</span>
                  </div>
                </div>

                {/* SMTP Card */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${
                  theme === "light" ? "bg-gray-50 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="text-amber-600 dark:text-amber-400">Outgoing (SMTP)</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Active</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500">Host:</span>
                    <span className="font-mono font-semibold">{serverInfo?.smtp?.host || `mail.${primaryDomain}`}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Ports:</span>
                    <span className="font-mono font-semibold">587 (TLS) / 465 (SSL) / 25</span>
                  </div>
                </div>

                {/* Credentials */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${
                  theme === "light" ? "bg-gray-50 border-gray-200" : "bg-white/[0.03] border-white/10"
                }`}>
                  <h4 className="font-bold text-gray-700 dark:text-gray-300">Account Credentials</h4>
                  <div className="flex items-center justify-between py-1 border-b border-gray-200 dark:border-white/5">
                    <span className="text-gray-500">Username:</span>
                    <div className="flex items-center gap-1.5 font-mono font-semibold">
                      <span>{user?.email}</span>
                      <button onClick={() => copyToClipboard(user?.email, "user")} className="text-blue-500 hover:text-blue-600 cursor-pointer">
                        {copiedKey === "user" ? "✓" : "copy"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Password:</span>
                    <div className="flex items-center gap-1.5 font-mono font-semibold">
                      <span>{userPassword || "••••••••"}</span>
                      <button onClick={() => copyToClipboard(userPassword, "pwd")} className="text-blue-500 hover:text-blue-600 cursor-pointer">
                        {copiedKey === "pwd" ? "✓" : "copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MEDIA GALLERY SLIDE-OVER DRAWER                        */}
      {/* ========================================================= */}
      {isMediaSheetOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMediaSheetOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-xl w-full flex pl-6 z-50">
            <div className={`w-full border-l shadow-2xl flex flex-col justify-between overflow-hidden transition-colors ${
              theme === "light"
                ? "bg-white border-[#dadce0] text-[#202124]"
                : "bg-[#0b0f19] border-white/10 text-white"
            }`}>
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                theme === "light" ? "bg-[#f8f9fa] border-gray-200" : "bg-[#0f172a] border-white/10"
              }`}>
                <div>
                  <h3 className="text-sm font-bold">Media &amp; Attachments Gallery</h3>
                  <p className="text-xs text-gray-500">{mediaFiles.length} attachments received</p>
                </div>
                <button
                  onClick={() => setIsMediaSheetOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-gray-100 dark:border-white/5 space-y-3">
                <input
                  type="text"
                  placeholder="Filter attachments..."
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                  className="w-full text-xs rounded-lg px-3 py-2 border border-gray-300 dark:border-white/10 bg-transparent focus:outline-none"
                />
                <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                  {["all", "images", "videos", "documents", "others"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMediaCategoryFilter(cat as any)}
                      className={`px-2.5 py-1 rounded-md capitalize cursor-pointer transition-colors ${
                        mediaCategoryFilter === cat
                          ? "bg-purple-600 text-white font-semibold"
                          : "hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Grid */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                {loadingMedia ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="w-8 h-8 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                  </div>
                ) : mediaFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs">
                    No attachments found
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mediaFiles
                      .filter(f => !mediaSearchQuery || f.filename.toLowerCase().includes(mediaSearchQuery.toLowerCase()))
                      .filter(f => mediaCategoryFilter === "all" || getMediaCategory(f) === mediaCategoryFilter)
                      .map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewModalFile(file)}
                          className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                        >
                          <div className="h-24 bg-black/10 flex items-center justify-center overflow-hidden">
                            {getMediaCategory(file) === "images" ? (
                              <img src={file.url} alt={file.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <span className="font-bold text-xs uppercase font-mono text-purple-600">.{getFileExtension(file.filename)}</span>
                            )}
                          </div>
                          <div className="p-2 text-[11px]">
                            <p className="font-semibold truncate">{file.filename}</p>
                            <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MEDIA PREVIEW MODAL                                     */}
      {/* ========================================================= */}
      {previewModalFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-3xl w-full max-h-[85vh] bg-white dark:bg-[#0b0f19] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold truncate">{previewModalFile.filename}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewModalFile.url}
                  download={previewModalFile.filename}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500"
                >
                  Download
                </a>
                <button onClick={() => setPreviewModalFile(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 cursor-pointer">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto bg-black/5">
              {getMediaCategory(previewModalFile) === "images" ? (
                <img src={previewModalFile.url} alt={previewModalFile.filename} className="max-h-[60vh] object-contain rounded" />
              ) : (
                <p className="text-sm text-gray-500">Preview not available. Click Download above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. FLOATING TOAST MESSAGE                                  */}
      {/* ========================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white shadow-xl flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
