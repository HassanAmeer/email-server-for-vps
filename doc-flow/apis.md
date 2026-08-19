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
 │  /api/dev/mails                      │ GET    │ Dev Panel Management        │ 🔒 Bearer │ Active │
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









==================================================
   FULL END-TO-END SMTP API VERIFICATION SUITE   
==================================================
1. Admin Authentication:               ✓ SUCCESS
2. GET /api/admin/smtp (List):         ✓ SUCCESS (Returns JSON array)
3. POST /api/admin/smtp (Create):      ✓ SUCCESS (Account created & saved to disk)
4. POST /api/admin/smtp/toggle:        ✓ SUCCESS (Status toggled to: Paused)
5. POST /api/admin/smtp/toggle:        ✓ SUCCESS (Status toggled to: Active)
6. POST /api/admin/smtp/send:          ✓ SUCCESS (Recipient validation & DKIM relay OK)
7. DELETE /api/admin/smtp/:username:   ✓ SUCCESS (Account removed cleanly)
--------------------------------------------------
            DEVPANEL ENDPOINTS TESTING            
--------------------------------------------------
8. GET /api/dev-admin/smtp:            ✓ SUCCESS (Returns JSON array)
9. POST /api/dev-admin/smtp (Create):  ✓ SUCCESS (Auto-generated secure password)
10. POST /api/dev-admin/smtp/toggle:   ✓ SUCCESS (Status toggled to: Paused)
11. DELETE /api/dev-admin/smtp/:user:  ✓ SUCCESS (Account deleted)
--------------------------------------------------
           PUBLIC & GENERIC REST ROUTES           
--------------------------------------------------
12. POST /api/smtp/send (REST Send):   ✓ SUCCESS (Direct HTTP Outbound Mail OK)
13. POST /api/v1/send-mail (API Send): ✓ SUCCESS (Direct HTTP Outbound Mail OK)
==================================================
     ALL 13 SMTP API TESTS PASSED 100% OK!        
==================================================
