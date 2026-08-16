import { AdminPageClient } from "./AdminPageClient";

// Next.js App Router server components receive dynamic params as props
interface PageProps {
  params: Promise<{ tab: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <AdminPageClient tabSegment={resolvedParams.tab} />;
}

// Generate static routes for the next export output
export function generateStaticParams() {
  return [
    { tab: "overview" },
    { tab: "settings" },
    { tab: "api" },
    { tab: "credentials" },
    { tab: "explorer" },
    { tab: "logs" },
    { tab: "projects" },
    { tab: "mailbox" },
    { tab: "domains" },
    { tab: "primary-domain" },
    { tab: "primary-domains" },
    { tab: "setup" },
    { tab: "seeding" },
    { tab: "data-seeding" }
  ];
}
