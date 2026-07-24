"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { docsNavigation } from "@/components/docs-navigation";

const pages = docsNavigation.flatMap((group) =>
  group.links.map(([label, href]) => ({ label, href, group: group.label })),
);

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? pages.filter((page) => `${page.group} ${page.label}`.toLowerCase().includes(needle))
      : pages;
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  return (
    <>
      <button className="docs-search-trigger" onClick={() => setOpen(true)} type="button">
        <span aria-hidden="true">⌕</span>
        <span>Search docs</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open ? createPortal(
        <div className="docs-search-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
          <div aria-label="Search documentation" aria-modal="true" className="docs-search-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="docs-search-field">
              <label className="sr-only" htmlFor="docs-search">Search documentation</label>
              <input
                id="docs-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guides, providers, and API reference…"
                ref={inputRef}
                type="search"
                value={query}
              />
              <button aria-label="Close search" onClick={() => setOpen(false)} type="button">Esc</button>
            </div>
            <div className="docs-search-results">
              {results.length ? results.map((page) => (
                <Link href={page.href} key={page.href} onClick={() => setOpen(false)}>
                  <span>{page.label}</span>
                  <small>{page.group}</small>
                </Link>
              )) : <p>No documentation page found.</p>}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
