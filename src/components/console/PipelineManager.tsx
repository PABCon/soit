"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { addStageAction, renameStageAction, deleteStageAction, reorderStagesAction } from "@/app/[locale]/(console)/recruit/pipeline/actions";
import { Button } from "@/components/Button";
import type { ApplicationStage, CandidateBucket } from "@/lib/db/application-stages";

const BUCKETS: CandidateBucket[] = ["submitted", "in_review", "not_selected", "hired"];

/** Lets a company define its own hiring-pipeline stage names and reorder
 *  them, per the real-usage request ("it should be possible for the
 *  companies to define their status ... so that when they manage the
 *  candidates they can use their flow"). Every stage still must map to a
 *  fixed `candidateBucket`, which is what keeps the candidate-facing
 *  status (`applications.bucket`) always simple and never stale, no
 *  matter how a company renames or reorders its own internal stages, and
 *  it's entirely separate from `applications.viewed_at` (the read-receipt
 *  promise to candidates), which this page never touches at all. */
export function PipelineManager({ stages: initialStages }: { stages: ApplicationStage[] }) {
  const t = useTranslations("console");
  const [stages, setStages] = useState(initialStages);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newBucket, setNewBucket] = useState<CandidateBucket>("in_review");
  const [pending, setPending] = useState(false);

  function errorMessage(reason: string): string {
    return t(`pipelineError.${reason}`);
  }

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    setPending(true);
    try {
      const result = await addStageAction(label, newBucket);
      if (!result.ok) {
        setError(errorMessage(result.reason));
        return;
      }
      setStages((prev) => [...prev, result.stage]);
      setNewLabel("");
    } finally {
      setPending(false);
    }
  }

  async function handleRename(stage: ApplicationStage, label: string, candidateBucket: CandidateBucket) {
    setError(null);
    const result = await renameStageAction(stage.id, label, candidateBucket);
    if (!result.ok) {
      setError(errorMessage(result.reason));
      return;
    }
    setStages((prev) => prev.map((s) => (s.id === stage.id ? { ...s, label, candidateBucket } : s)));
  }

  async function handleDelete(stageId: string) {
    setError(null);
    const result = await deleteStageAction(stageId);
    if (!result.ok) {
      setError(errorMessage(result.reason));
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== stageId));
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const reordered = [...stages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setStages(reordered);
    setError(null);
    const result = await reorderStagesAction(reordered.map((s) => s.id));
    if (!result.ok) setError(errorMessage(result.reason));
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">{t("pipelineStages")}</h2>
        <ul className="mt-5 divide-y divide-line">
          {stages.map((stage, index) => (
            <li key={stage.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label={t("pipelineMoveUp")}
                  className="rounded text-muted hover:text-pine disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === stages.length - 1}
                  aria-label={t("pipelineMoveDown")}
                  className="rounded text-muted hover:text-pine disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <input
                defaultValue={stage.label}
                onBlur={(e) => {
                  const label = e.target.value.trim();
                  if (label && label !== stage.label) handleRename(stage, label, stage.candidateBucket);
                }}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              />

              <select
                value={stage.candidateBucket}
                onChange={(e) => handleRename(stage, stage.label, e.target.value as CandidateBucket)}
                className="h-9 shrink-0 rounded-lg border border-line bg-white px-2 text-sm text-ink"
              >
                {BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {t(`pipelineBucket.${b}`)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleDelete(stage.id)}
                aria-label={t("pipelineDelete")}
                className="shrink-0 rounded text-muted hover:text-error"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">{t("pipelineAddStage")}</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={t("pipelineAddStagePlaceholder")}
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink"
          />
          <select
            value={newBucket}
            onChange={(e) => setNewBucket(e.target.value as CandidateBucket)}
            className="h-11 shrink-0 rounded-lg border border-line bg-white px-2 text-sm text-ink"
          >
            {BUCKETS.map((b) => (
              <option key={b} value={b}>
                {t(`pipelineBucket.${b}`)}
              </option>
            ))}
          </select>
          <Button onClick={handleAdd} disabled={pending || !newLabel.trim()} className="shrink-0">
            {t("pipelineAddStage")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{t("pipelineBucketHint")}</p>
      </div>
    </div>
  );
}
