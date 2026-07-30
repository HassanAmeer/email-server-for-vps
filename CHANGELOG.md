# Changelog - VPS Server API (Bun)

Yeh file VPS Email Server API mein kiye gaye tamam naye features, updates, aur bug fixes ka record maintain karti hai.

## [Recent Updates]

### Added
- **Forbidden IDs API (Project-Specific)**: 
  - `projects` table mein 2 naye columns `forbidden_ids_free` aur `forbidden_ids_pro` add kiye gaye hain.
  - **Endpoint `GET /api/project/forbidden-ids`**: Project-specific forbidden IDs (Free & Pro) fetch karne ke liye.
  - **Endpoint `PUT /api/project/forbidden-ids`**: Project-specific forbidden IDs update karne ke liye (payload mein `free` aur `pro` dono arrays bheji ja sakti hain).
  - In tamam features ki tafseel `README.md` mein **🚫 Forbidden IDs API** ke section mein update kar di gayi hai.
- **Email Retention / Age Settings API (Limits in Hours)**:
  - Retention limits (generated_emails, simple_mails, attachments) ab **Hours (ghante)** ke hisab se set hoti hain.
  - `projects` table mein retention limits ke liye `_free` aur `_pro` columns add kiye gaye hain.
  - **Endpoint `GET /api/project/retention`**: Project-specific data retention settings (Free & Pro) fetch karne ke liye.
  - **Endpoint `PUT /api/project/retention`**: Free aur Pro users ki retention limits ko dynamically update karne ke liye.
- **Allowed Files API (Project-Specific)**:
  - `projects` table mein `allowed_files_free` aur `allowed_files_pro` columns add kiye gaye hain.
  - **Endpoint `GET /api/project/allowed-files`**: Project-specific allowed attachments extensions fetch karne ke liye.
  - **Endpoint `PUT /api/project/allowed-files`**: Free aur Pro users ke allowed file extensions ko update karne ke liye.
- **Comprehensive API Documentation**:
  - In tamam 3 project-specific APIs ki mukammal aur proper documentation, request headers, sample payloads, response formats aur plan-based usage examples `README.md` mein update kar di gayi hain.
- **Mailbox Logins Management APIs & Laravel Admin Panel Tab**:
  - `mailbox_users` table mein `plain_password` column add kiya gaya taake admin mailbox logins aur unke passwords ko easily read/manage kar sake.
  - Full CRUD APIs: `GET`, `POST`, `PUT`, `DELETE /api/admin/mailbox-users`.
  - Laravel Admin Panel mein **Mailbox Logins** ka naya sidebar tab add kiya gaya jisme Admin mailbox accounts create, view (toggle passwords), update password, delete, aur mailbox inbox (with filters: All, Simple, Attachments, HTML view, Download attachments) check kar sakta hai.
