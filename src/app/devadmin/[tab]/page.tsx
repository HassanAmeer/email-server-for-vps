import { redirect } from "next/navigation";
import DevAdminRedirectClient from "./DevAdminRedirectClient";

interface PageProps {
  params: Promise<{ tab: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  if (resolvedParams.tab === "credentials") {
    redirect("/devpanel/smtp");
  }
  return <DevAdminRedirectClient tab={resolvedParams.tab} />;
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
    { tab: "apisetting" },
    { tab: "apisettings" },
    { tab: "api-setting" },
    { tab: "api-settings" },
    { tab: "settings" },
    { tab: "api" },
    { tab: "seeding" },
    { tab: "data-seeding" },
    { tab: "credentials" },
    { tab: "smtp" },
    { tab: "menu-set" },
    { tab: "menu-settings" },
  ];
}
