"use client";

/** Round-15: a third place (the job detail page) needed a tab strip after
 *  `CandidateProfileForm` and `SalaryCalculatorForm` had each already
 *  built their own inline copy of the identical underline-tab recipe —
 *  extracted once here, per the standing sitewide-consistency rule,
 *  rather than letting a third independent copy start drifting too. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={
            active === tab.key
              ? "shrink-0 border-b-2 border-pine px-4 py-2 text-sm font-medium whitespace-nowrap text-pine"
              : "shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-ink"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
