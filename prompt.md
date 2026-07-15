# Comprehensive Feature Request: Third-Party API & Mailbox Integration System

Please implement a fully functional third-party API system that allows external applications and websites to integrate with this email server. We also need APIs specifically for external users to log in to and manage their permanent mailboxes. 

Please read the following requirements carefully and implement them end-to-end.

## 1. Third-Party API & Project Tracking
- **API Key System:** Admins can create "Projects" in the admin dashboard (e.g., website1.com, app2). Each project generates a unique API Key.
- **Authentication:** External apps must pass this API key in the request header (`Authorization: Bearer <API_KEY>`) to access protected third-party APIs.
- **Usage Tracking (Hits Count):** Every valid API request made by a project should be recorded. The Admin Dashboard must display the total number of API "hits" each project has made so the admin can monitor usage.
- **Update Existing APIs:** Double-check the existing APIs (like `/api/mailbox/generate` and `/api/mailbox/custom`). Ensure they are fully secured behind this API Key auth system and properly record hits. Update the backend logic if anything is incomplete or handled incorrectly.

## 2. Mailbox Client APIs (For Third-Party Applications)
We want external users to be able to use their purchased custom mailboxes via an API.
Please create or update APIs that allow external applications to:
- **Login / Logout:** Authenticate a mailbox user (e.g., support@customdomain.com) using their email and password from an external app, and securely log them out.
- **Fetch Inbox Messages:** Retrieve all messages for the logged-in mailbox (both simple text and messages with attachments).
- **Message Count:** An endpoint to quickly get the total number of messages in a specific mailbox. (Note: Do NOT track API "hits" for these end-user mailbox actions, only message counts).
- **Delete Messages:** Allow the authenticated user to delete specific messages from their inbox.
*(Ensure these APIs are fully functional and securely authenticated).*

## 3. API Documentation Visibility
- **Protected `/doc` Page:** The API documentation page should only display all sensitive backend APIs if the Admin is logged in. Please verify that public users cannot view admin-level API documentation. just emails related apis can see i think already this feature is done but double check.

## 4. Comprehensive Bug Fixes & Code Review
While implementing these features, please double-check the following potential bugs or incomplete features and resolve them in this same prompt execution:
1. **Mailbox Route Naming Consistency:** The UI route was recently renamed from `webmail` to `mailbox`. Please verify that there are no leftover broken links, incorrectly named components, or API mismatches (e.g., check `AdminPageClient.tsx`, `MailboxManager.tsx`, and `api-router.js` for any lingering case-sensitivity or old naming issues).
2. **Mailbox Users Table Verification:** Ensure that the database correctly uses `mailbox_users` instead of `webmail_users` everywhere in `db.js` and `api-router.js`.
3. **API Key Fallbacks:** In `ApiRouter.validateApiKey`, ensure that the API key checking logic is completely robust and safely logs the project hit without crashing if a project is deleted.
4. If you find any other broken feature or bug in the mailbox viewing or generation logic, please fix it immediately.

**Final Goal:** Provide a flawless, secure, and production-ready Third-Party API integration without any remaining bugs. Wrap it all up in one go!
