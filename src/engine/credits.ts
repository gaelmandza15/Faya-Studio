import type { PrismaClient } from "@prisma/client";

export type ChargeCreditsResult =
  | { ok: true; transactionId: string; balance: number }
  | { ok: false; reason: "insufficient" | "notFound" };

export async function chargeCredits(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string | null;
    amount: number;
    reason: string;
  },
): Promise<ChargeCreditsResult> {
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: input.organizationId },
      select: { credits: true },
    });

    if (!organization) {
      return { ok: false as const, reason: "notFound" as const };
    }

    const updatedCount = await tx.organization.updateMany({
      where: {
        id: input.organizationId,
        credits: { gte: input.amount },
      },
      data: { credits: { decrement: input.amount } },
    });

    if (updatedCount.count === 0) {
      return { ok: false as const, reason: "insufficient" as const };
    }

    const updated = await tx.organization.findUnique({
      where: { id: input.organizationId },
      select: { credits: true },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        amount: -input.amount,
        reason: input.reason,
      },
    });

    return {
      ok: true as const,
      transactionId: transaction.id,
      balance: updated?.credits ?? 0,
    };
  });
}

export async function refundCredits(
  prisma: PrismaClient,
  input: { transactionId: string; reason: string },
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.creditTransaction.findUnique({
        where: { id: input.transactionId },
      });

      if (!original || original.amount >= 0) {
        return false;
      }

      const existing = await tx.creditTransaction.findUnique({
        where: { refId: input.transactionId },
      });

      if (existing) {
        return false;
      }

      await tx.organization.update({
        where: { id: original.organizationId },
        data: { credits: { increment: Math.abs(original.amount) } },
      });

      await tx.creditTransaction.create({
        data: {
          organizationId: original.organizationId,
          userId: original.userId,
          amount: Math.abs(original.amount),
          reason: input.reason,
          refId: input.transactionId,
        },
      });

      return true;
    });
  } catch (error) {
    console.error("Credit refund failed", error);
    return false;
  }
}
