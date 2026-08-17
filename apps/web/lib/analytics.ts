export const umamiWebsiteId = "89eaaa6e-13c0-4ed9-8f1f-8889a821cc7c";

// Umami needs the UTM query string to power its campaign reports. This hook keeps
// only the five standard UTM fields and reduces external referrers to their origin
// before any page view or event leaves the browser.
export const analyticsPrivacyGuard = String.raw`(() => {
  const campaignKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const safeCampaignValue = (value) => /^[a-z0-9][a-z0-9._~-]{0,63}$/i.test(value) ? value : "";

  const sanitizedUrl = (value) => {
    if (typeof value !== "string") return value;
    try {
      const url = new URL(value, window.location.origin);
      const search = new URLSearchParams();
      campaignKeys.forEach((key) => {
        const campaignValue = safeCampaignValue(url.searchParams.get(key) || "");
        if (campaignValue) search.set(key, campaignValue);
      });
      url.search = search.toString();
      url.hash = "";
      return url.toString();
    } catch {
      return window.location.origin + "/";
    }
  };

  const referrerOrigin = (value) => {
    if (typeof value !== "string" || !value) return "";
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin ? "" : url.origin;
    } catch {
      return "";
    }
  };

  window.workSdkAnalyticsBeforeSend = (_type, payload) => {
    if (window.navigator?.globalPrivacyControl === true) return false;
    if (!payload || typeof payload !== "object") return false;
    return {
      ...payload,
      url: sanitizedUrl(payload.url),
      referrer: referrerOrigin(payload.referrer),
    };
  };
})();`;
