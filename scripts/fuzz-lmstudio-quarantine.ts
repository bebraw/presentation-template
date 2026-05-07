import { VisibleTextQualityError } from "../studio/server/services/visible-text-quality.ts";

export type FuzzQuarantineResult = {
  blockedByQuarantine: true;
  blockedCode: string;
  blockedFieldPath: string | null;
};

export class FuzzDeckPlanQuarantineError extends Error {
  code = "deck-plan-prompt-leak";

  constructor(scenarioName: string) {
    super(`${scenarioName} produced prompt-like leaked text in the deck plan.`);
    this.name = "FuzzDeckPlanQuarantineError";
  }
}

export function promptLeakQuarantineResult(error: unknown): FuzzQuarantineResult | null {
  if (error instanceof VisibleTextQualityError && (error.code === "prompt-leak" || error.code === "copied-instruction")) {
    return {
      blockedByQuarantine: true,
      blockedCode: error.code,
      blockedFieldPath: error.fieldPath || null
    };
  }

  if (error instanceof FuzzDeckPlanQuarantineError) {
    return {
      blockedByQuarantine: true,
      blockedCode: error.code,
      blockedFieldPath: null
    };
  }

  return null;
}
