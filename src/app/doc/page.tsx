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

interface Endpoint {
  id: string;
  method: string;
  path: string;
  title: string;
  category: string;
  desc: string;
  payload: string | null;
  response: string;
  exampleUrl: string;
  returns: string;
  auth: boolean;
  disabled?: boolean;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const endpoints: Endpoint[] = [
  {
    id: "api-domains",
    method: "GET",
    path: "/api/domains",
    title: "Active Domains List",
    category: "Receive Mail",
    desc: "Fetch all active domains available for generating temporary emails.",
    payload: null,
    response: "{\n  \"domains\": [\n    \"llamerada.online\",\n    \"tempemail.vps\"\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/domains",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "mailbox-generate",
    method: "GET",
    path: "/api/mailbox/generate",
    title: "Generate Random Mailbox",
    category: "Receive Mail",
    desc: "Generate a new random temporary email address. Optionally pass ?domain= to choose a specific domain.",
    payload: null,
    response: "{\n  \"email\": \"a1b2c3d4@tempemail.vps\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/generate",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-custom",
    method: "GET",
    path: "/api/mailbox/custom",
    title: "Create Custom Mailbox",
    category: "Receive Mail",
    desc: "Create a custom temporary email address with your chosen name using ?name= and optional ?domain=.",
    payload: null,
    response: "{\n  \"email\": \"myname@tempemail.vps\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/custom",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-get",
    method: "GET",
    path: "/api/mailbox/:email",
    title: "Get Received Emails",
    category: "Receive Mail",
    desc: "List of inboxes by email (get all received emails and messages for a specific email address).",
    payload: null,
    response: "[\n  {\n    \"id\": \"1234567890\",\n    \"from\": \"noreply@github.com\",\n    \"to\": \"test@tempemail.vps\",\n    \"subject\": \"Verify your email\",\n    \"text\": \"Your code is 123456\",\n    \"html\": \"<p>Your code is <b>123456</b></p>\",\n    \"date\": \"2026-07-07T10:17:02.000Z\",\n    \"attachments\": []\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/:email",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "get-attachment",
    method: "GET",
    path: "/api/attachments/:filename",
    title: "Download Attachment",
    category: "Receive Mail",
    desc: "Download an attached file (image, PDF, document) from a received email using its filename.",
    payload: null,
    response: "<Binary file stream / image bytes>",
    exampleUrl: "http://your-vps-ip:8081/api/attachments/:filename",
    returns: "Binary payload stream",
    auth: false
  },
  {
    id: "mailbox-delete",
    method: "DELETE",
    path: "/api/mailbox/:email",
    title: "Delete Entire Mailbox",
    category: "Receive Mail",
    desc: "Delete all received emails and messages for a specific email address.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/:email",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-delete-one",
    method: "DELETE",
    path: "/api/mailbox/:email/:mailId",
    title: "Delete Single Email",
    category: "Receive Mail",
    desc: "Delete a single specific email by its ID from a mailbox.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"mailId\": \"1234567890\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/:email/:mailId",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-client-inbox",
    method: "GET",
    path: "/api/mailbox/inbox",
    title: "Get User Inbox",
    category: "Mailbox Client",
    desc: "Get the list of received emails for the logged-in mailbox inbox.",
    payload: null,
    response: "{\n  \"messages\": [\n    {\n      \"id\": 1,\n      \"from\": \"billing@stripe.com\",\n      \"subject\": \"Your Invoice\",\n      \"date\": \"2026-07-15T09:00:00Z\",\n      \"hasAttachments\": true\n    }\n  ],\n  \"total\": 1,\n  \"page\": 1,\n  \"limit\": 200\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-client-count",
    method: "GET",
    path: "/api/mailbox/count",
    title: "Get Unread Email Count",
    category: "Mailbox Client",
    desc: "Get the total number of emails in the user inbox (useful for badges).",
    payload: null,
    response: "{\n  \"success\": true,\n  \"count\": 12\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/count",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-client-read",
    method: "GET",
    path: "/api/mailbox/inbox/:id",
    title: "Read Single Email",
    category: "Mailbox Client",
    desc: "Get full details, text, HTML, and attachments of a specific email by its ID.",
    payload: null,
    response: "{\n  \"id\": 1,\n  \"from\": \"billing@stripe.com\",\n  \"to\": \"support@yourdomain.com\",\n  \"subject\": \"Your Invoice\",\n  \"text\": \"Payment received\",\n  \"html\": \"<p>Payment received</p>\",\n  \"date\": \"2026-07-15T09:00:00Z\",\n  \"attachments\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-client-media",
    method: "GET",
    path: "/api/mailbox/media",
    title: "List Email Attachments",
    category: "Mailbox Client",
    desc: "Get all file attachments received in the user mailbox with download links.",
    payload: null,
    response: "{\n  \"media\": [\n    {\n      \"emailId\": 1,\n      \"filename\": \"invoice.pdf\",\n      \"size\": 14205,\n      \"url\": \"/api/attachments/invoice.pdf\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/media",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "mailbox-client-login",
    method: "POST",
    path: "/api/mailbox/login",
    title: "Mailbox User Login",
    category: "Mailbox Client",
    desc: "Login as a mailbox user using email and password to get an access token.",
    payload: "{\n  \"email\": \"support@yourdomain.com\",\n  \"password\": \"your_password\"\n}",
    response: "{\n  \"success\": true,\n  \"token\": \"session_token_here\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/login",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "mailbox-client-delete",
    method: "DELETE",
    path: "/api/mailbox/inbox/:id",
    title: "Delete Single Email",
    category: "Mailbox Client",
    desc: "Delete a specific email from the logged-in user inbox.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/inbox/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-list",
    method: "GET",
    path: "/api/admin/smtp",
    title: "List SMTP Accounts",
    category: "Send Mail",
    desc: "Get all configured SMTP sender email addresses.",
    payload: null,
    response: "{\n  \"users\": [\n    {\n      \"id\": \"acc_1\",\n      \"email\": \"support@tempemail.vps\",\n      \"domain\": \"tempemail.vps\",\n      \"description\": \"Primary Support Outbound\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-create",
    method: "POST",
    path: "/api/admin/smtp",
    title: "Create SMTP Account",
    category: "Send Mail",
    desc: "Create a new SMTP sender email address for sending emails.",
    payload: "{\n  \"email\": \"support@tempemail.vps\",\n  \"password\": \"secure_password\",\n  \"domain\": \"tempemail.vps\",\n  \"description\": \"Customer Support\"\n}",
    response: "{\n  \"success\": true,\n  \"id\": \"acc_1\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-send",
    method: "POST",
    path: "/api/admin/smtp/send",
    title: "Send Single Email",
    category: "Send Mail",
    desc: "Send a single email (with text, HTML, and attachments) via SMTP.",
    payload: "{\n  \"from\": \"support@tempemail.vps\",\n  \"to\": \"customer@example.com\",\n  \"subject\": \"Welcome\",\n  \"text\": \"Hello World\",\n  \"html\": \"<p>Hello World</p>\"\n}",
    response: "{\n  \"success\": true,\n  \"messageId\": \"<msg-12345@tempemail.vps>\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp/send",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-send-bulk",
    method: "POST",
    path: "/api/admin/smtp/send-bulk",
    title: "Send Bulk Emails",
    category: "Send Mail",
    desc: "Send emails to multiple recipients one by one with a safe delay between each email.",
    payload: "{\n  \"from\": \"news@tempemail.vps\",\n  \"recipients\": [\n    \"user1@example.com\",\n    \"user2@example.com\"\n  ],\n  \"subject\": \"Newsletter\",\n  \"text\": \"Weekly updates\",\n  \"delaySeconds\": 5\n}",
    response: "{\n  \"success\": true,\n  \"totalQueued\": 2,\n  \"estimatedTimeSeconds\": 10\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp/send-bulk",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-test",
    method: "POST",
    path: "/api/admin/smtp/test",
    title: "Test SMTP Relay",
    category: "Send Mail",
    desc: "Send a test email to verify SMTP relay configuration.",
    payload: "{\n  \"toEmail\": \"test@example.com\",\n  \"fromEmail\": \"support@tempemail.vps\",\n  \"subject\": \"Relay Test\",\n  \"text\": \"Testing SMTP Relay\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp/test",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "smtp-delete",
    method: "DELETE",
    path: "/api/admin/smtp/:identifier",
    title: "Delete SMTP Account",
    category: "Send Mail",
    desc: "Delete an SMTP sender email address by its ID or email.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/smtp/:identifier",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-stats",
    method: "GET",
    path: "/api/admin/stats",
    title: "Server Statistics",
    category: "Admin",
    desc: "Get server stats including total emails received, disk usage, and server uptime.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"totalEmails\": 120,\n  \"uptime\": 86400,\n  \"diskUsage\": \"1.2 MB\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/stats",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-stats-traffic",
    method: "GET",
    path: "/api/admin/stats/traffic",
    title: "Traffic Statistics",
    category: "Admin",
    desc: "Get real-time traffic data, request counts, and API analytics.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"dailyHits\": [\n    {\n      \"date\": \"2026-08-23\",\n      \"hits\": 350\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/stats/traffic",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "all-mails",
    method: "GET",
    path: "/api/mails",
    title: "Get All Server Emails",
    category: "Admin",
    desc: "Fetch all incoming emails across the entire server for admin monitoring.",
    payload: null,
    response: "[\n  {\n    \"id\": \"1\",\n    \"from\": \"sender@example.com\",\n    \"to\": \"test@tempemail.vps\",\n    \"subject\": \"Test mail\",\n    \"date\": \"2026-08-23T12:00:00Z\"\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/mails",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "mailbox-client-info",
    method: "GET",
    path: "/api/mailbox/info",
    title: "Mailbox Server Info",
    category: "Admin",
    desc: "Get IMAP/POP3 hostnames, ports, and configuration details for webmail.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"primaryDomain\": \"tempemail.vps\",\n  \"imap\": {\n    \"host\": \"mail.tempemail.vps\",\n    \"sslPort\": 993,\n    \"plainPort\": 143,\n    \"status\": \"active\"\n  }\n}",
    exampleUrl: "http://your-vps-ip:8081/api/mailbox/info",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "admin-projects",
    method: "GET",
    path: "/api/admin/projects",
    title: "List API Projects",
    category: "Admin",
    desc: "List all developer projects and their API keys.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"name\": \"Default Project\",\n    \"api_key\": \"proj_key_123\"\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "admin-projects-emails",
    method: "GET",
    path: "/api/admin/projects/:id/emails",
    title: "Get Project Emails",
    category: "Admin",
    desc: "Get all emails received under a specific project.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"emails\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id/emails",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-projects-files",
    method: "GET",
    path: "/api/admin/projects/:id/files",
    title: "Get Project Files",
    category: "Admin",
    desc: "Get all attachment files stored under a specific project.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"files\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id/files",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-domains",
    method: "GET",
    path: "/api/admin/domains",
    title: "List Server Domains",
    category: "Admin",
    desc: "List all domain names connected to this email server.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"domain\": \"tempemail.vps\",\n    \"status\": \"active\",\n    \"is_primary\": 1\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/admin/domains",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "admin-credentials",
    method: "GET",
    path: "/api/admin/credentials",
    title: "Get SMTP Credentials",
    category: "Admin",
    desc: "View and manage outbound SMTP login credentials.",
    payload: null,
    response: "{\n  \"users\": [\n    {\n      \"username\": \"admin\",\n      \"email\": \"admin@tempemail.vps\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/credentials",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-server-info",
    method: "GET",
    path: "/api/admin/serverinfo",
    title: "Server Information",
    category: "Admin",
    desc: "Get server details including IP address, status, and DKIM public key.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"ip\": \"127.0.0.1\",\n  \"dkimKey\": \"v=DKIM1; k=rsa; p=MIGf...\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/serverinfo",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-dblogs",
    method: "GET",
    path: "/api/admin/dblogs/:type",
    title: "Get Server Logs",
    category: "Admin",
    desc: "View database activity and error logs (e.g. SMTP_IN, SMTP_OUT, ERROR, ALL).",
    payload: null,
    response: "{\n  \"success\": true,\n  \"logs\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/dblogs/:type",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-mailbox-users-list",
    method: "GET",
    path: "/api/admin/mailbox-users",
    title: "Get Mailbox Accounts",
    category: "Admin",
    desc: "Get a list of all permanent mailbox accounts, passwords, and project IDs.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"email\": \"support@tempemail.vps\",\n    \"project_id\": 1\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/admin/mailbox-users",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "api-settings",
    method: "GET",
    path: "/api/admin/api-settings",
    title: "Get API Settings",
    category: "Admin",
    desc: "View all API routes, their hit counts, and whether they are turned ON or OFF.",
    payload: null,
    response: "[\n  {\n    \"id\": \"api-domains\",\n    \"enabled\": true,\n    \"hits\": 45\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/admin/api-settings",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "admin-login",
    method: "POST",
    path: "/api/admin/login",
    title: "Admin Login",
    category: "Admin",
    desc: "Login to the admin dashboard and receive an authentication Bearer token.",
    payload: "{\n  \"username\": \"admin\",\n  \"password\": \"admin_password\"\n}",
    response: "{\n  \"success\": true,\n  \"token\": \"bearer_token_here\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/login",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "admin-projects-create",
    method: "POST",
    path: "/api/admin/projects",
    title: "Create API Project",
    category: "Admin",
    desc: "Create a new developer project and generate its API key.",
    payload: "{\n  \"name\": \"My Production App\",\n  \"plan\": \"pro\"\n}",
    response: "{\n  \"success\": true,\n  \"id\": 2,\n  \"apiKey\": \"proj_key_xyz\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-domains-create",
    method: "POST",
    path: "/api/admin/domains",
    title: "Add Server Domain",
    category: "Admin",
    desc: "Add a new domain name to the email server.",
    payload: "{\n  \"domain\": \"customdomain.com\",\n  \"is_primary\": false\n}",
    response: "{\n  \"success\": true,\n  \"id\": 3\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/domains",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-mailbox-users-create",
    method: "POST",
    path: "/api/admin/mailbox-users",
    title: "Create Mailbox Account",
    category: "Admin",
    desc: "Create a new permanent mailbox user account with email and password.",
    payload: "{\n  \"email\": \"sales@tempemail.vps\",\n  \"password\": \"secure_password\",\n  \"projectId\": 1\n}",
    response: "{\n  \"success\": true,\n  \"id\": 2\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/mailbox-users",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "api-settings-toggle",
    method: "POST",
    path: "/api/admin/api-settings/toggle",
    title: "Turn API Route ON / OFF",
    category: "Admin",
    desc: "Enable or disable a specific API route instantly.",
    payload: "{\n  \"id\": \"mailbox-generate\",\n  \"enabled\": false\n}",
    response: "{\n  \"success\": true,\n  \"id\": \"mailbox-generate\",\n  \"enabled\": false\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/api-settings/toggle",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "api-settings-reset",
    method: "POST",
    path: "/api/admin/api-settings/reset-hits",
    title: "Reset API Hits",
    category: "Admin",
    desc: "Reset hit counters for all API routes.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"message\": \"All hit counts reset to 0\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/api-settings/reset-hits",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-projects-update",
    method: "PUT",
    path: "/api/admin/projects/:id",
    title: "Update API Project",
    category: "Admin",
    desc: "Update project name, rate limits, or webhook configuration.",
    payload: "{\n  \"name\": \"Renamed Project\",\n  \"plan\": \"pro\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-projects-retention",
    method: "PUT",
    path: "/api/admin/projects/:id/retention",
    title: "Update Project Retention",
    category: "Admin",
    desc: "Configure data retention hours for a specific project.",
    payload: "{\n  \"retention\": {\n    \"generated_emails\": 48,\n    \"simple_mails\": 48,\n    \"attachments\": 24\n  }\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id/retention",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-domains-update",
    method: "PUT",
    path: "/api/admin/domains/:id",
    title: "Update Domain Settings",
    category: "Admin",
    desc: "Update status or settings for a specific connected domain.",
    payload: "{\n  \"status\": \"active\",\n  \"catch_all\": true\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/domains/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-mailbox-users-update",
    method: "PUT",
    path: "/api/admin/mailbox-users/:id",
    title: "Update Mailbox Password",
    category: "Admin",
    desc: "Change the password or project for an existing mailbox user account.",
    payload: "{\n  \"password\": \"new_secure_password\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/mailbox-users/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-projects-delete",
    method: "DELETE",
    path: "/api/admin/projects/:id",
    title: "Delete API Project",
    category: "Admin",
    desc: "Permanently delete a developer project and its associated API key.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-projects-hits",
    method: "DELETE",
    path: "/api/admin/projects/:id/hits",
    title: "Reset Project Hits",
    category: "Admin",
    desc: "Reset API usage hits for a specific project.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/projects/:id/hits",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-domains-delete",
    method: "DELETE",
    path: "/api/admin/domains/:id",
    title: "Delete Server Domain",
    category: "Admin",
    desc: "Remove a domain from the email server.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/domains/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "admin-mailbox-users-delete",
    method: "DELETE",
    path: "/api/admin/mailbox-users/:id",
    title: "Delete Mailbox Account",
    category: "Admin",
    desc: "Permanently delete a mailbox user account by ID.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/admin/mailbox-users/:id",
    returns: "JSON Object",
    auth: true
  }
];

const methodColors: Record<string, { badge: string; glow: string; dot: string }> = {
  GET: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", glow: "shadow-emerald-500/10", dot: "bg-emerald-500" },
  POST: { badge: "bg-violet-500/10 text-violet-400 border-violet-500/25", glow: "shadow-violet-500/10", dot: "bg-violet-500" },
  PUT: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/25", glow: "shadow-amber-500/10", dot: "bg-amber-500" },
  DELETE: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/25", glow: "shadow-rose-500/10", dot: "bg-rose-500" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ApiDocumentation() {
  const [activeTab, setActiveTab] = useState(endpoints[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://localhost:8081");
  const [codeLang, setCodeLang] = useState<"curl" | "js" | "python" | "php">("curl");
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabledApiIds, setEnabledApiIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
      const token = localStorage.getItem("admin_token");
      if (token) setIsAdmin(true);
    }

    // Fetch enabled settings
    fetch("/api/docs/settings")
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.settings) {
          const ids = new Set<string>();
          data.settings.forEach((s: any) => {
            if (s.enabled) {
              ids.add(s.id);
            }
          });
          setEnabledApiIds(ids);
        }
      })
      .catch(err => console.error("Failed to load API settings", err));
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

  const activeEndpoints = enabledApiIds ? endpoints.filter(e => enabledApiIds.has(e.id)) : endpoints;
  const ep = activeEndpoints.find(e => e.id === activeTab) || activeEndpoints[0] || endpoints[0];
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

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400">
            <Link href="/" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Home</Link>
            <Link href="/doc" className="text-emerald-400 font-semibold transition-colors cursor-pointer bg-transparent border-none">Client APIs</Link>
            <Link href="/devdoc" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5">
              <span>Dev API Hub</span>
              <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">/api/dev</span>
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Consoles</Link>
            <Link href="/mailbox" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Webmail</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/devdoc" className="text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-2 rounded-xl transition-all">Dev Docs →</Link>
            <Link href="/admin/" className="text-xs sm:text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 px-4 py-2 rounded-xl transition-all cursor-pointer">Admin</Link>
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
                {["Receive Mail", "Project Settings", "Send Mail", "Mailbox Client", "Admin"].map(cat => {
                  const catEndpoints = activeEndpoints.filter(e => e.category === cat);
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
                            {e.disabled && (
                              <span className="shrink-0 text-[8px] font-extrabold font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                Disabled
                              </span>
                            )}
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
              // Flat list for non-admin - show Receive Mail & Project Settings
              <>
                {["Receive Mail", "Project Settings"].map(cat => {
                  const catEndpoints = activeEndpoints.filter(e => e.category === cat);
                  if (catEndpoints.length === 0) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <p className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.15em] px-2 py-2">{cat} Endpoints</p>
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
                <div className="mt-4 mx-1 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <p className="text-[10px] text-emerald-400/80 font-mono leading-relaxed">
                    🔒 Admin, Mailbox Client & Send Mail APIs are hidden.<br />
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
                {ep.disabled && (
                  <span className="text-[10px] font-extrabold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    Disabled
                  </span>
                )}
              </div>

              {ep.disabled && (
                <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-3 text-rose-300 text-xs font-medium">
                  <svg className="w-5 h-5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>This endpoint is currently <strong>disabled</strong> (scheduled for a future release). Outbound email sending directly from mailbox is not available at present.</span>
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight flex items-center gap-3">
                <span>{ep.title}</span>
                {ep.disabled && (
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    COMING SOON
                  </span>
                )}
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
                const idx = activeEndpoints.findIndex(e => e.id === activeTab);
                const prev = activeEndpoints[idx - 1];
                const next = activeEndpoints[idx + 1];
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
