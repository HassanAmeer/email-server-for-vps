 ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  Section 1: 📥 Dev Inbound & Mailbox APIs (/api/dev/*)                                          │
 ├──────────────────────────────────────┬────────┬─────────────────────────────┬───────────┬────────┤
 │  Route Endpoint                      │ Method │ Category                    │ Auth      │ Status │
 ├──────────────────────────────────────┼────────┼─────────────────────────────┼───────────┼────────┤
 │  /api/dev/domains                    │ GET    │ Dev Mailbox UI              │ Public    │ Active │
 │  /api/dev/mailbox/generate           │ GET    │ Dev Mailbox UI              │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/custom             │ GET    │ Dev Mailbox UI              │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/:email             │ GET    │ Dev Mailbox UI              │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/:email/otps        │ GET    │ Dev Mailbox UI              │ 🔒 Bearer │ Active │
 │  /api/dev/attachments/:filename      │ GET    │ Dev Mailbox UI              │ Public    │ Active │
 │  /api/dev/mailbox/:email             │ DELETE │ Dev Mailbox UI              │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/info               │ GET    │ Dev Master Mailbox          │ Public    │ Active │
 │  /api/dev/mailbox/login              │ POST   │ Dev Master Mailbox          │ Public    │ Active │
 │  /api/dev/mailbox/inbox              │ GET    │ Dev Master Mailbox          │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/count              │ GET    │ Dev Master Mailbox          │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/inbox/:id          │ GET    │ Dev Master Mailbox          │ 🔒 Bearer │ Active │
 │  /api/dev/mailbox/media              │ GET    │ Dev Master Mailbox          │ 🔒 Bearer │ Active │
 ├──────────────────────────────────────┴────────┴─────────────────────────────┴───────────┴────────┤
 │  Section 2: 🌐 Dev Outbound & SMTP Relay APIs (/api/dev/*)                                      │
 ├──────────────────────────────────────┬────────┬─────────────────────────────┬───────────┬────────┤
 │  /api/dev/emails/local               │ GET    │ Dev Local Console           │ 🔒 Bearer │ Active │
 │  /api/dev/emails/live                │ GET    │ Dev Live Console            │ 🔒 Bearer │ Active │
 │  /api/dev/send-email/local           │ POST   │ Dev Local Console           │ 🔒 Bearer │ Active │
 │  /api/dev/send-email/live            │ POST   │ Dev Live Console            │ Public    │ Active │
 │  /api/dev/mails                      │ GET    │ Dev Admin Management        │ 🔒 Bearer │ Active │
 ├──────────────────────────────────────┴────────┴─────────────────────────────┴───────────┴────────┤
 │  Section 3: 🛠️ DevPanel Management & Server APIs (/api/devpanel/*)                              │
 ├──────────────────────────────────────┬────────┬─────────────────────────────┬───────────┬────────┤
 │  /api/devpanel/login                 │ POST   │ DevPanel Management         │ Public    │ Active │
 │  /api/devpanel/stats                 │ GET    │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/stats/traffic         │ GET    │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/projects              │ GET/P  │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/domains               │ GET/P  │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/api-settings          │ GET    │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/api-settings/toggle   │ POST   │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/api-settings/reset    │ POST   │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/smtp-flags            │ GET/P  │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/seed                  │ GET/P  │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/dblogs                │ GET    │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/serverinfo            │ GET    │ DevPanel Management         │ 🔒 Bearer │ Active │
 │  /api/devpanel/credentials           │ G/P/D  │ DevPanel Management         │ 🔒 Bearer │ Active │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
