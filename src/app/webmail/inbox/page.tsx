"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WebmailInbox() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("webmail_token");
    const userStr = localStorage.getItem("webmail_user");
    
    if (!token || !userStr) {
      router.push("/webmail");
      return;
    }

    try {
      setUser(JSON.parse(userStr));
      fetchEmails(token);
    } catch (e) {
      handleLogout();
    }
  }, [router]);

  // Auto-fetch emails every 10 seconds silently
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("webmail_token");
    if (!token) return;
    
    const interval = setInterval(() => {
      fetchEmailsSilent(token);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user]);

  const fetchEmailsSilent = async (token: string) => {
    try {
      const res = await fetch("/api/webmail/inbox", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const responseData = await res.json();
        setEmails(responseData.data || []);
      }
    } catch (err) {
      // Silently fail for background polling
    }
  };

  const fetchEmails = async (token: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/webmail/inbox", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        handleLogout();
        return;
      }
      
      if (res.ok) {
        const responseData = await res.json();
        setEmails(responseData.data || []);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to load emails");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("webmail_token");
    localStorage.removeItem("webmail_user");
    router.push("/webmail");
  };

  const handleViewEmail = async (emailRecord: any) => {
    setShowCompose(false);
    try {
      const token = localStorage.getItem("webmail_token");
      const res = await fetch(`/api/webmail/inbox/${emailRecord.id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail({ ...emailRecord, details: data });
      } else {
        alert("Failed to load email details");
      }
    } catch (err) {
      alert("Error loading email");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const token = localStorage.getItem("webmail_token");
      const res = await fetch("/api/webmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          message: composeMessage
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }

      alert("Email sent successfully!");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeMessage("");
      fetchEmailsSilent(token!); // Refresh list after sending
    } catch (err: any) {
      alert(err.message);
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
    if (!senderStr) return { name: "Unknown", email: "" };
    // Example: "Hasan ameer" <hasanameer386@gmail.com> or Hasan <test@test.com> or just email@test.com
    const match = senderStr.match(/^(?:["']?([^"']+)["']?\s*)?<?([^>\s]+@[^>\s]+)>?$/);
    if (match) {
      const name = match[1] ? match[1].trim() : match[2];
      const email = match[2] ? match[2].trim() : "";
      return { name, email };
    }
    return { name: senderStr, email: "" };
  };

  // Helper to get initials for avatar
  const getInitials = (name: string, email: string) => {
    if (name && name.length > 0) return name.charAt(0).toUpperCase();
    if (email && email.length > 0) return email.charAt(0).toUpperCase();
    return '?';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#030712] text-gray-200 font-sans flex flex-col relative overflow-hidden">
      {/* Background glowing effects to match the website theme */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-500/5 blur-[120px] pointer-events-none rounded-full"></div>

      {/* Header */}
      <header className="bg-[#0b0f19]/80 backdrop-blur-xl border-b border-white/[0.06] h-16 sticky top-0 z-40 flex-shrink-0 relative">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
        <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shadow-lg shadow-emerald-500/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 opacity-20"></div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-emerald-400 relative z-10">
                <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Mail<span className="text-emerald-400">Pro</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-gray-500 font-medium font-mono uppercase tracking-widest">Logged in as</span>
              <span className="text-sm text-gray-200 font-bold">{user.email}</span>
            </div>
            <div className="h-8 w-px bg-white/[0.08] hidden md:block mx-1"></div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full flex overflow-hidden h-[calc(100vh-64px)] shadow-2xl shadow-black/80 my-0 bg-[#0b0f19] border-x border-white/[0.04] relative z-10">
        
        {/* Email List Sidebar */}
        <div className={`w-full md:w-[400px] lg:w-[450px] flex flex-col bg-[#030712]/50 border-r border-white/[0.06] overflow-hidden h-full flex-shrink-0 ${(selectedEmail || showCompose) ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/[0.06] bg-[#0b0f19]/80 backdrop-blur-md flex justify-between items-center z-10 sticky top-0 shadow-sm relative">
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Inbox
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-mono border border-violet-500/20">
                {emails.length}
              </span>
            </h2>
            <div className="flex items-center gap-2 relative z-10">
              <button 
                onClick={() => fetchEmails(localStorage.getItem("webmail_token") || "")}
                className="text-gray-400 hover:text-emerald-400 p-2 rounded-lg hover:bg-white/[0.04] transition-colors bg-white/[0.02] border border-white/[0.06] shadow-sm"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <button
                onClick={() => { setSelectedEmail(null); setShowCompose(true); }}
                className="flex items-center gap-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] text-black"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black">
                  <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                </svg>
                Write
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse flex flex-col gap-3 p-5 border-b border-white/[0.04] bg-white/[0.01]">
                    <div className="flex justify-between items-center gap-4">
                      <div className="h-4 bg-white/[0.06] rounded-md w-1/3"></div>
                      <div className="h-3 bg-white/[0.03] rounded-md w-12"></div>
                    </div>
                    <div className="h-4 bg-white/[0.03] rounded-md w-2/3"></div>
                    <div className="h-3 bg-white/[0.02] rounded-md w-full mt-2"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 m-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm font-medium flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mt-0.5 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center bg-[#030712]/30">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white/[0.02] flex items-center justify-center text-gray-600 border border-white/[0.05]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-300 text-lg">All caught up!</p>
                <p className="text-sm mt-1">Your inbox is empty.</p>
              </div>
            ) : (
              <div className="flex flex-col bg-[#0b0f19]/50">
                {emails.map(email => {
                  const isSelected = selectedEmail?.id === email.id;
                  const { name: senderName } = parseSender(email.sender);
                  return (
                    <div 
                      key={email.id} 
                      onClick={() => handleViewEmail(email)}
                      className={`p-4 border-b border-white/[0.04] cursor-pointer transition-colors relative group ${
                        isSelected 
                        ? 'bg-violet-500/10' 
                        : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Selection indicator line */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                      )}
                      
                      <div className="flex justify-between items-baseline mb-1 gap-2">
                        <span className={`font-bold truncate flex-1 text-base ${isSelected ? 'text-violet-300' : 'text-gray-100'}`}>
                          {senderName}
                        </span>
                        <span className={`text-xs font-medium font-mono whitespace-nowrap ${isSelected ? 'text-violet-400' : 'text-gray-500'}`}>
                          {formatDate(email.created_at)}
                        </span>
                      </div>
                      
                      <div className={`text-sm font-semibold truncate mb-1.5 ${isSelected ? 'text-violet-200' : 'text-gray-300'}`}>
                        {email.subject || "(No Subject)"}
                      </div>
                      
                      {/* Fake preview snippet since we don't load body in list, but we could add a short string if available */}
                      <div className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                        Click to view the full message content...
                      </div>
                      
                      {email.has_attachment === 1 && (
                        <div className="flex items-center gap-1 mt-3">
                          <span className="bg-white/[0.04] text-emerald-400 text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 border border-white/[0.08]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-500">
                              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                            </svg>
                            Attachment
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Email Viewer / Compose Pane */}
        <div className={`flex-1 flex-col bg-[#0b0f19] overflow-hidden h-full relative ${(selectedEmail || showCompose) ? 'flex' : 'hidden md:flex'}`}>
          
          {showCompose ? (
            <div className="flex flex-col h-full relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              <div className="px-8 py-6 border-b border-white/[0.06] bg-transparent flex justify-between items-center relative z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <button onClick={() => setShowCompose(false)} className="md:hidden flex items-center justify-center text-gray-500 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] rounded-full w-8 h-8 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  New Message
                </h2>
                <button onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] p-2 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 bg-transparent relative z-10">
                <div className="px-8 py-4 border-b border-white/[0.04] flex items-center bg-black/20">
                  <label className="text-sm font-semibold text-gray-500 w-20">To:</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="flex-1 text-white bg-transparent text-base focus:outline-none placeholder:text-gray-600 font-medium"
                  />
                </div>
                <div className="px-8 py-4 border-b border-white/[0.04] flex items-center bg-black/20">
                  <label className="text-sm font-semibold text-gray-500 w-20">Subject:</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="flex-1 text-white bg-transparent text-base focus:outline-none placeholder:text-gray-600 font-medium"
                  />
                </div>
                <div className="flex flex-col flex-1 px-8 py-6 bg-black/40">
                  <textarea
                    value={composeMessage}
                    onChange={e => setComposeMessage(e.target.value)}
                    required
                    placeholder="Write your message here..."
                    className="w-full flex-1 text-gray-300 bg-transparent text-base focus:outline-none resize-none font-sans leading-relaxed placeholder:text-gray-600"
                  ></textarea>
                </div>
                <div className="p-6 bg-[#030712] border-t border-white/[0.06] flex justify-between items-center">
                  <button type="button" onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-rose-400 font-semibold px-4 py-2 transition-colors">
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center gap-2 active:scale-[0.98]"
                  >
                    {sending ? (
                      <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 -ml-1">
                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                      </svg>
                    )}
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEmail ? (
            <div className="flex flex-col h-full relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 blur-[80px] pointer-events-none rounded-full"></div>
              {/* Email Header Info */}
              <div className="px-8 py-8 border-b border-white/[0.06] bg-[#030712]/50 relative z-10">
                <div className="flex items-start gap-4 mb-8">
                  <button onClick={() => setSelectedEmail(null)} className="md:hidden mt-1 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/[0.04] hover:bg-white/[0.08] rounded-full w-10 h-10 border border-white/[0.05]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <h2 className="text-3xl font-extrabold text-white leading-tight flex-1 tracking-tight">
                    {selectedEmail.subject || "(No Subject)"}
                  </h2>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const { name, email } = parseSender(selectedEmail.sender);
                      return (
                        <>
                          <div className="w-14 h-14 rounded-2xl bg-[#0b0f19] border border-white/[0.1] text-violet-400 flex items-center justify-center font-bold text-2xl shadow-lg relative overflow-hidden flex-shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-emerald-500 opacity-20"></div>
                            <span className="relative z-10">{getInitials(name, email)}</span>
                          </div>
                          <div className="flex flex-col">
                            <div className="text-white font-bold text-lg flex items-center gap-2">
                              {name}
                              {email && name !== email && <span className="text-sm font-normal text-gray-500 font-mono tracking-tight">&lt;{email}&gt;</span>}
                            </div>
                            <div className="text-sm text-gray-400 mt-0.5 font-medium flex items-center gap-1">
                              to <span className="bg-white/[0.04] text-gray-300 px-2 py-0.5 rounded-md border border-white/[0.08] font-mono text-xs">{selectedEmail.recipient}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-gray-500 font-medium text-right flex flex-col items-end">
                    <span className="text-gray-300">{formatDate(selectedEmail.created_at)}</span>
                    <span className="text-xs text-gray-500 mt-1 font-mono bg-white/[0.02] px-2 py-1 rounded border border-white/[0.04]">{getFullDate(selectedEmail.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto bg-[#0b0f19] p-8 relative z-10 shadow-inner">
                {selectedEmail.details ? (
                  <div className="max-w-4xl">
                    {/* HTML Content */}
                    {selectedEmail.details.html ? (
                      <div className="bg-white rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                        {/* Fake macOS window bar for aesthetic */}
                        <div className="h-8 bg-[#f1f1f1] border-b border-gray-200 flex items-center px-4 gap-2">
                          <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                        </div>
                        <iframe 
                          srcDoc={selectedEmail.details.html} 
                          className="w-full min-h-[600px] border-0 bg-white" 
                          title="Email Content"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    ) : (
                      /* Text Content */
                      <div className="bg-black/40 p-8 rounded-2xl text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed border border-white/[0.06] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                        {selectedEmail.details.text || "This email has no content."}
                      </div>
                    )}

                    {/* Attachments Section */}
                    {selectedEmail.details.attachments && selectedEmail.details.attachments.length > 0 && (
                      <div className="mt-12 pt-8 border-t border-white/[0.06]">
                        <h4 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-400">
                            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                          </svg>
                          {selectedEmail.details.attachments.length} Attachments
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedEmail.details.attachments.map((att: any, idx: number) => (
                            <a 
                              key={idx}
                              href={att.url} 
                              download={att.filename}
                              target="_blank"
                              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group"
                            >
                              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-200 truncate group-hover:text-white">{att.filename}</p>
                                <p className="text-xs font-mono text-gray-500 mt-1 group-hover:text-emerald-400/70">{formatBytes(att.size)}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-10 h-10 border-4 border-white/[0.05] border-t-emerald-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 h-full bg-[#030712]/80 relative z-10">
              <div className="w-24 h-24 rounded-3xl bg-[#0b0f19] flex items-center justify-center mb-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border border-white/[0.04]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-12 h-12 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-300 mb-2 tracking-tight">Nothing selected</p>
              <p className="text-base text-gray-600 max-w-sm text-center">Select an email from the inbox list on the left to read its contents.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
