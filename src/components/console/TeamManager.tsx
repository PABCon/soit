"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  createInviteAction,
  removeMemberAction,
  updateMemberRoleAction,
  deleteInviteAction,
  resendInviteAction,
} from "@/app/[locale]/(console)/recruit/team/actions";
import type { TeamMember, PendingInvite } from "@/lib/db/team";

/** Days until `expiresAt`, floored — used for the "expires in N days"
 *  readout. Negative/zero means already expired. */
function daysUntil(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 864e5);
}

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
  // Resend regenerates the link for one specific pending invite — keyed by
  // invite id so more than one row's "here's your new link" state can't
  // collide, unlike the single `lastLink` slot the create-invite flow uses.
  const [resentLinks, setResentLinks] = useState<Record<string, string>>({});
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

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

  async function handleRoleChange(memberId: string, newRole: "owner" | "member") {
    setError(null);
    try {
      await updateMemberRoleAction(memberId, newRole);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    }
  }

  async function handleRevoke(inviteId: string) {
    setError(null);
    try {
      await deleteInviteAction(inviteId);
      setResentLinks((prev) => {
        const next = { ...prev };
        delete next[inviteId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    }
  }

  async function handleResend(inviteId: string) {
    setError(null);
    try {
      const token = await resendInviteAction(inviteId);
      setResentLinks((prev) => ({
        ...prev,
        [inviteId]: `${window.location.origin}/employer/accept-invite/${token}`,
      }));
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

  function copyResentLink(inviteId: string, link: string) {
    navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId((current) => (current === inviteId ? null : current)), 2000);
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section>
        <h2 className="font-display text-sm font-semibold text-muted">{t("teamMembers")}</h2>
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                  <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-xs font-bold text-white">
                    {(m.fullName || m.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm text-ink">{m.fullName || m.email}</p>
                  {isOwner && m.id !== myEmployerId ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as "owner" | "member")}
                      className="mt-0.5 h-6 rounded border border-line bg-white px-1 text-xs text-muted"
                    >
                      <option value="member">{t("roleLabel.member")}</option>
                      <option value="owner">{t("roleLabel.owner")}</option>
                    </select>
                  ) : (
                    <p className="text-xs text-muted">{t(`roleLabel.${m.role}`)}</p>
                  )}
                </div>
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
              {invites.map((i) => {
                const days = daysUntil(i.expiresAt);
                const resentLink = resentLinks[i.id];
                return (
                  <li key={i.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-ink">{i.email}</span>
                        <span className="ml-2 text-xs text-muted">{t(`roleLabel.${i.role}`)}</span>
                        <p className="text-xs text-muted">
                          {days <= 0 ? t("inviteExpired") : t("inviteExpiresIn", { days })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleResend(i.id)}
                          className="text-xs font-medium text-pine hover:underline"
                        >
                          {t("resendInvite")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(i.id)}
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          {t("revokeInvite")}
                        </button>
                      </div>
                    </div>
                    {resentLink && (
                      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs">
                        <span className="truncate text-muted">{resentLink}</span>
                        <button
                          type="button"
                          onClick={() => copyResentLink(i.id, resentLink)}
                          className="shrink-0 font-medium text-pine hover:underline"
                        >
                          {copiedInviteId === i.id ? t("copied") : t("copyLink")}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
