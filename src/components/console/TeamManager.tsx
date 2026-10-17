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
import { Badge } from "@/components/Badge";
import { Button, buttonClassName } from "@/components/Button";
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
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">{t("teamMembers")}</h2>
        <ul className="mt-5 divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                  <img src={m.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine text-sm font-bold text-white">
                    {(m.fullName || m.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{m.fullName || m.email}</p>
                  {m.fullName && <p className="truncate text-sm text-muted">{m.email}</p>}
                </div>
              </div>

              {isOwner && m.id !== myEmployerId ? (
                <div className="flex shrink-0 items-center gap-3">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as "owner" | "member")}
                    className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
                  >
                    <option value="member">{t("roleLabel.member")}</option>
                    <option value="owner">{t("roleLabel.owner")}</option>
                  </select>
                  <Button variant="danger" size="md" className="h-9 px-3 text-xs" onClick={() => handleRemove(m.id)}>
                    {t("removeMember")}
                  </Button>
                </div>
              ) : (
                <Badge variant={m.role === "owner" ? "info" : "neutral"} className="shrink-0">
                  {t(`roleLabel.${m.role}`)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isOwner && (
        <div className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">{t("inviteColleague")}</h2>
          <p className="mt-1 text-sm text-muted">{t("inviteColleagueSubtitle")}</p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">{t("email")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "owner" | "member")}
                className="h-11 rounded-lg border border-line bg-white px-3 text-sm"
              >
                <option value="member">{t("roleLabel.member")}</option>
                <option value="owner">{t("roleLabel.owner")}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!email.trim() || pending}
              onClick={handleInvite}
              className={buttonClassName({ size: "md" })}
            >
              {t("createInvite")}
            </button>
          </div>

          {lastLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs">
              <span className="truncate text-muted">{lastLink}</span>
              <button type="button" onClick={copyLink} className="shrink-0 font-medium text-pine hover:underline">
                {copied ? t("copied") : t("copyLink")}
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {invites.map((i) => {
                const days = daysUntil(i.expiresAt);
                const resentLink = resentLinks[i.id];
                return (
                  <li key={i.id} className="flex flex-col gap-2 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{i.email}</span>
                          <Badge variant="neutral">{t(`roleLabel.${i.role}`)}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted">
                          {days <= 0 ? t("inviteExpired") : t("inviteExpiresIn", { days })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <button
                          type="button"
                          onClick={() => handleResend(i.id)}
                          className="text-sm font-medium text-pine hover:underline"
                        >
                          {t("resendInvite")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(i.id)}
                          className="text-sm font-medium text-error hover:underline"
                        >
                          {t("revokeInvite")}
                        </button>
                      </div>
                    </div>
                    {resentLink && (
                      <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs">
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
        </div>
      )}
    </div>
  );
}
