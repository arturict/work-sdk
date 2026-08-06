"use client";

import { useEffect } from "react";

type UmamiData = Record<string, string | number | boolean>;
type LandingEvent = "landing-cta" | "landing-section-view" | "landing-scroll-depth" | "landing-engaged-time";

declare global {
  interface Window {
    umami?: { track: (event?: string, data?: UmamiData) => void };
    workSdkTrack?: (event: string, data?: UmamiData) => void;
  }
}

const token = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,49}$/.test(value) ? value : undefined;

const eventData = (name: LandingEvent, data: UmamiData): UmamiData | undefined => {
  if (name === "landing-cta") {
    const action = token(data.action);
    const location = token(data.location);
    const target = token(data.target);
    return action && location && target ? { action, location, target } : undefined;
  }
  if (name === "landing-section-view") {
    const section = token(data.section);
    return section ? { section } : undefined;
  }
  if (name === "landing-scroll-depth") {
    return [25, 50, 75, 100].includes(Number(data.depth)) ? { depth: Number(data.depth) } : undefined;
  }
  return [30, 60, 120].includes(Number(data.seconds)) ? { seconds: Number(data.seconds) } : undefined;
};

export function LandingAnalytics() {
  useEffect(() => {
    const track = (name: string, data: UmamiData = {}) => {
      if (!["landing-cta", "landing-section-view", "landing-scroll-depth", "landing-engaged-time"].includes(name)) return;
      const bounded = eventData(name as LandingEvent, data);
      if (bounded) window.umami?.track(name, bounded);
    };
    const seenSections = new Set<string>();
    const seenDepths = new Set<number>();
    window.workSdkTrack = track;

    let pageviewTimer: number | undefined;
    let pageviewAttempts = 0;
    const trackLandingPageview = () => {
      if (window.umami) {
        window.umami.track();
      } else if (pageviewAttempts < 20) {
        pageviewAttempts += 1;
        pageviewTimer = window.setTimeout(trackLandingPageview, 250);
      }
    };
    trackLandingPageview();

    const onClick = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-analytics-event="landing-cta"]');
      if (!element) return;
      track("landing-cta", {
        action: element.dataset.analyticsAction ?? "",
        location: element.dataset.analyticsLocation ?? "",
        target: element.dataset.analyticsTarget ?? "",
      });
    };

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const section = entry.target as HTMLElement;
      if (!entry.isIntersecting || seenSections.has(section.id)) return;
      seenSections.add(section.id);
      track("landing-section-view", { section: section.id });
    }), { threshold: 0.25 });
    document.querySelectorAll<HTMLElement>("main#main-content > section[id]").forEach((section) => observer.observe(section));

    const onScroll = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const percent = available > 0 ? Math.round((window.scrollY / available) * 100) : 100;
      [25, 50, 75, 100].forEach((depth) => {
        if (percent >= depth && !seenDepths.has(depth)) {
          seenDepths.add(depth);
          track("landing-scroll-depth", { depth });
        }
      });
    };

    const timers = [30, 60, 120].map((seconds) => window.setTimeout(() => {
      if (document.visibilityState === "visible") track("landing-engaged-time", { seconds });
    }, seconds * 1000));

    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (pageviewTimer) window.clearTimeout(pageviewTimer);
      timers.forEach(window.clearTimeout);
      delete window.workSdkTrack;
    };
  }, []);

  return null;
}
