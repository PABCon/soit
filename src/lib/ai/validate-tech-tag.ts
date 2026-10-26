import { generateText, Output } from "ai";
import { z } from "zod";

// Same model as the rest of this project's LLM-extraction pipeline.
// Always re-check https://ai-gateway.vercel.sh/v1/models before bumping.
const MODEL = "anthropic/claude-sonnet-5.5";

const DecisionSchema = z.object({
  decision: z.enum(["new_tag", "alias_of_existing", "reject"]),
  // Only set (and only trusted) when decision is "alias_of_existing" —
  // must be copied verbatim from the existing list given in the prompt,
  // never invented.
  matchedLabel: z.string().nullable(),
});

export type TechTagValidation =
  | { decision: "new_tag" }
  | { decision: "alias_of_existing"; matchedLabel: string }
  | { decision: "reject" };

/**
 * §job-import — replaces "email a human, wait for them to notice" with an
 * immediate, synchronous decision: is this a genuine technology/skill
 * relevant to IT/tech/business job postings, and if so, is it really the
 * same thing as something already in the list (just spelled/abbreviated
 * differently) or genuinely new? Deliberately conservative on the
 * "alias_of_existing" call — only true synonyms, not merely related
 * technologies, to avoid quietly merging two distinct real things.
 */
export async function validateTechTag(label: string, existingLabels: string[]): Promise<TechTagValidation> {
  try {
    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: DecisionSchema }),
      prompt:
        `A user on an IT/tech job board is requesting "${label}" as a new technology/skill tag. ` +
        "Decide one of three things:\n" +
        '- "reject": not a genuine, real technology, tool, platform, or professional skill relevant to ' +
        "IT/tech/business job postings (gibberish, a joke, or not a real thing at all).\n" +
        '- "alias_of_existing": it refers to the EXACT SAME thing as one of the labels in the existing ' +
        "list below, just spelled, capitalized, or abbreviated differently (e.g. an acronym vs. its full " +
        "name) — be conservative, only for genuine synonyms, never for something merely related or similar. " +
        "Copy the matched label from the list exactly, character for character.\n" +
        '- "new_tag": a genuine, real, distinct technology/skill that is not already covered by anything ' +
        "in the list.\n\n" +
        `Existing labels:\n${existingLabels.map((l) => `- ${l}`).join("\n")}`,
    });

    if (output.decision === "alias_of_existing" && output.matchedLabel) {
      const real = existingLabels.find((l) => l.toLowerCase() === output.matchedLabel!.toLowerCase());
      if (real) return { decision: "alias_of_existing", matchedLabel: real };
      // The model named something not actually in the list — don't trust
      // it, fall back to treating this as a genuinely new tag instead.
      return { decision: "new_tag" };
    }
    if (output.decision === "reject") return { decision: "reject" };
    return { decision: "new_tag" };
  } catch {
    // A Gateway failure must never silently create (or silently reject)
    // a tag — reject is the safe default; the request row still exists
    // for a human to look at if this keeps happening.
    return { decision: "reject" };
  }
}
