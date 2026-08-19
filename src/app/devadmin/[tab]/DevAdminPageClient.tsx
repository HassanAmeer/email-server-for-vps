"use client";

import { PanelDashboardShell } from "@/components/panel/PanelDashboardShell";

interface DevAdminPageClientProps {
  tabSegment: string;
}

export function DevAdminPageClient({ tabSegment }: DevAdminPageClientProps) {
  return (
    <PanelDashboardShell
      mode="dev"
      basePath="/devadmin"
      tabSegment={tabSegment}
      loginEndpoint="/api/dev-admin/login"
      statsEndpoint="/api/dev-admin/stats"
      tokenKey="dev_admin_token"
      panelLabel="DEVELOPER CONSOLE"
      accentColor="violet"
      defaultUsername="devadmin"
    />
  );
}

export default DevAdminPageClient;
