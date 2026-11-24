import { useEffect, useRef } from "react";
import { AD_CLIENT } from "./adConfig";

// One Google AdSense display ad. The adsbygoogle.js script is loaded once in index.html.
// Renders nothing until a real slot id (digits) is given, so empty boxes never show.
// ADSENSE: reusable ad component, used on the home, stories, story detail and category pages
export default function AdSlot({ slot, format = "auto", className = "" }) {
  const pushed = useRef(false);
  const valid = /^\d+$/.test(String(slot || ""));

  useEffect(() => {
    if (!valid || pushed.current) return;
    pushed.current = true; // each ad unit asks for an ad only once (also under React StrictMode)
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* script blocked by an ad blocker or not loaded yet: show nothing */
    }
  }, [valid]);

  if (!valid) return null;
  return (
    <aside className={`ad-slot ${className}`.trim()} aria-label="Advertisement" style={{ margin: "1.5rem 0", minHeight: 90, textAlign: "center" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}