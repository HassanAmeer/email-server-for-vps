"use client";

import { PanelDashboardShell } from "@/components/panel/PanelDashboardShell";

interface AdminPageClientProps {
  tabSegment: string;
}

export function AdminPageClient({ tabSegment }: AdminPageClientProps) {
  return (
    <PanelDashboardShell
      mode="admin"
      basePath="/admin"
      tabSegment={tabSegment}
      loginEndpoint="/api/admin/login"
      statsEndpoint="/api/admin/stats"
      tokenKey="admin_token"
      superTokenKey="admin_static_super"
      panelLabel="ADMIN CONSOLE"
      accentColor="emerald"
      defaultUsername="admin"
    />
  );
}

export default AdminPageClient;
