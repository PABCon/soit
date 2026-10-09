"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/Switch";
import { setSavedSearchNotifyOptInAction } from "@/app/[locale]/(candidate)/saved-searches/actions";

export function SavedSearchNotifyToggle({ id, initialOptIn }: { id: string; initialOptIn: boolean }) {
  const t = useTranslations("savedSearches");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={optIn}
      label={t("notifyMe")}
      onChange={(next) => {
        setOptIn(next);
        startTransition(() => setSavedSearchNotifyOptInAction(id, next));
      }}
    />
  );
}
