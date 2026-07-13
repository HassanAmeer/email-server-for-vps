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
        // The API returns { data: [...], pagination: {...} }
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.05] bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Webmail</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-500">Logged in as </span>
              <span className="text-purple-400 font-semibold">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] rounded-lg transition-colors border border-white/[0.05]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 flex gap-6 overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Email List */}
        <div className={`w-full md:w-1/3 lg:w-2/5 flex flex-col glass-panel border-white/[0.05] rounded-2xl overflow-hidden h-full ${(selectedEmail || showCompose) ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-white/[0.05] flex justify-between items-center bg-black/20">
            <h2 className="font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-purple-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
              </svg>
              Inbox
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => fetchEmails(localStorage.getItem("webmail_token") || "")}
                className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Refresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
              <button
                onClick={() => { setSelectedEmail(null); setShowCompose(true); }}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                Compose
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="animate-pulse flex flex-col gap-3 p-4 border border-white/[0.05] rounded-xl bg-white/[0.02] shadow-sm">
                    <div className="flex justify-between items-center gap-4">
                      <div className="h-4 bg-white/[0.08] rounded-md w-1/3"></div>
                      <div className="h-3 bg-white/[0.05] rounded-md w-16"></div>
                    </div>
                    <div className="h-3 bg-white/[0.05] rounded-md w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-400 text-sm">{error}</div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-12 h-12 mb-3 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Your inbox is empty
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {emails.map(email => (
                  <div 
                    key={email.id} 
                    onClick={() => handleViewEmail(email)}
                    className={`p-4 cursor-pointer hover:bg-white/[0.04] transition-colors border-l-2 ${selectedEmail?.id === email.id ? 'bg-white/[0.06] border-purple-500' : 'border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-white truncate flex-1">{email.sender}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(email.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 font-medium truncate mb-1">{email.subject || "(No Subject)"}</div>
                    
                    {email.has_attachment === 1 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-amber-500/20">
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
        <div className={`flex-1 flex-col glass-panel border-white/[0.05] rounded-2xl overflow-hidden h-full relative ${(selectedEmail || showCompose) ? 'flex' : 'hidden md:flex'}`}>
          {showCompose ? (
            <div className="flex flex-col h-full bg-[#0a0a0a]">
              <div className="p-6 border-b border-white/[0.05] bg-black/20 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <button onClick={() => setShowCompose(false)} className="md:hidden flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full w-8 h-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-purple-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Compose New Email
                </h2>
                <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSendEmail} className="flex flex-col flex-1 p-6 gap-4 overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">To</label>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={e => setComposeTo(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message</label>
                  <textarea
                    value={composeMessage}
                    onChange={e => setComposeMessage(e.target.value)}
                    required
                    placeholder="Write your email here..."
                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 flex-1 resize-none font-mono"
                  ></textarea>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-8 py-2.5 rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                    Send Email
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEmail ? (
            <>
              {/* Email Header Info */}
              <div className="p-6 border-b border-white/[0.05] bg-black/20">
                <div className="flex items-start gap-4 mb-4">
                  <button onClick={() => setSelectedEmail(null)} className="md:hidden mt-1 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full w-8 h-8">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  </button>
                  <h2 className="text-2xl font-bold text-white leading-tight flex-1">{selectedEmail.subject || "(No Subject)"}</h2>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                      {selectedEmail.sender ? selectedEmail.sender.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {selectedEmail.sender}
                      </div>
                      <div className="text-xs text-gray-500">
                        To: {selectedEmail.recipient}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(selectedEmail.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto p-6 bg-white/[0.02]">
                {selectedEmail.details ? (
                  <div className="flex flex-col gap-6">
                    {/* HTML Content */}
                    {selectedEmail.details.html ? (
                      <div className="bg-white rounded-xl p-6 shadow-inner min-h-[300px]">
                        <iframe 
                          srcDoc={selectedEmail.details.html} 
                          className="w-full h-[500px] border-0" 
                          title="Email Content"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    ) : (
                      /* Text Content */
                      <div className="bg-[#111] p-6 rounded-xl text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed border border-white/[0.05]">
                        {selectedEmail.details.text || "This email has no content."}
                      </div>
                    )}

                    {/* Attachments Section */}
                    {selectedEmail.details.attachments && selectedEmail.details.attachments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2 border-b border-white/[0.05] pb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-purple-400">
                            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                          </svg>
                          Attachments ({selectedEmail.details.attachments.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedEmail.details.attachments.map((att: any, idx: number) => (
                            <a 
                              key={idx}
                              href={att.url} 
                              download={att.filename}
                              target="_blank"
                              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:border-purple-500/30 transition-all group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white">{att.filename}</p>
                                <p className="text-xs text-gray-500">{formatBytes(att.size)}</p>
                              </div>
                              <div className="text-gray-500 group-hover:text-purple-400 p-2">
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
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
              <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mb-6 shadow-inner border border-white/[0.05]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor" className="w-10 h-10 text-gray-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-lg font-medium text-white mb-2">No email selected</p>
              <p className="text-sm">Select an email from the inbox list to read its contents, or compose a new email.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
