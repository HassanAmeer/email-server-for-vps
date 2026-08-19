import { redirect } from "next/navigation";
import { AdminPageClient } from "./AdminPageClient";

// Next.js App Router server components receive dynamic params as props
interface PageProps {
  params: Promise<{ tab: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  if (resolvedParams.tab === "seeding" || resolvedParams.tab === "data-seeding" || resolvedParams.tab === "seeding-data") {
    redirect("/admin/overview");
  }
  return <AdminPageClient tabSegment={resolvedParams.tab} />;
}

// Generate static routes for the next export output
export function generateStaticParams() {
  return [
    { tab: "overview" },
    { tab: "apisetting" },
    { tab: "apisettings" },
    { tab: "api-setting" },
    { tab: "api-settings" },
    { tab: "settings" },
    { tab: "api" },
    { tab: "logs" },
    { tab: "projects" },
    { tab: "mailbox" },
    { tab: "domains" },
    { tab: "primary-domain" },
    { tab: "primary-domains" },
    { tab: "setup" },
    { tab: "credentials" },
    { tab: "smtp" },
    { tab: "explorer" },
    { tab: "mails" }
  ];
}
