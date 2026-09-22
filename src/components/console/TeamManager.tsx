"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createInviteAction, removeMemberAction } from "@/app/[locale]/(console)/recruit/team/actions";
import type { TeamMember, PendingInvite } from "@/lib/db/team";

export function TeamManager({
  members,
  invites,
  isOwner,
  myEmployerId,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  isOwner: boolean;
  myEmployerId: string;
}) {
  const t = useTranslations("console");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleInvite() {
    setError(null);
    setPending(true);
    try {
      const token = await createInviteAction(email.trim(), role);
      setLastLink(`${window.location.origin}/employer/accept-invite/${token}`);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(memberId: string) {
    setError(null);
    try {
      await removeMemberAction(memberId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    }
  }

  function copyLink() {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section>
        <h2 className="font-display text-sm font-semibold text-muted">{t("teamMembers")}</h2>
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-ink">{m.email}</p>
                <p className="text-xs text-muted">{t(`roleLabel.${m.role}`)}</p>
              </div>
              {isOwner && m.id !== myEmployerId && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  {t("removeMember")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section>
          <h2 className="font-display text-sm font-semibold text-muted">{t("inviteColleague")}</h2>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t("email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-lg border border-line bg-white px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "owner" | "member")}
                className="h-9 rounded-lg border border-line bg-white px-3 text-sm"
              >
                <option value="member">{t("roleLabel.member")}</option>
                <option value="owner">{t("roleLabel.owner")}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!email.trim() || pending}
              onClick={handleInvite}
              className="h-9 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
            >
              {t("createInvite")}
            </button>
          </div>

          {lastLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs">
              <span className="truncate text-muted">{lastLink}</span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 font-medium text-pine hover:underline"
              >
                {copied ? t("copied") : t("copyLink")}
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-muted">
                  <span>{i.email}</span>
                  <span className="text-xs">{t(`roleLabel.${i.role}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
