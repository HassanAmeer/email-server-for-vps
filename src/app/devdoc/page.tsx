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

// ─── Developer Endpoints Data ────────────────────────────────────────────────
const endpoints: Endpoint[] = [
  {
    id: "dev-api-domains",
    method: "GET",
    path: "/api/dev/domains",
    title: "Active Domains List",
    category: "Dev Receive Mail",
    desc: "Fetch all active domains available for generating temporary emails.",
    payload: null,
    response: "{\n  \"domains\": [\n    \"llamerada.online\",\n    \"tempemail.vps\"\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/domains",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "dev-mailbox-generate",
    method: "GET",
    path: "/api/dev/mailbox/generate",
    title: "Generate Random Mailbox",
    category: "Dev Receive Mail",
    desc: "Generate a new random temporary email address. Optionally pass ?domain= to choose a specific domain.",
    payload: null,
    response: "{\n  \"email\": \"a1b2c3d4@tempemail.vps\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/generate",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-custom",
    method: "GET",
    path: "/api/dev/mailbox/custom",
    title: "Create Custom Mailbox",
    category: "Dev Receive Mail",
    desc: "Create a custom temporary email address with your chosen name using ?name= and optional ?domain=.",
    payload: null,
    response: "{\n  \"email\": \"myname@tempemail.vps\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/custom",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-get",
    method: "GET",
    path: "/api/dev/mailbox/:email",
    title: "Get Received Emails",
    category: "Dev Receive Mail",
    desc: "List of inboxes by email (get all received emails and messages for a specific email address).",
    payload: null,
    response: "[\n  {\n    \"id\": \"1234567890\",\n    \"from\": \"noreply@github.com\",\n    \"to\": \"test@tempemail.vps\",\n    \"subject\": \"Verify your email\",\n    \"text\": \"Your code is 123456\",\n    \"html\": \"<p>Your code is <b>123456</b></p>\",\n    \"date\": \"2026-07-07T10:17:02.000Z\",\n    \"attachments\": []\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/:email",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-get-attachment",
    method: "GET",
    path: "/api/dev/attachments/:filename",
    title: "Download Attachment",
    category: "Dev Receive Mail",
    desc: "Download an attached file (image, PDF, document) from a received email using its filename.",
    payload: null,
    response: "<Binary file stream / image bytes>",
    exampleUrl: "http://your-vps-ip:8081/api/dev/attachments/:filename",
    returns: "Binary payload stream",
    auth: false
  },
  {
    id: "dev-mailbox-delete",
    method: "DELETE",
    path: "/api/dev/mailbox/:email",
    title: "Delete Entire Mailbox",
    category: "Dev Receive Mail",
    desc: "Delete all received emails and messages for a specific email address.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/:email",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-delete-one",
    method: "DELETE",
    path: "/api/dev/mailbox/:email/:mailId",
    title: "Delete Single Email",
    category: "Dev Receive Mail",
    desc: "Delete a single specific email by its ID from a mailbox.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"mailId\": \"1234567890\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/:email/:mailId",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-client-inbox",
    method: "GET",
    path: "/api/dev/mailbox/inbox",
    title: "Get User Inbox",
    category: "Dev Master Mailbox",
    desc: "Get the list of received emails for the logged-in mailbox user.",
    payload: null,
    response: "{\n  \"messages\": [\n    {\n      \"id\": 1,\n      \"from\": \"billing@stripe.com\",\n      \"subject\": \"Your Invoice\",\n      \"date\": \"2026-07-15T09:00:00Z\",\n      \"hasAttachments\": true\n    }\n  ],\n  \"total\": 1,\n  \"page\": 1,\n  \"limit\": 200\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-client-count",
    method: "GET",
    path: "/api/dev/mailbox/count",
    title: "Get Unread Email Count",
    category: "Dev Master Mailbox",
    desc: "Get the total number of emails in the user inbox (useful for badges).",
    payload: null,
    response: "{\n  \"success\": true,\n  \"count\": 12\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/count",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-client-read",
    method: "GET",
    path: "/api/dev/mailbox/inbox/:id",
    title: "Read Single Email",
    category: "Dev Master Mailbox",
    desc: "Get full details, text, HTML, and attachments of a specific email by its ID.",
    payload: null,
    response: "{\n  \"id\": 1,\n  \"from\": \"billing@stripe.com\",\n  \"to\": \"support@yourdomain.com\",\n  \"subject\": \"Your Invoice\",\n  \"text\": \"Payment received\",\n  \"html\": \"<p>Payment received</p>\",\n  \"date\": \"2026-07-15T09:00:00Z\",\n  \"attachments\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-client-media",
    method: "GET",
    path: "/api/dev/mailbox/media",
    title: "List Email Attachments",
    category: "Dev Master Mailbox",
    desc: "Get all file attachments received in the user mailbox with download links.",
    payload: null,
    response: "{\n  \"media\": [\n    {\n      \"emailId\": 1,\n      \"filename\": \"invoice.pdf\",\n      \"size\": 14205,\n      \"url\": \"/api/attachments/invoice.pdf\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/media",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-mailbox-client-login",
    method: "POST",
    path: "/api/dev/mailbox/login",
    title: "Mailbox User Login",
    category: "Dev Master Mailbox",
    desc: "Login as a mailbox user using email and password to get an access token.",
    payload: "{\n  \"email\": \"support@yourdomain.com\",\n  \"password\": \"your_password\"\n}",
    response: "{\n  \"success\": true,\n  \"token\": \"session_token_here\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/login",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "dev-mailbox-client-delete",
    method: "DELETE",
    path: "/api/dev/mailbox/inbox/:id",
    title: "Delete Single Email",
    category: "Dev Master Mailbox",
    desc: "Delete a specific email from the logged-in user inbox.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/inbox/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-list",
    method: "GET",
    path: "/api/dev/smtp",
    title: "List SMTP Accounts",
    category: "Dev Send Mail",
    desc: "Get all configured SMTP sender email addresses.",
    payload: null,
    response: "{\n  \"users\": [\n    {\n      \"id\": \"acc_1\",\n      \"email\": \"support@tempemail.vps\",\n      \"domain\": \"tempemail.vps\",\n      \"description\": \"Primary Support Outbound\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-create",
    method: "POST",
    path: "/api/dev/smtp",
    title: "Create SMTP Account",
    category: "Dev Send Mail",
    desc: "Create a new SMTP sender email address for sending emails.",
    payload: "{\n  \"email\": \"support@tempemail.vps\",\n  \"password\": \"secure_password\",\n  \"domain\": \"tempemail.vps\",\n  \"description\": \"Customer Support\"\n}",
    response: "{\n  \"success\": true,\n  \"id\": \"acc_1\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-send",
    method: "POST",
    path: "/api/dev/smtp/send",
    title: "Send Single Email",
    category: "Dev Send Mail",
    desc: "Send a single email (with text, HTML, and attachments) via SMTP.",
    payload: "{\n  \"from\": \"support@tempemail.vps\",\n  \"to\": \"customer@example.com\",\n  \"subject\": \"Welcome\",\n  \"text\": \"Hello World\",\n  \"html\": \"<p>Hello World</p>\"\n}",
    response: "{\n  \"success\": true,\n  \"messageId\": \"<msg-12345@tempemail.vps>\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/send",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-send-bulk",
    method: "POST",
    path: "/api/dev/smtp/send-bulk",
    title: "Send Bulk Emails",
    category: "Dev Send Mail",
    desc: "Send emails to multiple recipients one by one with a safe delay between each email.",
    payload: "{\n  \"from\": \"news@tempemail.vps\",\n  \"recipients\": [\n    \"user1@example.com\",\n    \"user2@example.com\"\n  ],\n  \"subject\": \"Newsletter\",\n  \"text\": \"Weekly updates\",\n  \"delaySeconds\": 5\n}",
    response: "{\n  \"success\": true,\n  \"totalQueued\": 2,\n  \"estimatedTimeSeconds\": 10\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/send-bulk",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-test",
    method: "POST",
    path: "/api/dev/smtp/test",
    title: "Test SMTP Relay",
    category: "Dev Send Mail",
    desc: "Send a test email to verify SMTP relay configuration.",
    payload: "{\n  \"toEmail\": \"test@example.com\",\n  \"fromEmail\": \"support@tempemail.vps\",\n  \"subject\": \"Relay Test\",\n  \"text\": \"Testing SMTP Relay\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/test",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-smtp-delete",
    method: "DELETE",
    path: "/api/dev/smtp/:identifier",
    title: "Delete SMTP Account",
    category: "Dev Send Mail",
    desc: "Delete an SMTP sender email address by its ID or email.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/smtp/:identifier",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-stats",
    method: "GET",
    path: "/api/devpanel/stats",
    title: "Server Statistics",
    category: "DevPanel Management",
    desc: "Get server stats including total emails received, disk usage, and server uptime.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"totalEmails\": 120,\n  \"uptime\": 86400,\n  \"diskUsage\": \"1.2 MB\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/stats",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-stats-traffic",
    method: "GET",
    path: "/api/devpanel/stats/traffic",
    title: "Traffic Statistics",
    category: "DevPanel Management",
    desc: "Get real-time traffic data, request counts, and API analytics.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"dailyHits\": [\n    {\n      \"date\": \"2026-08-23\",\n      \"hits\": 350\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/stats/traffic",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-all-mails",
    method: "GET",
    path: "/api/dev/mails",
    title: "Get All Server Emails",
    category: "DevPanel Management",
    desc: "Fetch all incoming emails across the entire server for admin monitoring.",
    payload: null,
    response: "[\n  {\n    \"id\": \"1\",\n    \"from\": \"sender@example.com\",\n    \"to\": \"test@tempemail.vps\",\n    \"subject\": \"Test mail\",\n    \"date\": \"2026-08-23T12:00:00Z\"\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mails",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-mailbox-client-info",
    method: "GET",
    path: "/api/dev/mailbox/info",
    title: "Mailbox Server Info",
    category: "DevPanel Management",
    desc: "Get IMAP/POP3 hostnames, ports, and configuration details for webmail.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"primaryDomain\": \"tempemail.vps\",\n  \"imap\": {\n    \"host\": \"mail.tempemail.vps\",\n    \"sslPort\": 993,\n    \"plainPort\": 143,\n    \"status\": \"active\"\n  }\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/mailbox/info",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "dev-admin-projects",
    method: "GET",
    path: "/api/devpanel/projects",
    title: "List API Projects",
    category: "DevPanel Management",
    desc: "List all developer projects and their API keys.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"name\": \"Default Project\",\n    \"api_key\": \"proj_key_123\"\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-admin-projects-emails",
    method: "GET",
    path: "/api/devpanel/projects/:id/emails",
    title: "Get Project Emails",
    category: "DevPanel Management",
    desc: "Get all emails received under a specific project.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"emails\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id/emails",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-projects-files",
    method: "GET",
    path: "/api/devpanel/projects/:id/files",
    title: "Get Project Files",
    category: "DevPanel Management",
    desc: "Get all attachment files stored under a specific project.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"files\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id/files",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-domains",
    method: "GET",
    path: "/api/devpanel/domains",
    title: "List Server Domains",
    category: "DevPanel Management",
    desc: "List all domain names connected to this email server.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"domain\": \"tempemail.vps\",\n    \"status\": \"active\",\n    \"is_primary\": 1\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-admin-credentials",
    method: "GET",
    path: "/api/devpanel/credentials",
    title: "Get SMTP Credentials",
    category: "DevPanel Management",
    desc: "View and manage outbound SMTP login credentials.",
    payload: null,
    response: "{\n  \"users\": [\n    {\n      \"username\": \"admin\",\n      \"email\": \"admin@tempemail.vps\"\n    }\n  ]\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/credentials",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-server-info",
    method: "GET",
    path: "/api/devpanel/serverinfo",
    title: "Server Information",
    category: "DevPanel Management",
    desc: "Get server details including IP address, status, and DKIM public key.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"ip\": \"127.0.0.1\",\n  \"dkimKey\": \"v=DKIM1; k=rsa; p=MIGf...\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/serverinfo",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-dblogs",
    method: "GET",
    path: "/api/devpanel/dblogs/all",
    title: "Get Server Logs",
    category: "DevPanel Management",
    desc: "View database activity and error logs (e.g. SMTP_IN, SMTP_OUT, ERROR, ALL).",
    payload: null,
    response: "{\n  \"success\": true,\n  \"logs\": []\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/dblogs/all",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-mailbox-users-list",
    method: "GET",
    path: "/api/dev-admin/mailbox-users",
    title: "Get Mailbox Accounts",
    category: "DevPanel Management",
    desc: "Get a list of all permanent mailbox accounts, passwords, and project IDs.",
    payload: null,
    response: "[\n  {\n    \"id\": 1,\n    \"email\": \"support@tempemail.vps\",\n    \"project_id\": 1\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/dev-admin/mailbox-users",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-api-settings",
    method: "GET",
    path: "/api/devpanel/api-settings",
    title: "Get API Settings",
    category: "DevPanel Management",
    desc: "View all API routes, their hit counts, and whether they are turned ON or OFF.",
    payload: null,
    response: "[\n  {\n    \"id\": \"api-domains\",\n    \"enabled\": true,\n    \"hits\": 45\n  }\n]",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/api-settings",
    returns: "JSON Array",
    auth: true
  },
  {
    id: "dev-get-retention-settings",
    method: "GET",
    path: "/api/dev/project/retention",
    title: "Get Email Auto-Delete Time",
    category: "Dev Project Settings",
    desc: "Get the auto-cleanup time limit (in hours) for temporary emails and attachments.",
    payload: null,
    response: "{\n  \"retention\": {\n    \"free\": {\n      \"generated_emails\": 24,\n      \"simple_mails\": 24,\n      \"attachments\": 12\n    }\n  }\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/retention",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-get-allowed-files",
    method: "GET",
    path: "/api/dev/project/allowed-files",
    title: "Get Allowed Attachment Types",
    category: "Dev Project Settings",
    desc: "Get the list of allowed file extensions (like png, jpg, pdf) for email attachments.",
    payload: null,
    response: "{\n  \"allowedFiles\": {\n    \"free\": [\n      \"txt\",\n      \"png\",\n      \"jpg\",\n      \"pdf\"\n    ]\n  }\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/allowed-files",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-get-forbidden-ids",
    method: "GET",
    path: "/api/dev/project/forbidden-ids",
    title: "Get Blocked Names",
    category: "Dev Project Settings",
    desc: "Get the list of blocked email usernames (like admin, support, root) that users cannot create.",
    payload: null,
    response: "{\n  \"forbiddenIds\": {\n    \"free\": [\n      \"admin\",\n      \"info\",\n      \"support\",\n      \"root\"\n    ]\n  }\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/forbidden-ids",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-login",
    method: "POST",
    path: "/api/devpanel/login",
    title: "Admin Login",
    category: "DevPanel Management",
    desc: "Login to the admin dashboard and receive an authentication Bearer token.",
    payload: "{\n  \"username\": \"admin\",\n  \"password\": \"admin_password\"\n}",
    response: "{\n  \"success\": true,\n  \"token\": \"bearer_token_here\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/login",
    returns: "JSON Object",
    auth: false
  },
  {
    id: "dev-admin-projects-create",
    method: "POST",
    path: "/api/devpanel/projects",
    title: "Create API Project",
    category: "DevPanel Management",
    desc: "Create a new developer project and generate its API key.",
    payload: "{\n  \"name\": \"My Production App\",\n  \"plan\": \"pro\"\n}",
    response: "{\n  \"success\": true,\n  \"id\": 2,\n  \"apiKey\": \"proj_key_xyz\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-domains-create",
    method: "POST",
    path: "/api/devpanel/domains",
    title: "Add Server Domain",
    category: "DevPanel Management",
    desc: "Add a new domain name to the email server.",
    payload: "{\n  \"domain\": \"customdomain.com\",\n  \"is_primary\": false\n}",
    response: "{\n  \"success\": true,\n  \"id\": 3\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-mailbox-users-create",
    method: "POST",
    path: "/api/dev-admin/mailbox-users",
    title: "Create Mailbox Account",
    category: "DevPanel Management",
    desc: "Create a new permanent mailbox user account with email and password.",
    payload: "{\n  \"email\": \"sales@tempemail.vps\",\n  \"password\": \"secure_password\",\n  \"projectId\": 1\n}",
    response: "{\n  \"success\": true,\n  \"id\": 2\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev-admin/mailbox-users",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-api-settings-toggle",
    method: "POST",
    path: "/api/devpanel/api-settings/toggle",
    title: "Turn API Route ON / OFF",
    category: "DevPanel Management",
    desc: "Enable or disable a specific API route instantly.",
    payload: "{\n  \"id\": \"mailbox-generate\",\n  \"enabled\": false\n}",
    response: "{\n  \"success\": true,\n  \"id\": \"mailbox-generate\",\n  \"enabled\": false\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/api-settings/toggle",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-api-settings-reset",
    method: "POST",
    path: "/api/devpanel/api-settings/reset-hits",
    title: "Reset API Hits",
    category: "DevPanel Management",
    desc: "Reset hit counters for all API routes.",
    payload: null,
    response: "{\n  \"success\": true,\n  \"message\": \"All hit counts reset to 0\"\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/api-settings/reset-hits",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-projects-update",
    method: "PUT",
    path: "/api/devpanel/projects/:id",
    title: "Update API Project",
    category: "DevPanel Management",
    desc: "Update project name, rate limits, or webhook configuration.",
    payload: "{\n  \"name\": \"Renamed Project\",\n  \"plan\": \"pro\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-projects-retention",
    method: "PUT",
    path: "/api/devpanel/projects/:id/retention",
    title: "Update Project Retention",
    category: "DevPanel Management",
    desc: "Configure data retention hours for a specific project.",
    payload: "{\n  \"retention\": {\n    \"generated_emails\": 48,\n    \"simple_mails\": 48,\n    \"attachments\": 24\n  }\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id/retention",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-domains-update",
    method: "PUT",
    path: "/api/devpanel/domains/:id",
    title: "Update Domain Settings",
    category: "DevPanel Management",
    desc: "Update status or settings for a specific connected domain.",
    payload: "{\n  \"status\": \"active\",\n  \"catch_all\": true\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-mailbox-users-update",
    method: "PUT",
    path: "/api/dev-admin/mailbox-users/:id",
    title: "Update Mailbox Password",
    category: "DevPanel Management",
    desc: "Change the password or project for an existing mailbox user account.",
    payload: "{\n  \"password\": \"new_secure_password\"\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev-admin/mailbox-users/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-update-retention-settings",
    method: "PUT",
    path: "/api/dev/project/retention",
    title: "Update Email Auto-Delete Time",
    category: "Dev Project Settings",
    desc: "Update how long (in hours) emails and attachments are kept before being automatically deleted.",
    payload: "{\n  \"retention\": {\n    \"free\": {\n      \"generated_emails\": 24,\n      \"simple_mails\": 12,\n      \"attachments\": 6\n    }\n  }\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/retention",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-update-allowed-files",
    method: "PUT",
    path: "/api/dev/project/allowed-files",
    title: "Update Allowed Attachment Types",
    category: "Dev Project Settings",
    desc: "Update the list of allowed file extensions for email attachments.",
    payload: "{\n  \"allowedFiles\": {\n    \"free\": [\n      \"txt\",\n      \"png\",\n      \"jpg\",\n      \"pdf\"\n    ]\n  }\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/allowed-files",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-update-forbidden-ids",
    method: "PUT",
    path: "/api/dev/project/forbidden-ids",
    title: "Update Blocked Names",
    category: "Dev Project Settings",
    desc: "Update the list of blocked email usernames that cannot be generated.",
    payload: "{\n  \"forbiddenIds\": {\n    \"free\": [\n      \"admin\",\n      \"info\",\n      \"support\",\n      \"contact\",\n      \"ceo\"\n    ]\n  }\n}",
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev/project/forbidden-ids",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-projects-delete",
    method: "DELETE",
    path: "/api/devpanel/projects/:id",
    title: "Delete API Project",
    category: "DevPanel Management",
    desc: "Permanently delete a developer project and its associated API key.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-projects-hits",
    method: "DELETE",
    path: "/api/devpanel/projects/:id/hits",
    title: "Reset Project Hits",
    category: "DevPanel Management",
    desc: "Reset API usage hits for a specific project.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/projects/:id/hits",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-domains-delete",
    method: "DELETE",
    path: "/api/devpanel/domains/:id",
    title: "Delete Server Domain",
    category: "DevPanel Management",
    desc: "Remove a domain from the email server.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/devpanel/domains/:id",
    returns: "JSON Object",
    auth: true
  },
  {
    id: "dev-admin-mailbox-users-delete",
    method: "DELETE",
    path: "/api/dev-admin/mailbox-users/:id",
    title: "Delete Mailbox Account",
    category: "DevPanel Management",
    desc: "Permanently delete a mailbox user account by ID.",
    payload: null,
    response: "{\n  \"success\": true\n}",
    exampleUrl: "http://your-vps-ip:8081/api/dev-admin/mailbox-users/:id",
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
