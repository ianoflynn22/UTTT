import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 font-mono text-xs text-muted-foreground">Last updated {updated}</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
