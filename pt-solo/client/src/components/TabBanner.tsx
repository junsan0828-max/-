import { trpc } from "@/lib/trpc";
import { ExternalLink } from "lucide-react";

const HEIGHT_MAP: Record<string, string> = {
  small: "56px",
  medium: "96px",
  large: "140px",
};

export default function TabBanner({ tabKey }: { tabKey: string }) {
  const { data: banner } = trpc.tabBanner.getByTab.useQuery({ tabKey });

  if (!banner || !banner.isActive) return null;
  if (!banner.text && !banner.imageUrl) return null;

  const heightStyle = HEIGHT_MAP[banner.bannerHeight ?? "medium"] ?? banner.bannerHeight;

  const inner = banner.imageUrl ? (
    <img
      src={banner.imageUrl}
      alt="배너"
      className="w-full h-full object-cover"
      style={{ height: heightStyle }}
    />
  ) : (
    <div
      className={`flex items-center gap-3 px-4 ${
        (banner as any).textAlign === "center" ? "justify-center text-center" :
        (banner as any).textAlign === "right"  ? "justify-end text-right" : "justify-start text-left"
      }`}
      style={{ backgroundColor: banner.bgColor, height: heightStyle }}
    >
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-white leading-tight line-clamp-2 ${
          (banner as any).textSize === "large" ? "text-lg" :
          (banner as any).textSize === "small" ? "text-xs" : "text-sm"
        }`}>{banner.text}</p>
        {banner.subText && <p className="text-xs text-white/80 mt-0.5 line-clamp-2">{banner.subText}</p>}
      </div>
      {banner.link && <ExternalLink className="h-4 w-4 text-white/80 shrink-0" />}
    </div>
  );

  const cls = "block rounded-xl overflow-hidden mb-4 cursor-pointer hover:opacity-90 transition-opacity";
  const clsStatic = "rounded-xl overflow-hidden mb-4";

  if (banner.link) {
    return (
      <a href={banner.link} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }

  return <div className={clsStatic}>{inner}</div>;
}
