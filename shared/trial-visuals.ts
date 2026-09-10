import { z } from "zod";
export const trialVisualSchema = z.object({
  id: z.string(),
  title: z.string(),
  study: z.string(),
  endpoint: z.string(),
  population: z.string(),
  timepoint: z.string(),
  unit: z.string(),
  direction: z.enum(["higher", "lower"]),
  comparisonLabel: z.string(),
  arms: z
    .array(
      z.object({
        label: z.string(),
        value: z.number().finite(),
        n: z.number().int().positive().optional(),
      }),
    )
    .min(2)
    .max(4),
  effect: z
    .object({
      label: z.string(),
      value: z.number().finite(),
      lower: z.number().finite().optional(),
      upper: z.number().finite().optional(),
      level: z.string().optional(),
      unit: z.string().optional(),
    })
    .optional(),
  interpretation: z.string(),
  limitations: z.array(z.string()).min(1),
  sourceIds: z.array(z.string()).min(1),
  sourceNote: z.string(),
});
export type TrialVisual = z.infer<typeof trialVisualSchema>;
export function validateTrialVisuals(
  value: unknown,
  sourcesByCandidate: Record<string, Set<string>>,
) {
  const result = z.record(z.array(trialVisualSchema)).parse(value);
  const ids = new Set<string>();
  for (const [candidateId, visuals] of Object.entries(result)) {
    if (!sourcesByCandidate[candidateId])
      throw Error(`Unknown trial-visual candidate: ${candidateId}`);
    for (const visual of visuals) {
      if (ids.has(visual.id)) throw Error("Duplicate trial visual identifier");
      ids.add(visual.id);
      for (const source of visual.sourceIds)
        if (!sourcesByCandidate[candidateId].has(source))
          throw Error(
            `Trial visual reference not linked to candidate: ${source}`,
          );
      const effect = visual.effect;
      if (
        effect &&
        (effect.lower !== undefined || effect.upper !== undefined)
      ) {
        if (
          effect.lower === undefined ||
          effect.upper === undefined ||
          !effect.level ||
          effect.lower > effect.value ||
          effect.upper < effect.value
        )
          throw Error(
            "A displayed interval needs its level, both bounds, and the estimate within them.",
          );
      }
    }
  }
  return result;
}
