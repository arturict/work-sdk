import type { Metadata } from "next";

import { createPageMetadata } from "@/lib/site";

export const metadata: Metadata = createPageMetadata({
  title: "Analytics & privacy",
  description: "What the public Work SDK website measures and what it deliberately leaves out.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="shell legal-page" id="main-content">
      <article className="docs-content">
        <p className="breadcrumb">Work SDK / Privacy</p>
        <h1>Analytics & privacy</h1>
        <p className="docs-lead">We measure whether this public website helps people discover, evaluate, and use Work SDK. We do not use analytics inside the SDK or send your tracker data anywhere.</p>

        <section id="measured">
          <h2>What is measured</h2>
          <p>The landing page uses self-hosted Umami for aggregate page views, referring domains, standard UTM campaign parameters, and bounded events such as opening documentation, viewing a section, copying the public example, or following a GitHub or npm link. The public website also uses Vercel Web Analytics for aggregate page views.</p>
        </section>

        <section id="excluded">
          <h2>What is excluded</h2>
          <p>We do not assign custom visitor IDs or persist campaign attribution in cookies or browser storage. Non-UTM query parameters, URL fragments, and referrer paths are removed before Umami receives an event. Custom events use fixed labels and bounded targets; they never include search text, copied code, issue content, credentials, form values, or provider data.</p>
        </section>

        <section id="scope">
          <h2>Website-only scope</h2>
          <p>Work SDK is an open-source library, not a hosted work-tracker service. Installing or running the package does not activate these website analytics. The application using Work SDK communicates directly with the tracker providers it configures.</p>
        </section>

        <section id="controls">
          <h2>Your controls</h2>
          <p>The Umami tracker respects the browser Do Not Track setting, and our send guard rejects Umami events when Global Privacy Control is enabled. Content blockers may also prevent either analytics script from loading without affecting the website or package.</p>
        </section>
      </article>
    </main>
  );
}
