import { trpc } from "@/lib/trpc";
import { ExternalLink } from "lucide-react";

export default function TabBanner({ tabKey }: { tabKey: string }) {
  const { data: banner } = trpc.tabBanner.getByTab.useQuery({ tabKey });

  if (!banner || !banner.isActive || !banner.text) return null;

  const inner = (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{banner.text}</p>
        {banner.subText && <p className="text-xs text-white/80 mt-0.5 truncate">{banner.subText}</p>}
      </div>
      {banner.link && <ExternalLink className="h-4 w-4 text-white/80 shrink-0" />}
    </div>
  );

  if (banner.link) {
    return (
      <a href={banner.link} target="_blank" rel="noreferrer"
        className="block rounded-xl px-4 py-3 mb-4 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ backgroundColor: banner.bgColor }}>
        {inner}
      </a>
    );
  }

  return (
    <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: banner.bgColor }}>
      {inner}
    </div>
  );
}
