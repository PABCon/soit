/** A stable, non-identifying display id for a blinded match — "Candidate
 *  #XXXX," the way the reference design shows it. No existing stable
 *  per-match identifier existed in this codebase before this round
 *  (messaging/match cards only ever used one generic "Candidate" label,
 *  fine for a single thread but ambiguous across a list of several) —
 *  this derives a deterministic 4-digit number straight from the
 *  candidate's own UUID (never stored anywhere; the same id always
 *  produces the same number) so multiple blinded cards on screen can be
 *  told apart without exposing anything real about who they are. */
export function candidateDisplayNumber(candidateId: string): string {
  let hash = 0;
  for (let i = 0; i < candidateId.length; i++) {
    hash = (hash * 31 + candidateId.charCodeAt(i)) >>> 0;
  }
  return String(1000 + (hash % 9000));
}
