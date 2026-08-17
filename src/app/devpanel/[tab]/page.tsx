import { DevPanelPageClient } from "./DevPanelPageClient";

export default function Page({ params }: { params: { tab: string } }) {
  return <DevPanelPageClient tabSegment={params.tab} />;
}
