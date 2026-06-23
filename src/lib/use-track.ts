import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// Pages we don't count as "visits" (owner/admin tooling, not public board views).
const SKIP = ["/settings", "/admin", "/insights"];

/**
 * Fire a privacy-first page-view beacon to /api/track once per path. No cookies;
 * the server hashes the visitor. Skips admin/settings pages and honors DNT.
 */
export function useTrackView(slug: string | undefined): void {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!slug || typeof window === "undefined") return;
    if (SKIP.some((s) => pathname.includes(s))) return;
    // Respect Do-Not-Track at the source too.
    const nav = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return;

    const payload = JSON.stringify({
      slug,
      path: pathname,
      ref: document.referrer || null,
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [slug, pathname]);
}
