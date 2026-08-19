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

// ─── Developer Endpoints Data ────────────────────────────────────────────────
const endpoints = [
  // ─── Dev Receive Mail (Temporary Mailbox) ───
  {
    id: "dev-get-domains",
    method: "GET",
    path: "/api/dev/domains",
    title: "Get Active Domains",
    category: "Dev Receive Mail",
    desc: "Fetch all active domains configured on the VPS node available for generating transient or permanent email addresses. Returns plan type and primary domain status.",
    payload: null,
    response: `{
  "domains": [
    {
      "domain": "micorna.biz",
      "plan": "pro",
      "is_primary": true
    },
    {
      "domain": "visakara.org",
      "plan": "free",
      "is_primary": false
    }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/domains",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "dev-generate",
    method: "GET",
    path: "/api/dev/mailbox/generate",
    title: "Generate Transient Mailbox",
    category: "Dev Receive Mail",
    desc: "Dynamically allocates a random disposable email address. Pass your developer API key via Bearer token. Optionally supply ?domain query param.",
    payload: null,
    response: `{
  "email": "dev_a1b2c3d4@micorna.biz"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/generate?domain=micorna.biz",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-custom-generate",
    method: "GET",
    path: "/api/dev/mailbox/custom",
    title: "Custom Address Mailbox",
    category: "Dev Receive Mail",
    desc: "Create a custom named mailbox address. Requires `name` query parameter and optional `domain`. Returns 409 Conflict if already taken.",
    payload: null,
    response: `{
  "email": "devuser@micorna.biz"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/custom?name=devuser&domain=micorna.biz",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-get-mailbox",
    method: "GET",
    path: "/api/dev/mailbox/:email",
    title: "Fetch Inbox Emails",
    category: "Dev Receive Mail",
    desc: "Retrieves all captured emails sent to the specified mailbox address, including parsed sender headers, subject, body text, HTML, and attachment metadata.",
    payload: null,
    response: `[
  {
    "id": "1786948939528",
    "from": "billing@stripe.com",
    "to": "devuser@micorna.biz",
    "subject": "Invoice #INV-2026-9842 paid",
    "text": "Your payment of $49.00 was successful.",
    "html": "<p>Your payment of <b>$49.00</b> was successful.</p>",
    "date": "2026-08-17T06:42:19.528Z",
    "attachments": [
      {
        "filename": "receipt.pdf",
        "size": 34210,
        "url": "/api/dev/attachments/1786948939528-receipt.pdf"
      }
    ]
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/devuser@micorna.biz",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "dev-extract-otp",
    method: "GET",
    path: "/api/dev/mailbox/:email/otps",
    title: "Extract OTP Codes",
    category: "Dev Receive Mail",
    desc: "Scans inbound emails in the specified mailbox and automatically parses 4-6 digit numeric OTP verification codes using regex pattern matching for automated CI/CD assertion testing.",
    payload: null,
    response: `[
  {
    "otp": "629401",
    "from": "no-reply@cloudflare.com",
    "subject": "Your Cloudflare Access OTP code is 629401",
    "date": "2026-08-17T03:47:19.536Z",
    "mailId": "1786938439536"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/devuser@micorna.biz/otps",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "dev-extract-simple",
    method: "GET",
    path: "/api/dev/mailbox/:email/simple",
    title: "Extract Simplified Email",
    category: "Dev Receive Mail",
    desc: "Extracts a lightweight plain text representation of inbound emails with stripped HTML formatting and raw metadata.",
    payload: null,
    response: `[
  {
    "id": "1786938439536",
    "from": "no-reply@cloudflare.com",
    "subject": "Your Cloudflare Access OTP code is 629401",
    "body": "Your Cloudflare Access verification code is: 629401. This code expires in 15 minutes.",
    "date": "2026-08-17T03:47:19.536Z"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/devuser@micorna.biz/simple",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "dev-get-attachment",
    method: "GET",
    path: "/api/dev/attachments/:filename",
    title: "Download Attachment Binary",
    category: "Dev Receive Mail",
    desc: "Streams the raw binary payload of a saved email attachment (PDF, image, ZIP, etc.).",
    payload: null,
    response: `[Binary File Stream]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/attachments/1786948939528-receipt.pdf",
    returns: "Binary Buffer",
    auth: false,
  },
  {
    id: "dev-delete-mailbox",
    method: "DELETE",
    path: "/api/dev/mailbox/:email",
    title: "Purge Entire Mailbox",
    category: "Dev Receive Mail",
    desc: "Purges all captured emails and storage files for the given email address. Useful for cleanup in automated test suites.",
    payload: null,
    response: `{
  "success": true,
  "deleted": 14
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/devuser@micorna.biz",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-delete-one-mail",
    method: "DELETE",
    path: "/api/dev/mailbox/:email/:mailId",
    title: "Delete Single Mail",
    category: "Dev Receive Mail",
    desc: "Deletes a specific individual email message from a mailbox by its record ID.",
    payload: null,
    response: `{
  "success": true,
  "mailId": "1786948939528"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/devuser@micorna.biz/1786948939528",
    returns: "JSON Object",
    auth: true,
  },

  // ─── Dev Master Mailbox (Primary Domain Webmail APIs) ───
  {
    id: "dev-mailbox-info",
    method: "GET",
    path: "/api/dev/mailbox/info",
    title: "Mailbox Server Info",
    category: "Dev Master Mailbox",
    desc: "Retrieve Primary Domain configuration, IMAP/POP3 hostnames, SSL/Plain port numbers (993/143), active status, and default mailbox credentials.",
    payload: null,
    response: `{
  "success": true,
  "primaryDomain": "micorna.biz",
  "catchAll": true,
  "imap": {
    "host": "mail.micorna.biz",
    "sslPort": 993,
    "plainPort": 143,
    "status": "active"
  },
  "defaultCredentials": {
    "email": "admin@micorna.biz",
    "password": "••••••••"
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/info",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "dev-mailbox-login",
    method: "POST",
    path: "/api/dev/mailbox/login",
    title: "Master Mailbox Login",
    category: "Dev Master Mailbox",
    desc: "Authenticate a mailbox user or primary domain administrator with email and password. Returns a Bearer token for subsequent master webmail requests.",
    payload: `{
  "email": "admin@micorna.biz",
  "password": "your_secure_password"
}`,
    response: `{
  "success": true,
  "token": "mailbox_8213c4180fce8c...:admin@micorna.biz",
  "user": {
    "id": 3,
    "email": "admin@micorna.biz",
    "project_id": null,
    "scope": "admin",
    "is_primary": true,
    "is_master": true
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/login",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "dev-mailbox-inbox",
    method: "GET",
    path: "/api/dev/mailbox/inbox",
    title: "Catch-All Mailbox Feed",
    category: "Dev Master Mailbox",
    desc: "Retrieve paginated catch-all inbox messages for the master primary domain. Supports `?page=1`, `?limit=200`, `?filter=all|simple|attachments`, and `?search=keyword`.",
    payload: null,
    response: `{
  "data": [
    {
      "id": 330,
      "recipient": "admin@micorna.biz",
      "sender": "MailServer Setup <welcome@micorna.biz>",
      "subject": "Welcome to your Dedicated Private Mail Server",
      "has_attachment": 0,
      "attachment_size": 0,
      "created_at": "2026-08-17T01:27:19.540Z"
    }
  ],
  "isPrimaryMailbox": true,
  "primaryDomain": "micorna.biz",
  "pagination": {
    "page": 1,
    "limit": 200,
    "totalRecords": 163,
    "totalPages": 1
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox?page=1&limit=200",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-mailbox-count",
    method: "GET",
    path: "/api/dev/mailbox/count",
    title: "Total Mailbox Count",
    category: "Dev Master Mailbox",
    desc: "Returns total number of messages captured in the master catch-all mailbox for badge counts and external sync.",
    payload: null,
    response: `{
  "email": "admin@micorna.biz",
  "count": 163
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/count",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-mailbox-read",
    method: "GET",
    path: "/api/dev/mailbox/inbox/:id",
    title: "Read Email (HTML Sandbox)",
    category: "Dev Master Mailbox",
    desc: "Fetch full parsed content, HTML preview sandbox, text body, and attachment metadata of a specific captured email by database ID.",
    payload: null,
    response: `{
  "id": 330,
  "from": "MailServer Setup <welcome@micorna.biz>",
  "to": "admin@micorna.biz",
  "subject": "Welcome to your Dedicated Private Mail Server",
  "text": "Your dedicated VPS mail node is operational.",
  "html": "<div style='font-family:sans-serif;'><h3>Server Ready</h3><p>Your mail node is operational.</p></div>",
  "date": "2026-08-17T01:27:19.540Z",
  "attachments": []
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox/330",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-mailbox-delete",
    method: "DELETE",
    path: "/api/dev/mailbox/inbox/:id",
    title: "Delete Email Permanently",
    category: "Dev Master Mailbox",
    desc: "Permanently delete a specific email from the database and disk storage.",
    payload: null,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox/330",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-mailbox-media",
    method: "GET",
    path: "/api/dev/mailbox/media",
    title: "Media & Attachments Gallery",
    category: "Dev Master Mailbox",
    desc: "List all media files (PDFs, images, documents) captured across inbound emails with download URLs.",
    payload: null,
    response: `{
  "media": [
    {
      "emailId": 321,
      "sender": "billing@stripe.com",
      "date": "2026-08-17T06:42:19.528Z",
      "filename": "invoice.pdf",
      "contentType": "application/pdf",
      "size": 34210,
      "url": "/api/dev/attachments/1786948939528-invoice.pdf"
    }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/media",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-mailbox-send",
    method: "POST",
    path: "/api/dev/mailbox/send",
    title: "Send Outbound Email (Mailbox)",
    category: "Dev Master Mailbox",
    desc: "Send an outbound email from the authenticated mailbox address via the VPS SMTP node.",
    payload: `{
  "to": "client@example.com",
  "subject": "Hello from Developer Node",
  "message": "Testing automated email dispatch."
}`,
    response: `{
  "success": true,
  "messageId": "<dev-94182@micorna.biz>"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/send",
    returns: "JSON Object",
    auth: true,
  },

  // ─── Dev Live & Local SMTP Console ───
  {
    id: "dev-emails-local",
    method: "GET",
    path: "/api/dev/emails/local",
    title: "Local SMTP Inbox & Logs",
    category: "Dev Live & Local SMTP",
    desc: "Fetch all locally captured internal emails received on SMTP Port 2525 along with local debug logs.",
    payload: null,
    response: `{
  "emails": [],
  "logs": []
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/emails/local",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-emails-live",
    method: "GET",
    path: "/api/dev/emails/live",
    title: "Live SMTP Inbound Stream",
    category: "Dev Live & Local SMTP",
    desc: "Fetch live incoming emails received on public SMTP Port 25 and network traffic logs.",
    payload: null,
    response: `{
  "emails": [],
  "logs": []
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/emails/live",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-send-local",
    method: "POST",
    path: "/api/dev/send-email/local",
    title: "Dispatch Local SMTP Email",
    category: "Dev Live & Local SMTP",
    desc: "Dispatch an email locally to port 2525 for internal routing tests.",
    payload: `{
  "from": "test@micorna.biz",
  "to": "receiver@micorna.biz",
  "subject": "Local Test Message",
  "text": "Hello Local SMTP",
  "html": "<p>Hello Local SMTP</p>"
}`,
    response: `{
  "success": true,
  "messageId": "<local-test-123>"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/send-email/local",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-send-live",
    method: "POST",
    path: "/api/dev/send-email/live",
    title: "Dispatch Live Outbound Email",
    category: "Dev Live & Local SMTP",
    desc: "Dispatches an outbound email to any public internet address using the VPS SMTP node with optional DKIM signing.",
    payload: `{
  "from": "notifications@micorna.biz",
  "to": "user@gmail.com",
  "subject": "Production Notice",
  "text": "Your account is ready.",
  "html": "<p>Your account is ready.</p>"
}`,
    response: `{
  "success": true,
  "messageId": "<live-outbound-456>"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/send-email/live",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "dev-mails-feed",
    method: "GET",
    path: "/api/dev/mails",
    title: "Combined All Mails Feed",
    category: "Dev Live & Local SMTP",
    desc: "Returns a unified, date-sorted JSON feed of all emails captured across both Live and Local listeners with `?limit` and `?email` filter parameters.",
    payload: null,
    response: `[
  {
    "id": "1786948939528",
    "from": "billing@stripe.com",
    "to": "admin@micorna.biz",
    "subject": "Invoice #INV-2026-9842 paid",
    "date": "2026-08-17T06:42:19.528Z"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/mails?limit=50",
    returns: "JSON Array",
    auth: true,
  },
  // ─── Dev SMTP Server & REST Outbound Email APIs ───
  {
    id: "dev-smtp-get-credentials",
    method: "GET",
    path: "/api/dev/smtp",
    title: "List SMTP Email Addresses (Dev)",
    category: "Dev Live & Local SMTP",
    desc: "Retrieves the full list of configured SMTP sender addresses, assigned active domains, usernames, passwords, and status flags.",
    payload: null,
    response: `[
  {
    "email": "orders@micorna.biz",
    "username": "orders@micorna.biz",
    "domain": "micorna.biz",
    "description": "Store Order Confirmations",
    "enabled": true,
    "created_at": "2026-08-19T10:00:00.000Z"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "dev-smtp-create-credential",
    method: "POST",
    path: "/api/dev/smtp",
    title: "Create SMTP Address by Active Domain (Dev)",
    category: "Dev Live & Local SMTP",
    desc: "Programmatically generate an isolated SMTP address for any domain from your active domains list (/api/dev/domains) with custom or auto-generated password.",
    payload: `{
  "email": "support@micorna.biz",
  "password": "strong_secret_password_or_leave_blank_for_auto_generate",
  "domain": "micorna.biz",
  "description": "Customer Support Desk"
}`,
    response: `{
  "success": true,
  "message": "SMTP credential saved successfully",
  "credential": {
    "id": "smtp_1720000000000_a1b2",
    "email": "support@micorna.biz",
    "username": "support@micorna.biz",
    "password": "...",
    "domain": "micorna.biz",
    "description": "Customer Support Desk"
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-smtp-send-email-api",
    method: "POST",
    path: "/api/dev/smtp/send",
    title: "Send Single / Test Email (Text + HTML + Attachments)",
    category: "Dev Live & Local SMTP",
    desc: "Dispatches a single or test outbound email via HTTP POST with automatic DKIM signing, HTML markup, and file attachment support.",
    payload: `{
  "from": "support@micorna.biz",
  "to": "client@gmail.com",
  "subject": "Order Confirmation #9401",
  "text": "Your order has been confirmed and is now being prepared.",
  "html": "<div style='font-family:sans-serif;'><h2>Order Confirmed!</h2><p>Your order has been dispatched.</p></div>",
  "attachments": [
    {
      "filename": "receipt_9401.pdf",
      "content": "JVBERi0xLjQKJcTl8uXr...",
      "contentType": "application/pdf"
    }
  ]
}`,
    response: `{
  "success": true,
  "message": "Email dispatched successfully from support@micorna.biz to client@gmail.com",
  "result": {
    "accepted": ["client@gmail.com"],
    "response": "250 2.0.0 OK",
    "messageId": "<9401-vps-mail@micorna.biz>"
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/send",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-smtp-send-bulk-email-api",
    method: "POST",
    path: "/api/dev/smtp/send-bulk",
    title: "Bulk Outbound Email Dispatch (Min 5s Delay Throttling)",
    category: "Dev Live & Local SMTP",
    desc: "Dispatches emails to multiple recipients sequentially with a strict minimum 5-second throttling delay between messages to safeguard IP reputation and prevent spam filters.",
    payload: `{
  "from": "newsletter@micorna.biz",
  "recipients": [
    "customer1@gmail.com",
    "customer2@yahoo.com",
    "client3@outlook.com"
  ],
  "subject": "Weekly Newsletter & Updates",
  "text": "Check out our latest releases this week!",
  "html": "<h2>Weekly Updates</h2><p>Check out our latest releases!</p>",
  "delaySeconds": 5
}`,
    response: `{
  "success": true,
  "message": "Bulk dispatch completed. 3/3 emails dispatched successfully.",
  "total": 3,
  "sent": 3,
  "failed": 0,
  "delaySeconds": 5,
  "results": [
    { "recipient": "customer1@gmail.com", "status": "sent", "messageId": "<...>" },
    { "recipient": "customer2@yahoo.com", "status": "sent", "messageId": "<...>" },
    { "recipient": "client3@outlook.com", "status": "sent", "messageId": "<...>" }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/send-bulk",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-smtp-delete-credential",
    method: "DELETE",
    path: "/api/dev/smtp/:identifier",
    title: "Delete SMTP Address (Dev)",
    category: "Dev Live & Local SMTP",
    desc: "Permanently delete an SMTP address from the server by Account ID or Email.",
    payload: null,
    response: `{
  "success": true
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/support@micorna.biz",
    returns: "JSON Object",
    auth: true,
  },

  // ─── DevPanel Management & Infrastructure ───
  {
    id: "devpanel-login",
    method: "POST",
    path: "/api/devpanel/login",
    title: "Developer Panel Login",
    category: "DevPanel Management",
    desc: "Authenticate Developer Panel credentials to obtain a high-privilege Bearer token for server configuration.",
    payload: `{
  "username": "devpanel",
  "password": "your_dev_password"
}`,
    response: `{
  "success": true,
  "token": "ZGV2cGFuZWw6ZGV2cGFzcw=="
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/login",
    returns: "JSON Object",
    auth: false,
  },
  {
    id: "devpanel-stats",
    method: "GET",
    path: "/api/devpanel/stats",
    title: "Node Health & Mail Stats",
    category: "DevPanel Management",
    desc: "Get real-time server metrics, disk usage breakdown, live/local email counts, and active mailbox totals.",
    payload: null,
    response: `{
  "totalEmails": 163,
  "localEmailsCount": 51,
  "liveEmailsCount": 112,
  "diskUsageBytes": 145688,
  "activeMailboxesCount": 15,
  "liveModeActive": false
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/stats",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-stats-traffic",
    method: "GET",
    path: "/api/devpanel/stats/traffic",
    title: "7-Day Traffic Analytics",
    category: "DevPanel Management",
    desc: "Returns daily API call volume, error counts, and bandwidth metrics over the last 7 days.",
    payload: null,
    response: `{
  "analytics": [
    { "date": "2026-08-11", "hits": 450, "errors": 2 },
    { "date": "2026-08-12", "hits": 612, "errors": 0 },
    { "date": "2026-08-17", "hits": 1420, "errors": 1 }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/stats/traffic",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-projects-list",
    method: "GET",
    path: "/api/devpanel/projects",
    title: "List API Projects",
    category: "DevPanel Management",
    desc: "Fetch all active API projects with their scoped API keys, rate limits, webhooks, and retention settings.",
    payload: null,
    response: `[
  {
    "id": 1,
    "name": "Production App",
    "api_key": "vps_live_8f7b...9a1",
    "webhook_url": "https://myapp.com/webhook",
    "is_active": 1,
    "created_at": "2026-07-01 10:00:00"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "devpanel-projects-create",
    method: "POST",
    path: "/api/devpanel/projects",
    title: "Create API Project",
    category: "DevPanel Management",
    desc: "Create a new scoped developer project and auto-generate its dedicated API key.",
    payload: `{
  "name": "Staging Backend",
  "webhook_url": "https://staging.myapp.com/webhook"
}`,
    response: `{
  "success": true,
  "project": {
    "id": 2,
    "name": "Staging Backend",
    "api_key": "vps_live_4a2c...881",
    "webhook_url": "https://staging.myapp.com/webhook",
    "is_active": 1
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-domains-list",
    method: "GET",
    path: "/api/devpanel/domains",
    title: "Manage Custom Domains",
    category: "DevPanel Management",
    desc: "List all attached domains, routing mode (direct / catch_all), DNS verification status, and primary flag.",
    payload: null,
    response: `[
  {
    "id": 1,
    "domain": "micorna.biz",
    "is_primary": 1,
    "routing_mode": "catch_all",
    "dns_status": "verified"
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "devpanel-domains-primary",
    method: "POST",
    path: "/api/devpanel/domains/:id/primary",
    title: "Set Primary Catch-All Domain",
    category: "DevPanel Management",
    desc: "Promote an attached domain to become the primary domain linked to the master webmail inbox.",
    payload: null,
    response: `{
  "success": true,
  "primaryDomain": "micorna.biz"
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains/1/primary",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-api-settings",
    method: "GET",
    path: "/api/devpanel/api-settings",
    title: "Get Dynamic API Controls",
    category: "DevPanel Management",
    desc: "Retrieve real-time enabled/disabled status and lifetime request hits for all API routes across the server.",
    payload: null,
    response: `[
  {
    "id": "mailbox-client-inbox",
    "method": "GET",
    "path": "/api/mailbox/inbox",
    "desc": "Retrieve paginated inbox messages",
    "enabled": true,
    "category": "Mailbox Client",
    "hits": 42
  }
]`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/api-settings",
    returns: "JSON Array",
    auth: true,
  },
  {
    id: "devpanel-api-toggle",
    method: "POST",
    path: "/api/devpanel/api-settings/toggle",
    title: "Toggle API Route On/Off",
    category: "DevPanel Management",
    desc: "Dynamically enable or disable specific API routes in real-time without restarting the VPS daemon.",
    payload: `{
  "id": "mailbox-client-send",
  "enabled": true
}`,
    response: `{
  "success": true,
  "api": {
    "id": "mailbox-client-send",
    "enabled": true
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/api-settings/toggle",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-smtp-flags",
    method: "GET",
    path: "/api/devpanel/smtp-flags",
    title: "Fetch SMTP Runtime Flags",
    category: "DevPanel Management",
    desc: "Get live SMTP engine runtime flags (DKIM verification, spam protection, catch-all routing, IP whitelisting).",
    payload: null,
    response: `{
  "success": true,
  "flags": {
    "enable_dkim_signing": "1",
    "enable_catch_all": "1",
    "rate_limit_per_min": "100"
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/smtp-flags",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-dblogs",
    method: "GET",
    path: "/api/devpanel/dblogs/all",
    title: "Server Activity & Error Logs",
    category: "DevPanel Management",
    desc: "Fetch real-time server activity, SMTP connections, and error logs stored in the SQLite database.",
    payload: null,
    response: `{
  "success": true,
  "logs": [
    {
      "id": 1,
      "level": "info",
      "message": "SMTP Connection established from 127.0.0.1",
      "created_at": "2026-08-17 12:00:00"
    }
  ]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/dblogs/all",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "devpanel-serverinfo",
    method: "GET",
    path: "/api/devpanel/serverinfo",
    title: "Server Info & DKIM Key",
    category: "DevPanel Management",
    desc: "Retrieve server DNS hostname, DKIM TXT record selector, and public RSA key for DNS authentication.",
    payload: null,
    response: `{
  "selector": "mail",
  "domain": "micorna.biz",
  "dnsRecord": "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAO..."
}`,
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/serverinfo",
    returns: "JSON Object",
    auth: true,
  },

  // ─── Dev Project & Security ───
  {
    id: "dev-project-verify",
    method: "GET",
    path: "/api/dev/project/verify",
    title: "Verify API Key & Quota",
    category: "Dev Project & Security",
    desc: "Validate a developer API key and return associated project metadata, status, and remaining quota.",
    payload: null,
    response: `{
  "valid": true,
  "project": {
    "id": 1,
    "name": "Production App",
    "is_active": 1
  }
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/verify",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-project-retention",
    method: "GET",
    path: "/api/dev/project/retention",
    title: "Data Retention Limits",
    category: "Dev Project & Security",
    desc: "Fetch background auto-cleanup limits (data retention hours) configured for captured emails and attachments.",
    payload: null,
    response: `{
  "email_retention_hours": 72,
  "attachment_retention_hours": 168
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/retention",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-project-allowed-files",
    method: "GET",
    path: "/api/dev/project/allowed-files",
    title: "Permitted Attachment Types",
    category: "Dev Project & Security",
    desc: "Fetch the list of allowed file extension MIME types permitted for email attachment uploads.",
    payload: null,
    response: `{
  "allowed_extensions": ["pdf", "png", "jpg", "jpeg", "txt", "zip", "csv", "json"]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/allowed-files",
    returns: "JSON Object",
    auth: true,
  },
  {
    id: "dev-project-forbidden-ids",
    method: "GET",
    path: "/api/dev/project/forbidden-ids",
    title: "Blocked Address Prefixes",
    category: "Dev Project & Security",
    desc: "Retrieve forbidden username/prefix blacklist rules (e.g. root, abuse, postmaster) to prevent unauthorized mailbox creation.",
    payload: null,
    response: `{
  "forbidden_prefixes": ["root", "abuse", "postmaster", "hostmaster", "security"]
}`,
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/forbidden-ids",
    returns: "JSON Object",
    auth: true,
  }
];

const methodColors: Record<string, { badge: string; glow: string; dot: string }> = {
  GET: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", glow: "shadow-emerald-500/10", dot: "bg-emerald-500" },
  POST: { badge: "bg-violet-500/10 text-violet-400 border-violet-500/25", glow: "shadow-violet-500/10", dot: "bg-violet-500" },
  PUT: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/25", glow: "shadow-amber-500/10", dot: "bg-amber-500" },
  DELETE: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/25", glow: "shadow-rose-500/10", dot: "bg-rose-500" },
};

export default function DevApiDocumentation() {
  const [activeTab, setActiveTab] = useState(endpoints[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://localhost:8081");
  const [codeLang, setCodeLang] = useState<"curl" | "js" | "python" | "php">("curl");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateSnippet = (lang: string, method: string, url: string, auth: boolean, payload: string | null) => {
    const finalUrl = url.replace("http://your-vps-ip:8081", baseUrl);
    const headers = auth ? ` \\\n  -H "Authorization: Bearer YOUR_DEV_TOKEN"` : "";
    const headersJs = auth ? `,\n    headers: {\n      "Authorization": "Bearer YOUR_DEV_TOKEN"${payload ? ',\n      "Content-Type": "application/json"' : ''}\n    }` : (payload ? `,\n    headers: {\n      "Content-Type": "application/json"\n    }` : "");
    const headersPy = auth ? `headers = {\n    "Authorization": "Bearer YOUR_DEV_TOKEN"${payload ? ',\n    "Content-Type": "application/json"' : ''}\n}\n` : (payload ? `headers = {\n    "Content-Type": "application/json"\n}\n` : "");
    const headersPhp = auth ? `\n    CURLOPT_HTTPHEADER => array(\n        "Authorization: Bearer YOUR_DEV_TOKEN"${payload ? ',\n        "Content-Type": "application/json"' : ''}\n    ),` : (payload ? `\n    CURLOPT_HTTPHEADER => array(\n        "Content-Type": "application/json"\n    ),` : "");

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

  const categories = ["All", "Dev Receive Mail", "Dev Master Mailbox", "Dev Live & Local SMTP", "Dev Panel Management", "Dev Project & Security"];

  const filteredEndpoints = endpoints.filter(e => {
    const matchesCat = selectedCategory === "All" || e.category === selectedCategory;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const ep = endpoints.find(e => e.id === activeTab) || filteredEndpoints[0] || endpoints[0];
  const colors = methodColors[ep.method] || methodColors["GET"];
  const activeSnippet = generateSnippet(codeLang, ep.method, ep.exampleUrl, ep.auth, ep.payload);

  return (
    <div className="bg-[#030712] text-gray-100 min-h-screen font-sans flex flex-col selection:bg-amber-500/20">

      {/* ── Top Developer Header ── */}
      <header className="sticky top-0 z-50 w-full bg-[#050b14]/90 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 cursor-pointer">
              <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white font-sans">
                  Developer API Hub
                </span>
                <span className="text-[10px] font-mono font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  /api/dev/*
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
            <Link href="/" className="hover:text-white transition-colors cursor-pointer">Home</Link>
            <Link href="/doc" className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1">
              <span>Client API Docs</span>
            </Link>
            <Link href="/devpanel" className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1 font-semibold">
              <span>DevPanel Console</span>
            </Link>
            <Link href="/mailbox" className="hover:text-white transition-colors cursor-pointer">Webmail</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/doc" className="text-xs font-semibold text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3.5 py-2 rounded-xl transition-all">
              ← Client Docs
            </Link>
            <Link href="/devpanel" className="text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 shadow-lg shadow-amber-500/20 px-4 py-2 rounded-xl transition-all cursor-pointer">
              DevPanel
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 relative z-10">
        
        {/* ── Sidebar ── */}
        <aside className="w-full md:w-[300px] lg:w-[320px] shrink-0 border-r border-white/[0.08] flex flex-col bg-[#050a14] md:h-[calc(100vh-4rem)] md:sticky md:top-16 z-20">

          {/* Search & Filter */}
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search /api/dev endpoints..."
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
              />
              <svg className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>

            {/* Category Pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] font-mono px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                      : "text-gray-400 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04]"
                  }`}
                >
                  {cat === "All" ? "All" : cat.replace("Dev ", "")}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoints Nav */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {categories.filter(c => c !== "All").map(cat => {
              const catEndpoints = filteredEndpoints.filter(e => e.category === cat);
              if (catEndpoints.length === 0) return null;

              return (
                <div key={cat} className="mb-4">
                  <p className="text-[10px] font-mono font-bold text-amber-400/70 uppercase tracking-widest px-2 py-1.5 border-l-2 border-amber-500/40 mb-1">
                    {cat}
                  </p>
                  {catEndpoints.map((e) => {
                    const c = methodColors[e.method] || methodColors["GET"];
                    const isActive = activeTab === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setActiveTab(e.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-150 cursor-pointer group ${
                          isActive
                            ? "bg-white/[0.08] border border-white/[0.12] shadow-md shadow-black/40"
                            : "border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]"
                        }`}
                      >
                        <span className={`shrink-0 text-[9px] font-black font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${c.badge}`}>
                          {e.method}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs block font-medium truncate transition-colors ${isActive ? "text-white font-semibold" : "text-gray-400 group-hover:text-gray-200"}`}>
                            {e.title}
                          </span>
                          <span className="text-[10px] font-mono text-gray-600 block truncate">
                            {e.path}
                          </span>
                        </div>
                        {isActive && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot} shadow-[0_0_8px_rgba(245,158,11,0.8)]`}></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3.5 border-t border-white/[0.06] bg-black/30">
            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Dev Node Live</span>
              </span>
              <span className="text-amber-400 font-bold">{endpoints.length} Endpoints</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-grow overflow-y-auto min-h-screen bg-[#030712] relative">
          {/* Ambient Glow */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className={`absolute top-[-5%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[140px] opacity-20 ${colors.dot}`}></div>
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 py-10 pb-24">

            {/* ── Endpoint Header ── */}
            <div className="mb-10 pb-8 border-b border-white/[0.08]">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono mb-4">
                <span>Developer APIs</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span className="text-amber-400">{ep.category}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                <span className="text-gray-300">{ep.title}</span>
              </div>

              {/* Method + Path Pill */}
              <div className={`inline-flex items-center gap-3 bg-white/[0.02] border border-white/[0.08] rounded-2xl px-4 py-2.5 mb-5 shadow-xl ${colors.glow}`}>
                <span className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg border uppercase tracking-widest ${colors.badge}`}>
                  {ep.method}
                </span>
                <code className="text-base font-mono font-bold text-amber-200 tracking-tight">{ep.path}</code>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                {ep.title}
              </h1>
              <p className="text-gray-400 text-base leading-relaxed max-w-3xl">{ep.desc}</p>

              {/* Meta tags */}
              <div className="flex flex-wrap gap-3 mt-6">
                <div className="inline-flex items-center gap-2 text-[11px] font-mono bg-white/[0.02] border border-white/[0.06] text-gray-400 px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Returns: <span className="text-gray-200 font-semibold">{ep.returns}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono bg-white/[0.02] border border-white/[0.06] text-gray-400 px-3 py-1.5 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Auth: <span className={ep.auth ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>{ep.auth ? "Bearer Dev Token Required" : "Public (No Auth)"}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-[11px] font-mono bg-white/[0.02] border border-white/[0.06] text-gray-400 px-3 py-1.5 rounded-lg">
                  <span>Scope: <strong className="text-white font-mono">{ep.category.includes("Panel") || ep.category.includes("Admin") ? "devpanel" : "developer"}</strong></span>
                </div>
              </div>
            </div>

            {/* ── Code & Response Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

              {/* Left Column: Code Snippet & Request Body */}
              <div className="space-y-6">

                {/* Code Snippet Box */}
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl bg-[#080d18]">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#050a14] border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 hidden sm:flex">
                        <span className="w-3 h-3 rounded-full bg-[#ff5f56]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                        <span className="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                      </div>
                      <div className="flex space-x-1">
                        <button onClick={() => setCodeLang("curl")} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${codeLang === "curl" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}>cURL</button>
                        <button onClick={() => setCodeLang("js")} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${codeLang === "js" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}>JS (fetch)</button>
                        <button onClick={() => setCodeLang("python")} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${codeLang === "python" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}>Python</button>
                        <button onClick={() => setCodeLang("php")} className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all cursor-pointer ${codeLang === "php" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-white"}`}>PHP</button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(activeSnippet, `code-${ep.id}-${codeLang}`)}
                      className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${copied === `code-${ep.id}-${codeLang}` ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
                    >
                      {copied === `code-${ep.id}-${codeLang}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>
                  <div className="p-5 overflow-x-auto">
                    <pre className="text-xs font-mono leading-relaxed text-gray-300">
                      {activeSnippet}
                    </pre>
                  </div>
                </div>

                {/* Request Payload Box */}
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl bg-[#080d18]">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#050a14] border-b border-white/[0.06]">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Request Body (JSON)
                    </span>
                    {ep.payload && (
                      <button
                        onClick={() => handleCopy(ep.payload!, `payload-${ep.id}`)}
                        className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${copied === `payload-${ep.id}` ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
                      >
                        {copied === `payload-${ep.id}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                      </button>
                    )}
                  </div>
                  <div className="p-5 overflow-x-auto">
                    {ep.payload ? (
                      <pre className="text-xs font-mono text-amber-200 leading-relaxed">{ep.payload}</pre>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        <span>No request body required for this request</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Response Box */}
              <div className="relative xl:sticky xl:top-24">
                <div className="relative bg-[#060b16]/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl">
                  {/* Top Accent Line */}
                  <div className="h-[2px] w-full bg-gradient-to-r from-amber-400 via-emerald-400 to-transparent"></div>

                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-white tracking-wide">Response Payload</h3>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                        200 OK
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(ep.response, `res-${ep.id}`)}
                      className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${copied === `res-${ep.id}` ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08]"}`}
                    >
                      {copied === `res-${ep.id}` ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                    </button>
                  </div>

                  <div className="p-5 overflow-x-auto max-h-[550px] overflow-y-auto">
                    <pre className="text-xs font-mono text-gray-300 leading-relaxed">{ep.response}</pre>
                  </div>
                </div>
              </div>

            </div>

            {/* ── Prev / Next Navigation ── */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/[0.08]">
              {(() => {
                const idx = endpoints.findIndex(e => e.id === activeTab);
                const prev = endpoints[idx - 1];
                const next = endpoints[idx + 1];
                return (
                  <>
                    <div>
                      {prev && (
                        <button onClick={() => setActiveTab(prev.id)} className="group flex items-center gap-3 text-left cursor-pointer bg-transparent border-none">
                          <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.08] group-hover:border-amber-400/40 flex items-center justify-center transition-all">
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-amber-300 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Previous</p>
                            <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{prev.title}</p>
                          </div>
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      {next && (
                        <button onClick={() => setActiveTab(next.id)} className="group flex items-center gap-3 text-right cursor-pointer bg-transparent border-none">
                          <div>
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Next</p>
                            <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{next.title}</p>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.08] group-hover:border-amber-400/40 flex items-center justify-center transition-all">
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-amber-300 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
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
