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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#050508] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] flex flex-col font-sans text-slate-200">
      {/* Header */}
      <header className="border-b border-white/[0.05] bg-black/20 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">Webmail Plus</h1>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] px-4 py-1.5 rounded-full shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-gray-400 font-medium">Logged in as</span>
              <span className="text-sm text-gray-200 font-semibold">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-5 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all border border-white/[0.05] hover:border-white/10 shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex gap-6 overflow-hidden h-[calc(100vh-72px)]">
        
        {/* Email List Sidebar */}
        <div className={`w-full md:w-[380px] lg:w-[420px] flex flex-col bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-3xl overflow-hidden h-full shadow-2xl ${(selectedEmail || showCompose) ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-5 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.01]">
            <h2 className="font-bold text-white flex items-center gap-2 text-lg">
              Inbox
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                {emails.length}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchEmails(localStorage.getItem("webmail_token") || "")}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <button
                onClick={() => { setSelectedEmail(null); setShowCompose(true); }}
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                Compose
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col gap-3 p-5">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border border-white/[0.03] rounded-2xl bg-white/[0.02]">
                    <div className="flex justify-between items-center gap-4">
                      <div className="h-4 bg-white/[0.08] rounded-md w-1/3"></div>
                      <div className="h-3 bg-white/[0.05] rounded-md w-16"></div>
                    </div>
                    <div className="h-3 bg-white/[0.05] rounded-md w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-rose-400 text-sm bg-rose-500/10 m-4 rounded-2xl border border-rose-500/20">{error}</div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-gray-500 flex flex-col items-center h-full justify-center">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-8 h-8 text-gray-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="font-medium text-gray-300">Your inbox is empty</p>
                <p className="text-sm mt-1">Waiting for incoming emails...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {emails.map(email => (
                  <div 
                    key={email.id} 
                    onClick={() => handleViewEmail(email)}
                    className={`p-4 cursor-pointer rounded-2xl transition-all duration-200 border ${
                      selectedEmail?.id === email.id 
                      ? 'bg-gradient-to-r from-purple-500/10 to-indigo-500/5 border-purple-500/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] scale-[0.98]' 
                      : 'bg-white/[0.01] border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className={`font-semibold truncate flex-1 ${selectedEmail?.id === email.id ? 'text-purple-300' : 'text-gray-200'}`}>
                        {email.sender}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap mt-0.5">
                        {new Date(email.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 font-medium truncate mb-1">{email.subject || "(No Subject)"}</div>
                    
                    {email.has_attachment === 1 && (
                      <div className="flex items-center gap-1 mt-3">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-500/20">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                          </svg>
                          Attachment
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Email Viewer / Compose Pane */}
        <div className={`flex-1 flex-col bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-3xl overflow-hidden h-full relative shadow-2xl ${(selectedEmail || showCompose) ? 'flex' : 'hidden md:flex'}`}>
          {showCompose ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-white/[0.05] bg-white/[0.01] flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <button onClick={() => setShowCompose(false)} className="md:hidden flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full w-8 h-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Compose New Email</span>
                </h2>
                <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] p-2 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 p-8 gap-5 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">To</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="bg-black/20 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Subject</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="bg-black/20 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
                  />
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Message</label>
                  <textarea
                    value={composeMessage}
                    onChange={e => setComposeMessage(e.target.value)}
                    required
                    placeholder="Write your email here..."
                    className="bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 flex-1 resize-none font-mono transition-all placeholder:text-gray-600"
                  ></textarea>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold px-10 py-3.5 rounded-2xl transition-all shadow-xl disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {sending ? (
                      <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                    Send Email
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEmail ? (
            <div className="flex flex-col h-full">
              {/* Email Header Info */}
              <div className="p-8 border-b border-white/[0.05] bg-white/[0.01]">
                <div className="flex items-start gap-4 mb-6">
                  <button onClick={() => setSelectedEmail(null)} className="md:hidden mt-1 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full w-8 h-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <h2 className="text-3xl font-bold text-white leading-tight flex-1">{selectedEmail.subject || "(No Subject)"}</h2>
                </div>
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/[0.03]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xl shadow-inner">
                      {selectedEmail.sender ? selectedEmail.sender.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className="text-gray-100 font-semibold text-base">
                        {selectedEmail.sender}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        To: <span className="text-gray-400">{selectedEmail.recipient}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 font-medium bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.05]">
                    {new Date(selectedEmail.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto p-8 bg-black/10">
                {selectedEmail.details ? (
                  <div className="flex flex-col gap-8 max-w-4xl mx-auto">
                    {/* HTML Content Framed in a nice container */}
                    {selectedEmail.details.html ? (
                      <div className="bg-[#fcfcfc] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                        {/* Fake macOS window bar for aesthetic */}
                        <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                        </div>
                        <iframe 
                          srcDoc={selectedEmail.details.html} 
                          className="w-full min-h-[500px] border-0 bg-white" 
                          title="Email Content"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    ) : (
                      /* Text Content */
                      <div className="bg-black/40 p-8 rounded-2xl text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed border border-white/[0.05] shadow-inner">
                        {selectedEmail.details.text || "This email has no content."}
                      </div>
                    )}

                    {/* Attachments Section */}
                    {selectedEmail.details.attachments && selectedEmail.details.attachments.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400">
                            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                          </svg>
                          Attachments ({selectedEmail.details.attachments.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedEmail.details.attachments.map((att: any, idx: number) => (
                            <a 
                              key={idx}
                              href={att.url} 
                              download={att.filename}
                              target="_blank"
                              className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/[0.05] hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all group shadow-sm"
                            >
                              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-200 truncate group-hover:text-white">{att.filename}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{formatBytes(att.size)}</p>
                              </div>
                              <div className="text-gray-600 group-hover:text-emerald-400 p-2 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 h-full">
              <div className="w-24 h-24 rounded-3xl bg-white/[0.01] flex items-center justify-center mb-6 shadow-inner border border-white/[0.03]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="0.5" stroke="currentColor" className="w-12 h-12 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-gray-300 mb-2">Your inbox awaits</p>
              <p className="text-sm text-gray-500 max-w-sm text-center leading-relaxed">Select an email from the side panel to view its contents or click Compose to start a new message.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
