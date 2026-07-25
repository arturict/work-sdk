"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { docsSearchLinks } from "@/lib/docs";

interface DocsSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocsSearchDialog({ open, onOpenChange }: DocsSearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? docsSearchLinks.filter((page) => `${page.group} ${page.name}`.toLowerCase().includes(needle))
      : docsSearchLinks;
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  if (!open) return null;

  return createPortal(
        <div className="docs-search-backdrop" onMouseDown={() => onOpenChange(false)} role="presentation">
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
              <button aria-label="Close search" onClick={() => onOpenChange(false)} type="button">Esc</button>
            </div>
            <div className="docs-search-results">
              {results.length ? results.map((page) => (
                <Link href={page.url} key={page.url} onClick={() => onOpenChange(false)}>
                  <span>{page.name}</span>
                  <small>{page.group}</small>
                </Link>
              )) : <p>No documentation page found.</p>}
            </div>
          </div>
        </div>,
        document.body,
  );
}
