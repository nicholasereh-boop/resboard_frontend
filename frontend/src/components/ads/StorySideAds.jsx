import { useEffect, useState } from "react";
import AdSlot from "./AdSlot";
import { AD_SLOTS } from "./adConfig";

const WIDE = "(min-width: 1100px)";

// ADSENSE: two ad cards on the right-hand side of the story page (desktop only). They stay in view while the story is read
// (CSS: position: sticky) and scroll away when the comments end. Nothing but the ads is inside the cards.
// On narrow screens nothing is rendered at all, so no ad request is wasted.
export default function StorySideAds() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(WIDE).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  if (!wide || (!AD_SLOTS.storySideTop && !AD_SLOTS.storySideBottom)) return null;
  const cardStyle = { margin: 0, minHeight: 250 };
  return (
    <aside className="sp-side-ads" aria-label="Advertisements">
      {AD_SLOTS.storySideTop && <div className="sp-ad-card"><AdSlot slot={AD_SLOTS.storySideTop} format="rectangle" style={cardStyle} /></div>}
      {AD_SLOTS.storySideBottom && <div className="sp-ad-card"><AdSlot slot={AD_SLOTS.storySideBottom} format="rectangle" style={cardStyle} /></div>}
    </aside>
  );
}