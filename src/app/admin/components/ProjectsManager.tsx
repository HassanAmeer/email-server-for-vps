"use client";

import { useState, useEffect } from "react";

interface Project {
  id: number;
  name: string;
  api_key: string;
  webhook_url: string | null;
  is_active: boolean | number;
  created_at: string;
  retention_generated_emails: number | null;
  retention_simple_mails: number | null;
  retention_attachments: number | null;
}

interface ProjectsManagerProps {
  apiUrl: string;
}

export default function ProjectsManager({ apiUrl }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingWebhookFor, setEditingWebhookFor] = useState<number | null>(null);
  const [editingWebhookUrl, setEditingWebhookUrl] = useState("");

  const [editingNameFor, setEditingNameFor] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [viewingAnalyticsFor, setViewingAnalyticsFor] = useState<Project | null>(null);
  const [projectStatsData, setProjectStatsData] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<"receive" | "send" | "webmail">("receive");
  
  const [webmailUsersData, setWebmailUsersData] = useState<any[]>([]);
  const [loadingWebmailUsers, setLoadingWebmailUsers] = useState(false);
  const [newWebmailEmail, setNewWebmailEmail] = useState("");
  const [newWebmailPassword, setNewWebmailPassword] = useState("");
  const [isCreatingWebmail, setIsCreatingWebmail] = useState(false);
  const [projectEmailsData, setProjectEmailsData] = useState<any | null>(null);
  const [emailsPage, setEmailsPage] = useState(1);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailFilter, setEmailFilter] = useState("all");

  const [retentionGenerated, setRetentionGenerated] = useState<string>("");
  const [retentionSimple, setRetentionSimple] = useState<string>("");
  const [retentionAttachments, setRetentionAttachments] = useState<string>("");
  const [isSavingRetention, setIsSavingRetention] = useState(false);

  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [projectFilesData, setProjectFilesData] = useState<any | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const fetchProjects = async () => {
    if (!apiUrl) return;
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setError("");
      } else if (res.status === 401) {
        window.location.href = "/admin";
      } else {
        throw new Error("Failed to load projects");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    fetchProjects();
  }, [apiUrl]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: newProjectName })
      });

      if (res.ok) {
        setNewProjectName("");
        await fetchProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Are you sure you want to delete this project? This will break API integrations using its API Key.")) return;

    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveWebhook = async (id: number) => {
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ webhook_url: editingWebhookUrl })
      });

      if (res.ok) {
        setEditingWebhookFor(null);
        await fetchProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to update webhook");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveName = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: editingName })
      });

      if (res.ok) {
        setEditingNameFor(null);
        await fetchProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to update project name");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean | number) => {
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ is_active: currentStatus ? false : true })
      });

      if (res.ok) {
        await fetchProjects();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle status");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchProjectEmails = async (projectId: number, page: number) => {
    setLoadingEmails(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${projectId}/emails?page=${page}&limit=50`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectEmailsData(data);
      } else {
        setProjectEmailsData(null);
      }
    } catch (err: any) {
      console.error(err);
      setProjectEmailsData(null);
    } finally {
      setLoadingEmails(false);
    }
  };

  const fetchProjectFiles = async (projectId: number) => {
    setLoadingFiles(true);
    setIsFilesModalOpen(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${projectId}/files`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectFilesData(data);
      } else {
        setProjectFilesData(null);
      }
    } catch (err: any) {
      console.error(err);
      setProjectFilesData(null);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchProjectWebmailUsers = async (projectId: number) => {
    setLoadingWebmailUsers(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${projectId}/mailbox`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWebmailUsersData(data.users || []);
      } else {
        setWebmailUsersData([]);
      }
    } catch (err: any) {
      console.error(err);
      setWebmailUsersData([]);
    } finally {
      setLoadingWebmailUsers(false);
    }
  };

  const handleCreateWebmailUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingAnalyticsFor || !newWebmailEmail || !newWebmailPassword) return;

    setIsCreatingWebmail(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${viewingAnalyticsFor.id}/mailbox`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: newWebmailEmail, password: newWebmailPassword })
      });

      if (res.ok) {
        setNewWebmailEmail("");
        setNewWebmailPassword("");
        await fetchProjectWebmailUsers(viewingAnalyticsFor.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create webmail user");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingWebmail(false);
    }
  };

  const handleDeleteWebmailUser = async (userId: number) => {
    if (!viewingAnalyticsFor || !confirm("Are you sure you want to delete this webmail user?")) return;

    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${viewingAnalyticsFor.id}/mailbox/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchProjectWebmailUsers(viewingAnalyticsFor.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete webmail user");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };


  const handleViewStats = async (project: Project) => {
    setViewingAnalyticsFor(project);
    setActiveAnalyticsTab("receive");
    setEmailsPage(1);
    
    // Set initial retention values
    setRetentionGenerated(project.retention_generated_emails ? project.retention_generated_emails.toString() : "");
    setRetentionSimple(project.retention_simple_mails ? project.retention_simple_mails.toString() : "");
    setRetentionAttachments(project.retention_attachments ? project.retention_attachments.toString() : "");

    setLoadingStats(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${project.id}/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectStatsData(data);
      } else {
        setProjectStatsData(null);
      }

      await fetchProjectEmails(project.id, 1);
      await fetchProjectWebmailUsers(project.id);
    } catch (err: any) {
      console.error(err);
      setProjectStatsData(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSaveRetention = async () => {
    if (!viewingAnalyticsFor) return;
    setIsSavingRetention(true);
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${viewingAnalyticsFor.id}/retention`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          retention_generated_emails: retentionGenerated ? parseInt(retentionGenerated) : 0,
          retention_simple_mails: retentionSimple ? parseInt(retentionSimple) : 0,
          retention_attachments: retentionAttachments ? parseInt(retentionAttachments) : 0,
        })
      });

      if (res.ok) {
        // Optimistically update the local state to avoid refetching
        setProjects(prev => prev.map(p => {
          if (p.id === viewingAnalyticsFor.id) {
            return {
              ...p,
              retention_generated_emails: retentionGenerated ? parseInt(retentionGenerated) : 0,
              retention_simple_mails: retentionSimple ? parseInt(retentionSimple) : 0,
              retention_attachments: retentionAttachments ? parseInt(retentionAttachments) : 0,
            };
          }
          return p;
        }));
        alert("Data retention settings saved successfully!");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to update retention settings");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingRetention(false);
    }
  };

  const handleResetProjectHits = async (project: Project) => {
    if (!window.confirm(`Are you sure you want to reset API hits for project "${project.name}"?`)) return;
    try {
      const token = localStorage.getItem("admin_token") || "";
      const res = await fetch(`${apiUrl}/api/admin/projects/${project.id}/hits`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        // Refresh stats
        await handleViewStats(project);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to reset hits");
      }
    } catch (error) {
      console.error(error);
      alert("Error resetting hits");
    }
  };

  useEffect(() => {
    if (viewingAnalyticsFor && activeAnalyticsTab === "receive") {
      fetchProjectEmails(viewingAnalyticsFor.id, emailsPage);
    }
  }, [emailsPage, activeAnalyticsTab]);

  if (viewingAnalyticsFor) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewingAnalyticsFor(null)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] text-gray-300 rounded-xl transition-colors text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Projects
          </button>
        </div>

        <div className="glass-panel border-white/[0.05] rounded-2xl p-6">
          <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="text-gray-400">
                Project Analytics:
              </span>
              {viewingAnalyticsFor.name}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>API Key: <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">{viewingAnalyticsFor.api_key}</code></span>
              <span>•</span>
              <span>Status: <span className={viewingAnalyticsFor.is_active ? "text-emerald-400" : "text-rose-400"}>{viewingAnalyticsFor.is_active ? "Active" : "Disabled"}</span></span>
              <span>•</span>
              <button
                onClick={() => handleResetProjectHits(viewingAnalyticsFor)}
                className="text-red-400 hover:text-red-300 font-semibold text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
              >
                Reset API Hits
              </button>
            </div>
          </div>

          <div className="flex border-b border-white/[0.05] mb-6">
            <button
              onClick={() => setActiveAnalyticsTab("receive")}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeAnalyticsTab === "receive"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
            >
              Receive Email
            </button>
            <button
              onClick={() => setActiveAnalyticsTab("send")}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeAnalyticsTab === "send"
                ? "border-indigo-400 text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
            >
              Send Email
            </button>
            <button
              onClick={() => setActiveAnalyticsTab("webmail")}
              className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeAnalyticsTab === "webmail"
                ? "border-purple-400 text-purple-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
            >
              Webmail Users
            </button>
          </div>

          {activeAnalyticsTab === "webmail" ? (
            <div className="flex flex-col gap-6">
              <div className="glass-panel border-white/[0.05] rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Create Webmail User</h3>
                <form onSubmit={handleCreateWebmailUser} className="flex flex-col md:flex-row gap-4">
                  <input
                    type="email"
                    required
                    placeholder="User Email Address"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500/50"
                    value={newWebmailEmail}
                    onChange={(e) => setNewWebmailEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500/50"
                    value={newWebmailPassword}
                    onChange={(e) => setNewWebmailPassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isCreatingWebmail}
                    className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isCreatingWebmail ? "Creating..." : "Create User"}
                  </button>
                </form>
              </div>

              <div className="glass-panel border-white/[0.05] rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Webmail Users</h3>
                {loadingWebmailUsers ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : webmailUsersData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No webmail users found for this project.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.05]">
                          <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                          <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Created At</th>
                          <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {webmailUsersData.map((user) => (
                          <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3">
                              <span className="text-white font-medium">{user.email}</span>
                            </td>
                            <td className="p-3 text-sm text-gray-400">
                              {new Date(user.created_at).toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteWebmailUser(user.id)}
                                className="text-rose-400 hover:text-rose-300 font-semibold text-xs px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : activeAnalyticsTab === "send" ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16 text-gray-600 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <h3 className="text-xl font-bold text-gray-400">Disabled by Dev</h3>
              <p className="text-gray-500 text-sm mt-2">Sending module analytics are currently disabled.</p>
            </div>
          ) : (
            <>
              {loadingStats ? (
                <div className="py-20 flex justify-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : projectStatsData ? (
                <div className="flex flex-col gap-8">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="glass-panel hover-3d border-white/[0.05] p-5 rounded-xl transition-colors">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total API Hits</span>
                      <p className="text-3xl font-black text-white mt-2">{projectStatsData.totalHits}</p>
                    </div>
                    <div className="glass-panel hover-3d border-white/[0.05] p-5 rounded-xl transition-colors">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Generated Emails</span>
                      <p className="text-3xl font-black text-white mt-2">{projectStatsData.totalInboxes}</p>
                    </div>
                    <div className="glass-panel hover-3d border-white/[0.05] p-5 rounded-xl transition-colors flex flex-col justify-center">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">Simple Received:</span>
                        <span className="text-white font-bold">{projectStatsData.simpleReceived}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-white/[0.05]">
                        <span className="text-gray-400">Attachments:</span>
                        <span className="text-amber-400 font-bold">{projectStatsData.attachmentReceived}</span>
                      </div>
                    </div>
                    <div className="glass-panel hover-3d border-white/[0.05] p-5 rounded-xl transition-colors">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total Received</span>
                      <p className="text-3xl font-black text-white mt-2">{projectStatsData.totalReceived}</p>
                    </div>
                    <div className="glass-panel hover-3d border-white/[0.05] p-5 rounded-xl transition-colors">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Storage Used</span>
                      <p className="text-3xl font-black text-white mt-2 text-indigo-400">{formatBytes(projectStatsData.totalStorageUsed)}</p>
                    </div>
                  </div>

                  {/* Data Retention Settings */}
                  <div className="glass-panel hover-3d border-white/[0.05] rounded-xl p-5">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-emerald-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6m-3 18c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h13.5A2.25 2.25 0 0120.25 4.5v11.25m-18 0C2.25 21.5 9 22.5 15 22.5c1.5 0 3-.225 4.5-.675m-18-6.075v6.075c0 1.243 1.007 2.25 2.25 2.25h11.25" />
                      </svg>
                      Data Retention Settings
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Set how many days to keep data before automatically deleting it. Leave empty or 0 to keep data forever.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Keep Generated Emails (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={retentionGenerated}
                          onChange={(e) => setRetentionGenerated(e.target.value)}
                          placeholder="Forever"
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Keep Simple Emails (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={retentionSimple}
                          onChange={(e) => setRetentionSimple(e.target.value)}
                          placeholder="Forever"
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Keep Emails with Attachments (Days)</label>
                        <input
                          type="number"
                          min="0"
                          value={retentionAttachments}
                          onChange={(e) => setRetentionAttachments(e.target.value)}
                          placeholder="Forever"
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveRetention}
                        disabled={isSavingRetention}
                        className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50"
                      >
                        {isSavingRetention ? "Saving..." : "Save Settings"}
                      </button>
                    </div>
                  </div>

                  {/* All Received Emails Table */}
                  <div className="glass-panel hover-3d border-white/[0.05] rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-emerald-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        All Received Emails
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <select
                            value={emailFilter}
                            onChange={(e) => setEmailFilter(e.target.value)}
                            className="appearance-none bg-[#0D121F] border border-white/10 hover:border-emerald-500/30 text-xs text-gray-300 rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all cursor-pointer font-semibold shadow-sm"
                          >
                            <option value="all" className="bg-[#0D121F]">All Emails</option>
                            <option value="simple" className="bg-[#0D121F]">Simple Only</option>
                            <option value="attachment" className="bg-[#0D121F]">Attachments Only</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                        <button
                          onClick={() => fetchProjectFiles(viewingAnalyticsFor.id)}
                          className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded transition-colors font-semibold"
                        >
                          View All Files
                        </button>
                        <button
                          onClick={() => fetchProjectEmails(viewingAnalyticsFor.id, emailsPage)}
                          className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded transition-colors"
                        >
                          Refresh List
                        </button>
                      </div>
                    </div>

                    {loadingEmails ? (
                      <div className="py-10 flex justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {projectEmailsData && projectEmailsData.data && projectEmailsData.data.length > 0 ? (
                          <>
                            <table className="w-full text-left text-xs text-gray-400 min-w-[700px]">
                              <thead className="text-[10px] uppercase tracking-wider border-b border-white/[0.05]">
                                <tr>
                                  <th className="py-2 px-4">Recipient</th>
                                  <th className="py-2 px-4">Sender</th>
                                  <th className="py-2 px-4">Subject</th>
                                  <th className="py-2 px-4 w-24 text-center">Type</th>
                                  <th className="py-2 px-4 text-right">Size</th>
                                  <th className="py-2 px-4 text-right">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.02]">
                                {projectEmailsData.data.filter((mail: any) => {
                                  if (emailFilter === "simple") return !mail.has_attachment;
                                  if (emailFilter === "attachment") return mail.has_attachment;
                                  return true;
                                }).map((mail: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-white/[0.02]">
                                    <td className="py-3 px-4 font-mono text-gray-300">{mail.recipient}</td>
                                    <td className="py-3 px-4 truncate max-w-[150px]">{mail.sender}</td>
                                    <td className="py-3 px-4 truncate max-w-[200px]">{mail.subject || "(No Subject)"}</td>
                                    <td className="py-3 px-4 text-center">
                                      {mail.has_attachment ? (
                                        <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
                                          Media
                                        </span>
                                      ) : (
                                        <span className="bg-white/5 text-gray-400 px-2 py-1 rounded text-[10px] font-bold">
                                          Simple
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      {mail.has_attachment ? <span className="text-gray-400">{formatBytes(mail.attachment_size)}</span> : <span className="text-gray-600">-</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right">{new Date(mail.created_at).toLocaleString()}</td>
                                  </tr>
                                ))}
                                {projectEmailsData.data.filter((mail: any) => {
                                  if (emailFilter === "simple") return !mail.has_attachment;
                                  if (emailFilter === "attachment") return mail.has_attachment;
                                  return true;
                                }).length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                                        No emails match the selected filter.
                                      </td>
                                    </tr>
                                  )}
                              </tbody>
                            </table>

                            {/* Pagination Controls */}
                            {projectEmailsData.pagination.totalPages > 1 && (
                              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/[0.05]">
                                <button
                                  onClick={() => setEmailsPage(p => Math.max(1, p - 1))}
                                  disabled={emailsPage === 1}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-gray-300 transition-colors"
                                >
                                  Previous
                                </button>
                                <span className="text-xs text-gray-500">
                                  Page {emailsPage} of {projectEmailsData.pagination.totalPages}
                                </span>
                                <button
                                  onClick={() => setEmailsPage(p => Math.min(projectEmailsData.pagination.totalPages, p + 1))}
                                  disabled={emailsPage === projectEmailsData.pagination.totalPages}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-gray-300 transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-gray-500 text-center py-6">No emails received yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-red-400 text-sm text-center py-10">Failed to load analytics data.</div>
              )}
            </>
          )}

          {/* Files Modal */}
          {isFilesModalOpen && viewingAnalyticsFor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-[#0D121F] border border-white/[0.05] w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-sky-500"></div>
                
                <div className="flex justify-between items-center p-6 border-b border-white/[0.05]">
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-emerald-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                      </svg>
                      Project Storage Files
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Showing physical files (JSON records and Media Attachments) on disk for <span className="text-emerald-400 font-semibold">{(viewingAnalyticsFor as Project).name}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setIsFilesModalOpen(false)}
                    className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
                  {loadingFiles ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-400 font-mono">Scanning storage directory...</p>
                    </div>
                  ) : projectFilesData ? (
                    <>
                      <div className="bg-[#111726] border border-white/[0.05] p-5 rounded-2xl flex justify-between items-center shadow-inner">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Storage Used</span>
                          <span className="text-2xl font-bold text-emerald-400 font-mono">
                            {formatBytes(projectFilesData.totalSizeBytes)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Files Count</span>
                          <span className="text-2xl font-bold text-white font-mono">
                            {projectFilesData.files.length}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-white/[0.05] bg-black/20">
                        <table className="w-full text-left text-xs text-gray-400 min-w-[600px]">
                          <thead className="text-[10px] uppercase tracking-wider border-b border-white/[0.05] bg-black/40">
                            <tr>
                              <th className="py-3 px-4">Filename</th>
                              <th className="py-3 px-4 w-32 text-center">Type</th>
                              <th className="py-3 px-4 w-32 text-right">Size</th>
                              <th className="py-3 px-4 w-48 text-right">Created At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.02]">
                            {projectFilesData.files.map((file: any) => (
                              <tr key={file.id} className="hover:bg-white/[0.02]">
                                <td className="py-3 px-4 font-mono text-gray-300 break-all">{file.name}</td>
                                <td className="py-3 px-4 text-center">
                                  {file.type === "Media Attachment" ? (
                                    <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-[10px] font-bold inline-block">
                                      Attachment
                                  </span>
                                  ) : (
                                    <span className="bg-sky-500/10 text-sky-400 px-2 py-1 rounded text-[10px] font-bold inline-block">
                                      JSON Record
                                  </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap font-mono">{formatBytes(file.sizeBytes)}</td>
                                <td className="py-3 px-4 text-right text-gray-500">{new Date(file.createdAt).toLocaleString()}</td>
                              </tr>
                            ))}
                            {projectFilesData.files.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                                  No physical files found on disk for this project.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center text-red-400">
                      Failed to load files data.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-emerald-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Projects & API Keys
        </h1>
        <p className="text-gray-400 text-sm">
          Create projects to generate unique API Keys and set up Webhooks for real-time notifications.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Create Project Form */}
      <form onSubmit={handleCreateProject} className="bg-slate-900/50 border border-white/[0.05] rounded-2xl p-5 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">New Project Name</label>
          <input
            type="text"
            placeholder="e.g. My Hostinger Website"
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isCreating ? "Creating..." : "Create Project"}
        </button>
      </form>

      {/* Projects List */}
      <div className="bg-slate-900/30 border border-white/[0.05] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-gray-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.452.15.15 0 00-.063-.311" />
              </svg>
            </div>
            <h3 className="text-white font-medium text-lg mb-1">No Projects Found</h3>
            <p className="text-gray-500 text-sm max-w-xs">Create your first project above to generate an API key.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {projects.map(project => (
              <div key={project.id} className="flex flex-col">
                <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6 justify-between lg:items-center hover:bg-white/[0.01] transition-colors">

                  {/* Project Info */}
                  <div className="flex-1 flex flex-col gap-4">
                    {/* First Row: Project Name & Edit Icon */}
                    <div className="flex items-center gap-3">
                      {editingNameFor === project.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-slate-950 border border-emerald-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName(project.id)}
                          />
                          <button
                            onClick={() => handleSaveName(project.id)}
                            className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 px-2 py-1 rounded-lg font-bold transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNameFor(null)}
                            className="text-xs bg-white/5 text-gray-400 hover:text-white px-2 py-1 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white leading-none">{project.name}</h3>
                          <button
                            onClick={() => {
                              setEditingName(project.name);
                              setEditingNameFor(project.id);
                            }}
                            className="text-gray-500 hover:text-emerald-400 transition-colors p-1"
                            title="Rename Project"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-0">
                      {/* Second Row: Labels & Status Toggle */}
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Key</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-1 rounded text-[10px] font-bold bg-white/5 text-gray-400 border border-white/10 flex items-center">
                              ID: {project.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${project.is_active ? 'text-emerald-400' : 'text-gray-400'
                              }`}>
                              {project.is_active ? 'Active' : 'Paused'}
                            </span>
                            <button
                              onClick={() => handleToggleActive(project.id, project.is_active)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${project.is_active ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${project.is_active ? 'translate-x-4.5' : 'translate-x-1'
                                  }`}
                              />
                            </button>

                          </div>
                        </div>
                      </div>

                      {/* Third Row: Values (API Key String, Webhook) */}
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                        {/* API Key Value */}
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 font-mono min-w-[280px]">
                            {project.api_key}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(project.api_key);
                              alert("API Key copied!");
                            }}
                            className="text-gray-500 hover:text-white transition-colors p-1"
                            title="Copy API Key"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          </button>
                        </div>

                        {/* Webhook URL */}
                        <div className="flex flex-col flex-1 min-w-[200px]">
                          {editingWebhookFor === project.id ? (
                            <div className="flex items-center gap-2 h-[32px]">
                              <input
                                type="url"
                                placeholder="https://your-domain.com/webhook"
                                value={editingWebhookUrl}
                                onChange={(e) => setEditingWebhookUrl(e.target.value)}
                                className="flex-1 bg-slate-950 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveWebhook(project.id)}
                                className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 px-3 py-1.5 rounded-lg font-bold transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingWebhookFor(null)}
                                className="text-xs bg-white/5 text-gray-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/edit h-[32px]">
                              <span className={`text-sm ${project.webhook_url ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                                {project.webhook_url || "Webhook not configured"}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingWebhookUrl(project.webhook_url || "");
                                  setEditingWebhookFor(project.id);
                                }}
                                className="text-gray-500 hover:text-emerald-400 transition-colors p-1"
                                title="Edit Webhook"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 mt-4 lg:mt-0">
                    <button
                      onClick={() => handleViewStats(project)}
                      className="group flex items-center gap-2 px-5 py-2.5 bg-transparent border border-indigo-500/50 hover:border-indigo-400 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl text-xs font-extrabold transition-all duration-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 group-hover:scale-110 transition-transform duration-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0119.5 16.5h-2.25m-9 0h9l-4.5-5.25L9 16.5z" />
                      </svg>
                      <span className="tracking-wider">View Analytics</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
