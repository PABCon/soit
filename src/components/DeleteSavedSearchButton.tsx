"use client";

import { useTransition } from "react";
import { deleteSavedSearchAction } from "@/app/[locale]/(candidate)/saved-searches/actions";

export function DeleteSavedSearchButton({ id, label }: { id: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => deleteSavedSearchAction(id))}
      className="shrink-0 text-xs font-medium text-muted hover:text-red-700 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
