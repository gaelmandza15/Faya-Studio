export type CreditAction = "generation" | "modification" | "build";

export const CREDIT_COSTS: Record<CreditAction, number> = {
  generation: 50,
  modification: 20,
  build: 30,
};

export const CREDIT_REFUND_REASONS: Record<CreditAction, string> = {
  generation: "refund_generation",
  modification: "refund_modification",
  build: "refund_build",
};
