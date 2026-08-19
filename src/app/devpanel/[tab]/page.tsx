import { DevPanelPageClient } from "./DevPanelPageClient";

interface PageProps {
  params: Promise<{ tab: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <DevPanelPageClient tabSegment={resolvedParams.tab} />;
}

export function generateStaticParams() {
  return [
    { tab: "overview" },
    { tab: "logs" },
    { tab: "domains" },
    { tab: "primary-domain" },
    { tab: "primary-domains" },
    { tab: "mailbox" },
    { tab: "mailboxes" },
    { tab: "users-mailbox" },
    { tab: "user-mailbox" },
    { tab: "webmail" },
    { tab: "projects" },
    { tab: "settings" },
    { tab: "api" },
    { tab: "seeding" },
    { tab: "data-seeding" },
    { tab: "credentials" },
    { tab: "smtp" },
    { tab: "explorer" },
    { tab: "mails" },
  ];
}
