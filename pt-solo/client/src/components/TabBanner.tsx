import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ExternalLink } from "lucide-react";

const HEIGHT_MAP: Record<string, string> = {
  small: "56px",
  medium: "96px",
  large: "140px",
};

function isInternalLink(link: string): boolean {
  if (link.startsWith("/")) return true;
  try {
    return new URL(link).origin === window.location.origin;
  } catch {
    return false;
  }
}

function internalPath(link: string): string {
  if (link.startsWith("/")) return link;
  try {
    const u = new URL(link);
    return u.pathname + u.search + u.hash;
  } catch {
    return link;
  }
}

export default function TabBanner({ tabKey }: { tabKey: string }) {
  const { data: banner } = trpc.tabBanner.getByTab.useQuery({ tabKey });
  const [, setLocation] = useLocation();

  if (!banner || !banner.isActive) return null;
  if (!banner.text && !banner.imageUrl) return null;

  const heightStyle = HEIGHT_MAP[banner.bannerHeight ?? "medium"] ?? banner.bannerHeight;

  const inner = banner.imageUrl ? (
    <img
      src={banner.imageUrl}
      alt="배너"
      className="w-full h-auto"
      style={{ display: "block", objectFit: "contain" }}
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
      {banner.link && !isInternalLink(banner.link) && <ExternalLink className="h-4 w-4 text-white/80 shrink-0" />}
    </div>
  );

  const cls = "block rounded-xl overflow-hidden mb-4 cursor-pointer hover:opacity-90 transition-opacity";
  const clsStatic = "rounded-xl overflow-hidden mb-4";

  if (banner.link) {
    if (isInternalLink(banner.link)) {
      return (
        <div className={cls} onClick={() => setLocation(internalPath(banner.link!))}>
          {inner}
        </div>
      );
    }
    return (
      <a href={banner.link} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }

  return <div className={clsStatic}>{inner}</div>;
}
