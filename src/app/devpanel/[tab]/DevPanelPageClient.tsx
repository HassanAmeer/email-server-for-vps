"use client";

import { PanelDashboardShell } from "@/components/panel/PanelDashboardShell";

interface DevPanelPageClientProps {
  tabSegment: string;
}

export function DevPanelPageClient({ tabSegment }: DevPanelPageClientProps) {
  return (
    <PanelDashboardShell
      mode="dev"
      basePath="/devpanel"
      tabSegment={tabSegment}
      loginEndpoint="/api/devpanel/login"
      statsEndpoint="/api/devpanel/stats"
      tokenKey="devpanel_token"
      panelLabel="DEVELOPER CONSOLE"
      accentColor="violet"
      defaultUsername="dev"
    />
  );
}

export default DevPanelPageClient;
