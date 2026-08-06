"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect } from "react";

type UmamiData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: UmamiData) => void };
  }
}

const clean = (value: string | null | undefined, fallback: string) =>
  value?.trim().replace(/\s+/g, " ").slice(0, 100) || fallback;

const interactionDestination = (element: HTMLElement) => {
  const href = element.getAttribute("href");
  if (!href) return element.id || element.getAttribute("type") || "button";
  if (href.startsWith("#")) return href;
  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin ? url.pathname : url.hostname;
};

export function SiteAnalytics() {
  useEffect(() => {
    const track = (name: string, data: UmamiData) => window.umami?.track(name, data);
    const seenSections = new Set<string>();
    const seenDepths = new Set<number>();

    const onClick = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>("a, button, summary");
      if (!element || element.dataset.analyticsIgnore === "true") return;
      const section = element.closest<HTMLElement>("section[id]")?.id;
      track("interaction", {
        action: clean(element.dataset.analyticsAction, clean(element.getAttribute("aria-label"), clean(element.textContent, "unlabelled"))),
        element: element.tagName.toLowerCase(),
        location: clean(element.dataset.analyticsLocation, element.closest("header") ? "header" : element.closest("footer") ? "footer" : section || "page"),
        destination: clean(element.dataset.analyticsDestination, interactionDestination(element)),
        path: window.location.pathname,
      });
    };

    const onToggle = (event: Event) => {
      const details = event.target as HTMLDetailsElement;
      if (!(details instanceof HTMLDetailsElement)) return;
      track("faq-toggle", {
        item: clean(details.querySelector("summary")?.textContent, "unlabelled"),
        expanded: details.open,
        path: window.location.pathname,
      });
    };

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const section = entry.target as HTMLElement;
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || seenSections.has(section.id)) return;
      seenSections.add(section.id);
      track("section-view", { section: section.id, path: window.location.pathname });
    }), { threshold: 0.5 });
    document.querySelectorAll<HTMLElement>("section[id]").forEach((section) => observer.observe(section));

    const onScroll = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const percent = available > 0 ? Math.round((window.scrollY / available) * 100) : 100;
      [25, 50, 75, 90, 100].forEach((depth) => {
        if (percent >= depth && !seenDepths.has(depth)) {
          seenDepths.add(depth);
          track("scroll-depth", { percent: depth, path: window.location.pathname });
        }
      });
    };

    const timers = [30, 60, 120].map((seconds) => window.setTimeout(() => {
      if (document.visibilityState === "visible") track("engagement", { seconds, path: window.location.pathname });
    }, seconds * 1000));

    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.search = "";
        url.hash = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
