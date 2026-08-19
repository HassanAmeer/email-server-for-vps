"use client";

import DomainsManager from "./DomainsManager";

interface SetupManagerProps {
  apiUrl: string;
}

export default function SetupManager({ apiUrl }: SetupManagerProps) {
  return <DomainsManager apiUrl={apiUrl} />;
}
