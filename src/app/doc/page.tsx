"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// ─── Copy Icon ───────────────────────────────────────────────────────────────
const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

// ─── Data ────────────────────────────────────────────────────────────────────
const endpoints = [
  {
    id: "get-domains",
    method: "GET",
    path: "/api/domains",
    title: "Get Active Domains",
    category: "Receive Mail",
    desc: "Fetch a list of all active domains available for generating temporary email addresses. Use this list to let users choose a domain before generation.",
    payload: null,
    response: `{
  "domains": [
    "llamerada.online",
    "tempemail.vps"
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/domains",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "generate",
    method: "GET",
    path: "/api/mailbox/generate",
    title: "Generate Mailbox",
    category: "Receive Mail",
    desc: "Dynamically allocates a random transient email address. Optionally pass a `domain` query parameter to force generation on a specific active domain.",
    payload: null,
    response: `{
  "email": "a1b2c3d4@tempemail.vps"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/generate?domain=tempemail.vps",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "custom-generate",
    method: "GET",
    path: "/api/mailbox/custom",
    title: "Custom Address Mailbox",
    category: "Receive Mail",
    desc: "Create a custom email address with your chosen name. Pass `name` (required) and optionally `domain`. Returns 409 if the address is already taken. Only letters, numbers, dots, hyphens, and underscores are allowed (1-64 chars).",
    payload: null,
    response: `{
  "email": "myname@tempemail.vps"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/custom?name=myname&domain=tempemail.vps",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "get-mailbox",
    method: "GET",
    path: "/api/mailbox/:email",
    title: "Fetch Inbox Mails",
    category: "Receive Mail",
    desc: "Retrieves all captured emails sent to the specified transient mailbox, including parsed sender info, subject, body text, HTML, and any attachment metadata.",
    payload: null,
    response: `[
  {
    "id": "1234567890",
    "from": "noreply@github.com",
    "to": "test@tempemail.vps",
    "subject": "Verify your email",
    "text": "Your code is 123456",
    "html": "<p>Your code is <b>123456</b></p>",
    "date": "2026-07-07T10:17:02.000Z",
    "attachments": [
      {
        "filename": "invoice.pdf",
        "size": 14205,
        "url": "/api/attachments/1234567890-invoice.pdf"
      }
    ]
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/test@tempemail.vps",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "extract-otp",
    method: "GET",
    path: "/api/mailbox/:email/otps",
    title: "Extract OTP Codes",
    category: "Receive Mail",
    desc: "Scans inbound emails in the specified mailbox and extracts all detected 4-6 digit numeric OTP verification codes via regex. Returns structured objects ready for test assertion.",
    payload: null,
    response: `[
  {
    "otp": "123456",
    "from": "noreply@github.com",
    "subject": "Verify your email",
    "date": "2026-07-07T10:17:02.000Z",
    "mailId": "1234567890"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/test@tempemail.vps/otps",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "get-attachment",
    method: "GET",
    path: "/api/attachments/:filename",
    title: "Download Attachment",
    category: "Receive Mail",
    desc: "Streams the raw binary payload of a previously saved email attachment. The filename is returned in the attachment metadata from the inbox endpoint.",
    payload: null,
    response: `Binary Data (File Stream)`,
    exampleUrl: "http://your-vps-ip:8081/api/attachments/1234567890-invoice.pdf",
    returns: "Binary Stream",
    auth: false,
  },
  {
    id: "send-mail-live",
    method: "POST",
    path: "/api/send-email/live",
    title: "Send Custom Email (Live)",
    category: "Send Mail",
    desc: "Dispatches an outbound email to any public internet address using your VPS SMTP node. Supports plain text and HTML bodies. Optionally include DKIM signing.",
    payload: `{
  "from": "sender@your-domain.com",
  "to": "recipient@example.com",
  "subject": "Hello World",
  "text": "Plain text body content",
  "html": "<p>HTML body <b>content</b></p>"
}`,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/send-email/live",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "delete-mailbox",
    method: "DELETE",
    path: "/api/mailbox/:email",
    title: "Delete Mailbox",
    category: "Receive Mail",
    desc: "Purges the entire mailbox storage history. Useful for cleanup between test runs.",
    payload: null,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/test@tempemail.vps",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "delete-mail",
    method: "DELETE",
    path: "/api/mailbox/:email/:mailId",
    title: "Delete Specific Email",
    category: "Receive Mail",
    desc: "Removes a single email by its ID from the mailbox.",
    payload: null,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/test@tempemail.vps/1234567890",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "all-mails",
    method: "GET",
    path: "/api/mails",
    title: "Get All Emails (Global)",
    category: "Admin",
    desc: "Returns a combined, date-sorted feed of every email captured across both the Live SMTP listener and Local Sandbox ports. Useful for admin dashboards or global monitoring.",
    payload: null,
    response: `[
  {
    "id": "...",
    "from": "...",
    "to": "...",
    "subject": "...",
    "type": "live",
    "date": "2026-07-07T10:17:02.000Z"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/mails",
    returns: "JSON Array",
    auth: false,
  },
  // ─── Send Mail (Local) ───
  {
    id: "send-mail-local",
    method: "POST",
    path: "/api/send-email/local",
    title: "Send Email (Local SMTP)",
    category: "Send Mail",
    desc: "Dispatch email locally through the sandbox SMTP Port 2525. Useful for testing email flows without hitting external servers.",
    payload: `{
  "from": "test@localhost",
  "to": "user@localhost",
  "subject": "Test Email",
  "text": "Hello from local"
}`,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/send-email/local",
    returns: "JSON Object",
    auth: true,
  },
  // ─── Admin Management APIs ───
  {
    id: "admin-login",
    method: "POST",
    path: "/api/admin/login",
    title: "Admin Login",
    category: "Admin",
    desc: "Authenticate admin dashboard session. Returns a Bearer token for accessing protected admin endpoints.",
    payload: `{
  "username": "admin",
  "password": "your_password"
}`,
    response: `{
  "success": true,
  "token": "YWRtaW46MTIzNA=="
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/login",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "admin-stats",
    method: "GET",
    path: "/api/admin/stats",
    title: "Server Stats",
    category: "Admin",
    desc: "Get server metrics including disk usage, total emails, generated addresses count, and system uptime.",
    payload: null,
    response: `{
  "totalEmails": 42,
  "totalGenerated": 15,
  "diskUsage": "128 MB"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/stats",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "admin-stats-traffic",
    method: "GET",
    path: "/api/admin/stats/traffic",
    title: "Traffic Stats",
    category: "Admin",
    desc: "Get real-time traffic statistics and API usage analytics for the server dashboard.",
    payload: null,
    response: `{
  "totalRequests": 1250,
  "todayRequests": 48
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/stats/traffic",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "admin-projects",
    method: "GET",
    path: "/api/admin/projects",
    title: "Manage Projects",
    category: "Admin",
    desc: "CRUD operations for API projects. GET lists all projects, POST creates a new project with API key. Supports project stats and email tracking.",
    payload: `{
  "name": "My Project",
  "description": "Test project"
}`,
    response: `[
  {
    "id": 1,
    "name": "My Project",
    "api_key": "abc123...",
    "is_active": 1
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "admin-domains",
    method: "GET",
    path: "/api/admin/domains",
    title: "Manage Attached Domains",
    category: "Admin",
    desc: "CRUD operations for domains attached to the server. GET lists all, POST adds a new domain, DELETE removes a domain.",
    payload: `{
  "domain": "example.com"
}`,
    response: `[
  {
    "id": 1,
    "domain": "llamerada.online",
    "status": "active"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/domains",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "admin-api-settings",
    method: "GET",
    path: "/api/admin/api-settings",
    title: "API Settings",
    category: "Admin",
    desc: "View all API endpoint settings including enabled/disabled status, hit counters, and auth requirements.",
    payload: null,
    response: `[
  {
    "id": "mailbox-generate",
    "method": "GET",
    "path": "/api/mailbox/generate",
    "enabled": true,
    "hits": 42
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/api-settings",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "admin-api-settings-toggle",
    method: "POST",
    path: "/api/admin/api-settings/toggle",
    title: "Toggle API Endpoint",
    category: "Admin",
    desc: "Enable or disable a specific API endpoint by its ID. Disabled endpoints return 503 Service Unavailable.",
    payload: `{
  "id": "mailbox-generate",
  "enabled": false
}`,
    response: `{
  "success": true,
  "api": { "id": "mailbox-generate", "enabled": false }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/api-settings/toggle",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "admin-credentials",
    method: "GET",
    path: "/api/admin/credentials",
    title: "SMTP Credentials",
    category: "Admin",
    desc: "Manage outbound SMTP relay credentials. GET lists all, POST adds new credentials, DELETE removes by username.",
    payload: `{
  "username": "smtp_user",
  "password": "smtp_pass",
  "host": "smtp.example.com",
  "port": 587
}`,
    response: `[
  {
    "username": "smtp_user",
    "host": "smtp.example.com",
    "port": 587
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/credentials",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "admin-dkim",
    method: "GET",
    path: "/api/admin/dkim",
    title: "DKIM Key Management",
    category: "Admin",
    desc: "GET retrieves current DKIM public key. POST /api/admin/dkim/generate creates a new DKIM keypair for email signing.",
    payload: null,
    response: `{
  "publicKey": "v=DKIM1; k=rsa; p=MIIBIjAN..."
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/dkim",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "admin-dblogs",
    method: "GET",
    path: "/api/admin/dblogs/:type",
    title: "Database Logs",
    category: "Admin",
    desc: "Fetch system logs from the database. Type can be: SMTP_IN, SMTP_OUT, ERROR, or ALL.",
    payload: null,
    response: `{
  "data": [...],
  "pagination": { "total": 100, "page": 1, "limit": 50 }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/admin/dblogs/SMTP_IN",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "local-emails-api",
    method: "GET",
    path: "/api/emails/local",
    title: "Local Inbox Emails",
    category: "Send Mail",
    desc: "Fetch all emails received on the local SMTP sandbox. Returns email list and SMTP transaction logs.",
    payload: null,
    response: `[
  {
    "id": "...",
    "from": "test@localhost",
    "to": "user@localhost",
    "subject": "Test"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/emails/local",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "live-emails-api",
    method: "GET",
    path: "/api/emails/live",
    title: "Live Inbox Emails",
    category: "Send Mail",
    desc: "Fetch all emails received on the live SMTP listener. Returns email list and SMTP traffic logs.",
    payload: null,
    response: `[
  {
    "id": "...",
    "from": "sender@example.com",
    "to": "you@yourdomain.com",
    "subject": "Hello"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/emails/live",
    returns: "JSON Array",
    auth: true,
  },
  // ─── Mailbox Client APIs (for Third-Party App Integration) ───
  {
    id: "mailbox-client-login",
    method: "POST",
    path: "/api/mailbox/login",
    title: "Mailbox Login",
    category: "Mailbox Client",
    desc: "Authenticate a permanent mailbox user (e.g. support@yourdomain.com) with their email and password. Returns a Bearer token to use in subsequent API requests.",
    payload: `{
  "email": "support@yourdomain.com",
  "password": "your_secure_password"
}`,
    response: `{
  "success": true,
  "token": "a1b2c3d4...hextoken...:support@yourdomain.com",
  "user": {
    "id": 1,
    "email": "support@yourdomain.com",
    "project_id": 2,
    "created_at": "2026-07-01T10:00:00Z"
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/login",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "mailbox-client-inbox",
    method: "GET",
    path: "/api/mailbox/inbox",
    title: "Mailbox Inbox",
    category: "Mailbox Client",
    desc: "Retrieve paginated inbox messages for the authenticated mailbox user. Pass your token via `Authorization: Bearer <token>`. Supports `?page` and `?limit` query parameters.",
    payload: null,
    response: `{
  "data": [
    {
      "id": 42,
      "recipient": "support@yourdomain.com",
      "sender": "noreply@github.com",
      "subject": "Your verification code",
      "has_attachment": 0,
      "created_at": "2026-07-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalRecords": 1,
    "totalPages": 1
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox?page=1&limit=50",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "mailbox-client-count",
    method: "GET",
    path: "/api/mailbox/count",
    title: "Mailbox Message Count",
    category: "Mailbox Client",
    desc: "Returns the total number of messages in the authenticated user's inbox. Useful for unread badge counts in third-party apps. Does not count toward project API hit limits.",
    payload: null,
    response: `{
  "email": "support@yourdomain.com",
  "count": 7
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/count",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "mailbox-client-read",
    method: "GET",
    path: "/api/mailbox/inbox/:id",
    title: "Read Specific Email",
    category: "Mailbox Client",
    desc: "Fetch the full parsed content of a specific email by its database record ID. Returns sender info, subject, plain text body, HTML body, and any attachment metadata.",
    payload: null,
    response: `{
  "id": "1234567890",
  "from": "noreply@github.com",
  "to": "support@yourdomain.com",
  "subject": "Verify your email",
  "text": "Your code is 123456",
  "html": "<p>Your code is <b>123456</b></p>",
  "date": "2026-07-15T10:17:02.000Z",
  "attachments": []
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox/42",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "mailbox-client-delete",
    method: "DELETE",
    path: "/api/mailbox/inbox/:id",
    title: "Delete Email",
    category: "Mailbox Client",
    desc: "Delete a specific email from the authenticated mailbox user's inbox by its database record ID. Removes both the DB record and the stored JSON file.",
    payload: null,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox/42",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "mailbox-client-media",
    method: "GET",
    path: "/api/mailbox/media",
    title: "List Media Attachments",
    category: "Mailbox Client",
    desc: "Returns all media/file attachments received in the authenticated mailbox. Includes filename, MIME type, file size, and a public download URL.",
    payload: null,
    response: `{
  "media": [
    {
      "emailId": 42,
      "sender": "noreply@invoices.com",
      "date": "2026-07-15T09:00:00Z",
      "filename": "invoice.pdf",
      "contentType": "application/pdf",
      "size": 14205,
      "url": "/api/attachments/1234567890-invoice.pdf"
    }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/media",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "mailbox-client-send",
    method: "POST",
    path: "/api/mailbox/send",
    title: "Send Email (Mailbox)",
    category: "Mailbox Client",
    desc: "Send an outbound email from the authenticated permanent mailbox address. The `from` is automatically set to the logged-in user's mailbox email.",
    payload: `{
  "to": "recipient@example.com",
  "subject": "Hello from my mailbox",
  "message": "This is the email body."
}`,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/send",
    returns: "JSON Object",
    auth: true,
  }
];

const methodColors: Record<string, { badge: string; glow: string; dot: string }> = {
  GET: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", glow: "shadow-emerald-500/10", dot: "bg-emerald-500" },
  POST: { badge: "bg-violet-500/10 text-violet-400 border-violet-500/25", glow: "shadow-violet-500/10", dot: "bg-violet-500" },
  DELETE: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/25", glow: "shadow-rose-500/10", dot: "bg-rose-500" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ApiDocumentation() {
  const [activeTab, setActiveTab] = useState(endpoints[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://localhost:8081");
  const [codeLang, setCodeLang] = useState<"curl" | "js" | "python" | "php">("curl");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
      const token = localStorage.getItem("admin_token");
      if (token) setIsAdmin(true);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateSnippet = (lang: string, method: string, url: string, auth: boolean, payload: string | null) => {
    const finalUrl = url.replace('http://your-vps-ip:8081', baseUrl);
    const headers = auth ? ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"` : "";
    const headersJs = auth ? `,\n    headers: {\n      "Authorization": "Bearer YOUR_API_KEY"${payload ? ',\n      "Content-Type": "application/json"' : ''}\n    }` : (payload ? `,\n    headers: {\n      "Content-Type": "application/json"\n    }` : "");
    const headersPy = auth ? `headers = {\n    "Authorization": "Bearer YOUR_API_KEY"${payload ? ',\n    "Content-Type": "application/json"' : ''}\n}\n` : (payload ? `headers = {\n    "Content-Type": "application/json"\n}\n` : "");
    const headersPhp = auth ? `\n    CURLOPT_HTTPHEADER => array(\n        "Authorization: Bearer YOUR_API_KEY"${payload ? ',\n        "Content-Type": "application/json"' : ''}\n    ),` : (payload ? `\n    CURLOPT_HTTPHEADER => array(\n        "Content-Type: application/json"\n    ),` : "");

    if (lang === "curl") {
      let cmd = `curl -X ${method} "${finalUrl}"${headers}`;
      if (payload) cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${payload}'`;
      return cmd;
    }
    if (lang === "js") {
      if (method === "GET" && !auth && !payload) {
        return `fetch("${finalUrl}")\n  .then(response => response.json())\n  .then(data => console.log(data));`;
      }
      let cmd = `fetch("${finalUrl}", {\n    method: "${method}"${headersJs}`;
      if (payload) cmd += `,\n    body: JSON.stringify(${payload})`;
      cmd += `\n  })\n  .then(response => response.json())\n  .then(data => console.log(data));`;
      return cmd;
    }
    if (lang === "python") {
      let cmd = `import requests\n\nurl = "${finalUrl}"\n${headersPy}`;
      if (payload) {
        cmd += `payload = ${payload}\n`;
        cmd += `response = requests.${method.toLowerCase()}(url, json=payload${headersPy ? ', headers=headers' : ''})`;
      } else {
        cmd += `response = requests.${method.toLowerCase()}(url${headersPy ? ', headers=headers' : ''})`;
      }
      cmd += `\nprint(response.json())`;
      return cmd;
    }
    if (lang === "php") {
      let cmd = `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, array(\n    CURLOPT_URL => "${finalUrl}",\n    CURLOPT_RETURNTRANSFER => true,\n    CURLOPT_CUSTOMREQUEST => "${method}",${headersPhp}`;
      if (payload) {
        cmd += `\n    CURLOPT_POSTFIELDS => '${payload}',`;
      }
      cmd += `\n));\n\n$response = curl_exec($curl);\ncurl_close($curl);\n\necho $response;`;
      return cmd;
    }
    return "";
  };

  const ep = endpoints.find(e => e.id === activeTab)!;
  const colors = methodColors[ep.method];
  const activeSnippet = generateSnippet(codeLang, ep.method, ep.exampleUrl, ep.auth, ep.payload);

  return (
    <div className="bg-[#020609] text-gray-100 min-h-screen font-sans flex flex-col selection:bg-emerald-500/20">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.06] transition-all duration-300">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              TempMail VPS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="/" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Home</Link>
            <Link href="/doc" className="text-emerald-400 transition-colors cursor-pointer bg-transparent border-none">Developer APIs</Link>
            <Link href="/admin" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Consoles</Link>
            <Link href="/" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">System Status</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/admin/" className="text-xs sm:text-sm font-semibold text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] px-4 py-2 rounded-xl transition-all">Login</Link>
            <Link href="/admin/" className="text-xs sm:text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 px-4 py-2 rounded-xl transition-all cursor-pointer">Sign Up</Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 relative z-10">
        {/* ── Sidebar ── */}
        <aside className="w-full md:w-[270px] lg:w-[290px] shrink-0 border-r border-emerald-500/10 flex flex-col bg-emerald-500/[0.03] md:h-[calc(100vh-4rem)] md:sticky md:top-16 z-20">

          {/* Brand / Back */}
          <div className="px-5 py-5 border-b border-white/[0.05]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black font-mono bg-emerald-500 text-black px-1.5 py-0.5 rounded-md uppercase tracking-widest">API</span>
                <span className="text-sm font-bold text-white tracking-tight">Reference</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">TempMail VPS REST endpoints</p>
            </div>
          </div>

          {/* Endpoint List */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {isAdmin ? (
              // Grouped view for admin
              <>
                {["Receive Mail", "Send Mail", "Mailbox Client", "Admin"].map(cat => {
                  const catEndpoints = endpoints.filter(e => e.category === cat);
                  if (catEndpoints.length === 0) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.15em] px-2 py-2 border-l-2 border-emerald-500/50 ml-1">{cat}</p>
                      {catEndpoints.map((e) => {
                        const c = methodColors[e.method] || methodColors["GET"];
                        const isActive = activeTab === e.id;
                        return (
                          <button
                            key={e.id}
                            onClick={() => setActiveTab(e.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150 cursor-pointer group ${isActive
                              ? "bg-white/[0.05] border border-white/[0.08]"
                              : "border border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]"
                              }`}
                          >
                            <span className={`shrink-0 text-[9px] font-black font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${c.badge}`}>
                              {e.method}
                            </span>
                            <span className={`text-xs font-medium truncate transition-colors ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
                              {e.title}
                            </span>
                            {isActive && (
                              <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            ) : (
              // Flat list for non-admin - only show Receive Mail
              <>
                <p className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.15em] px-2 py-2">Receive Mail Endpoints</p>
                {endpoints.filter(e => e.category === "Receive Mail").map((e) => {
                  const c = methodColors[e.method];
                  const isActive = activeTab === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setActiveTab(e.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150 cursor-pointer group ${isActive
                        ? "bg-white/[0.05] border border-white/[0.08]"
                        : "border border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]"
                        }`}
                    >
                      <span className={`shrink-0 text-[9px] font-black font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${c.badge}`}>
                        {e.method}
                      </span>
                      <span className={`text-xs font-medium truncate transition-colors ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
                        {e.title}
                      </span>
                      {isActive && (
                        <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`}></span>
                      )}
                    </button>
                  );
                })}
                <div className="mt-4 mx-1 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <p className="text-[10px] text-emerald-400/80 font-mono leading-relaxed">
                    🔒 Admin, Mailbox Client & Send Mail APIs are hidden.<br/>
                    <a href="/admin" className="underline hover:text-emerald-300 transition-colors">Login as admin</a> to view all endpoints.
                  </p>
                </div>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono text-gray-500">API Server <span className="text-emerald-400 font-bold">{baseUrl.replace(/^https?:\/\//, '')}</span></span>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-grow overflow-y-auto min-h-screen bg-[#020609] relative">
          {/* Ambient Glow */}
          <div className="pointer-events-none fixed inset-0 z-0">
            <div className={`absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 ${colors.dot} opacity-[0.04]`}></div>
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 py-10 pb-24">

            {/* ── Endpoint Header ── */}
            <div className="mb-10 pb-8 border-b border-white/[0.05]">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-[11px] text-gray-600 font-mono mb-5">
                <span>API</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span className="text-gray-400">{ep.title}</span>
              </div>

              {/* Method + Path pill */}
              <div className={`inline-flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-4 py-2.5 mb-5 shadow-lg ${colors.glow}`}>
                <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg border uppercase tracking-widest ${colors.badge}`}>
                  {ep.method}
                </span>
                <code className="text-base font-mono font-bold text-gray-100 tracking-tight">{ep.path}</code>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                {ep.title}
              </h1>
              <p className="text-gray-400 text-base leading-relaxed max-w-2xl">{ep.desc}</p>

              {/* Meta tags */}
              <div className="flex flex-wrap gap-3 mt-5">
                <div className="inline-flex items-center gap-2 text-[11px] font-mono bg-white/[0.02] border border-white/[0.05] text-gray-400 px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Returns: <span className="text-gray-200 font-semibold">{ep.returns}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono bg-white/[0.02] border border-white/[0.05] text-gray-400 px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Auth: <span className={ep.auth ? "text-emerald-400 font-semibold" : "text-gray-400 font-semibold"}>{ep.auth ? "API Key Required" : "None Required"}</span>
                </div>
              </div>
            </div>

            {/* ── Code Panels ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

              {/* Left: cURL + Payload */}
              <div className="space-y-5">

                {/* Code Block */}
                <div className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl shadow-black/40">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#0a0d14] border-b border-white/[0.05]">
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1.5 hidden sm:flex">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                      </div>
                      <div className="flex space-x-1">
                        <button onClick={() => setCodeLang("curl")} className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${codeLang === "curl" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"}`}>cURL</button>
                        <button onClick={() => setCodeLang("js")} className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${codeLang === "js" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"}`}>JS (fetch)</button>
                        <button onClick={() => setCodeLang("python")} className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${codeLang === "python" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"}`}>Python</button>
                        <button onClick={() => setCodeLang("php")} className={`px-3 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all ${codeLang === "php" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"}`}>PHP</button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(activeSnippet, `code-${ep.id}-${codeLang}`)}
                      className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${copied === `code-${ep.id}-${codeLang}` ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.06]"}`}
                    >
                      {copied === `code-${ep.id}-${codeLang}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>
                  <div className="p-5 bg-[#070a10] overflow-x-auto">
                    <pre className="text-sm font-mono leading-relaxed text-gray-300">
                      {activeSnippet}
                    </pre>
                  </div>
                </div>

                {/* Payload Block */}
                <div className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl shadow-black/40">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0a0d14] border-b border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">JSON — Payload</span>
                    </div>
                    {ep.payload && (
                      <button
                        onClick={() => handleCopy(ep.payload!, `payload-${ep.id}`)}
                        className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${copied === `payload-${ep.id}` ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.06]"}`}
                      >
                        {copied === `payload-${ep.id}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                      </button>
                    )}
                  </div>
                  <div className="p-5 bg-[#070a10] overflow-x-auto">
                    {ep.payload ? (
                      <pre className="text-sm font-mono text-violet-300 leading-relaxed">{ep.payload}</pre>
                    ) : (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600 font-mono">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        <span>No request body required</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Response */}
              <div className="relative xl:sticky xl:top-10 group">
                {/* Decorative background glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500/20 via-transparent to-teal-500/10 rounded-[1.25rem] blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>

                <div className="relative bg-[#05080f]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
                  {/* Top accent line */}
                  <div className="h-[2px] w-full bg-gradient-to-r from-emerald-400/80 via-teal-400/80 to-transparent"></div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-white tracking-wide">Response</h3>
                      <div className="h-4 w-[1px] bg-white/[0.1]"></div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                        200 OK
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono hidden sm:inline-block">application/json</span>
                    </div>
                    <button
                      onClick={() => handleCopy(ep.response, `res-${ep.id}`)}
                      className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${copied === `res-${ep.id}` ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
                    >
                      {copied === `res-${ep.id}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre className="text-[13px] font-mono text-gray-300 leading-[1.7]">{ep.response}</pre>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Pagination ── */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/[0.05]">
              {(() => {
                const idx = endpoints.findIndex(e => e.id === activeTab);
                const prev = endpoints[idx - 1];
                const next = endpoints[idx + 1];
                return (
                  <>
                    <div>
                      {prev && (
                        <button onClick={() => setActiveTab(prev.id)} className="group flex items-center gap-3 text-left cursor-pointer bg-transparent border-none">
                          <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:border-white/[0.15] flex items-center justify-center transition-all">
                            <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">Previous</p>
                            <p className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">{prev.title}</p>
                          </div>
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      {next && (
                        <button onClick={() => setActiveTab(next.id)} className="group flex items-center gap-3 text-right cursor-pointer bg-transparent border-none">
                          <div>
                            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">Next</p>
                            <p className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">{next.title}</p>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:border-white/[0.15] flex items-center justify-center transition-all">
                            <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </div>
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
