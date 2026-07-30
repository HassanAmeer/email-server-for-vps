# Changelog - VPS Server API (Bun)

Yeh file VPS Email Server API mein kiye gaye tamam naye features, updates, aur bug fixes ka record maintain karti hai.

## [Recent Updates]

### Added
- **Forbidden IDs API (Project-Specific)**: 
  - `projects` table mein 2 naye columns `forbidden_ids_free` aur `forbidden_ids_pro` add kiye gaye hain.
  - **Endpoint `GET /api/project/forbidden-ids`**: Project-specific forbidden IDs (Free & Pro) fetch karne ke liye.
  - **Endpoint `PUT /api/project/forbidden-ids`**: Project-specific forbidden IDs update karne ke liye (payload mein `free` aur `pro` dono arrays bheji ja sakti hain).
  - In tamam features ki tafseel `README.md` mein **🚫 Forbidden IDs API** ke section mein update kar di gayi hai.
- **Email Retention / Age Settings API**:
  - `projects` table mein retention limits (generated_emails, simple_mails, attachments) ke liye `_free` aur `_pro` columns add kiye gaye hain.
  - **Endpoint `GET /api/project/retention`**: Project-specific data retention settings (Free & Pro) fetch karne ke liye.
  - **Endpoint `PUT /api/project/retention`**: Free aur Pro users ki retention limits ko dynamically update karne ke liye.
- **Allowed Files API (Project-Specific)**:
  - `projects` table mein `allowed_files_free` aur `allowed_files_pro` columns add kiye gaye hain.
  - **Endpoint `GET /api/project/allowed-files`**: Project-specific allowed attachments extensions fetch karne ke liye.
  - **Endpoint `PUT /api/project/allowed-files`**: Free aur Pro users ke allowed file extensions ko update karne ke liye.
