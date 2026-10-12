"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@/components/Tabs";

/** Round-15 job detail page: `Tabs` itself is a plain controlled
 *  presentational component (active/onChange as props) — this is the
 *  thin client wrapper that actually owns the `activeTab` state, since
 *  the page itself is a Server Component and can't hold state directly. */
export function JobTabsSection({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <Tabs tabs={tabs.map(({ key, label }) => ({ key, label }))} active={active} onChange={setActive} />
      <div className="mt-6">{activeTab?.content}</div>
    </div>
  );
}
