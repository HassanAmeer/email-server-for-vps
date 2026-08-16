import { create } from "zustand";

export interface MailboxUser {
  id: number;
  email: string;
  token?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface EmailItem {
  id: string | number;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  date: string;
  hasAttachments?: boolean;
  attachments?: EmailAttachment[];
  headers?: Record<string, any>;
  senderIp?: string;
  preview?: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface AppState {
  // Mailbox State
  user: MailboxUser | null;
  setUser: (user: MailboxUser | null) => void;
  
  readEmailIds: Set<string | number>;
  markAsRead: (id: string | number) => void;
  markAllAsRead: (ids: (string | number)[]) => void;

  pinnedEmailIds: Set<string | number>;
  togglePin: (id: string | number) => void;

  selectedEmail: EmailItem | null;
  setSelectedEmail: (email: EmailItem | null) => void;

  activeFilter: "all" | "unread" | "attachments" | "pinned";
  setActiveFilter: (filter: "all" | "unread" | "attachments" | "pinned") => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  viewMode: "html" | "text" | "raw" | "headers";
  setViewMode: (mode: "html" | "text" | "raw" | "headers") => void;

  // Toast System
  toasts: ToastMessage[];
  addToast: (type: "success" | "error" | "info" | "warning", message: string) => void;
  removeToast: (id: string) => void;

  // Admin / Stats Cache
  cachedStats: Record<string, any> | null;
  setCachedStats: (stats: Record<string, any> | null) => void;
}

// LocalStorage helpers for persistent read & pinned state
const getStoredSet = (key: string): Set<string | number> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveStoredSet = (key: string, set: Set<string | number>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
};

export const useAppStore = create<AppState>((set, get) => ({
  // Mailbox User
  user: null,
  setUser: (user) => set({ user }),

  // Read Emails
  readEmailIds: getStoredSet("mail_read_ids"),
  markAsRead: (id) => {
    const updated = new Set(get().readEmailIds).add(id);
    saveStoredSet("mail_read_ids", updated);
    set({ readEmailIds: updated });
  },
  markAllAsRead: (ids) => {
    const updated = new Set(get().readEmailIds);
    ids.forEach((id) => updated.add(id));
    saveStoredSet("mail_read_ids", updated);
    set({ readEmailIds: updated });
  },

  // Pinned Emails
  pinnedEmailIds: getStoredSet("mail_pinned_ids"),
  togglePin: (id) => {
    const updated = new Set(get().pinnedEmailIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    saveStoredSet("mail_pinned_ids", updated);
    set({ pinnedEmailIds: updated });
  },

  // Selected Email
  selectedEmail: null,
  setSelectedEmail: (email) => {
    if (email) {
      get().markAsRead(email.id);
    }
    set({ selectedEmail: email });
  },

  // Filter & Search
  activeFilter: "all",
  setActiveFilter: (activeFilter) => set({ activeFilter }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  viewMode: "html",
  setViewMode: (viewMode) => set({ viewMode }),

  // Toasts
  toasts: [],
  addToast: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  // Admin Stats Cache
  cachedStats: null,
  setCachedStats: (cachedStats) => set({ cachedStats }),
}));
