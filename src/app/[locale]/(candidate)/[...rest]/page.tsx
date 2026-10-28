import { notFound } from "next/navigation";

/** Catch-all for any URL that doesn't match a real page anywhere in the
 *  app (route groups like `(candidate)` are invisible to Next's router, so
 *  a fully unmatched path — e.g. a dead/mistyped link — never reaches a
 *  nested `not-found.tsx` on its own; Next only renders one when
 *  `notFound()` is actually called, or a dynamic segment's own page does).
 *  This page exists purely to call `notFound()` so every otherwise-unmatched
 *  route bubbles up to `(candidate)/not-found.tsx` — and, by living inside
 *  `(candidate)`, picks up that group's real site shell automatically, same
 *  as every other page here. More specific routes in every route group
 *  always win over this catch-all; it only ever fires once nothing else
 *  matched. */
export default function CatchAllNotFound() {
  notFound();
}
