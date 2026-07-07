import { AdminPageClient } from "./AdminPageClient";

// Next.js App Router server components receive dynamic params as props
interface PageProps {
  params: Promise<{ tab?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const tabSegment = resolvedParams.tab && Array.isArray(resolvedParams.tab) ? resolvedParams.tab[0] : "";
  return <AdminPageClient tabSegment={tabSegment} />;
}

// Generate static routes for the next export output
export function generateStaticParams() {
  return [
    { tab: [] },
    { tab: ["overview"] },
    { tab: ["settings"] },
    { tab: ["api"] },
    { tab: ["credentials"] },
    { tab: ["explorer"] },
    { tab: ["logs"] }
  ];
}
