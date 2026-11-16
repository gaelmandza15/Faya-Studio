import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@faya-studio.app";
const DEMO_PASSWORD = "demo1234";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });

  if (existing) {
    console.log(`Demo user already exists: ${DEMO_EMAIL}`);
    return;
  }

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      firstName: "Jean",
      lastName: "Dupont",
      locale: "fr",
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Ma Société",
      slug: "ma-societe",
      plan: "pro",
      credits: 2750,
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      role: "owner",
    },
  });

  const now = Date.now();
  const hour = 60 * 60 * 1000;

  await prisma.creditTransaction.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      amount: 4160,
      reason: "initial",
      createdAt: new Date(now - 10 * 24 * hour),
    },
  });

  await prisma.creditTransaction.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      amount: -980,
      reason: "generation",
      createdAt: new Date(now - 5 * 24 * hour),
    },
  });

  await prisma.creditTransaction.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      amount: -430,
      reason: "modification",
      createdAt: new Date(now - 2 * 24 * hour),
    },
  });

  const projects = [
    {
      name: "Gestion Commerciale",
      prompt:
        "Reprends mon application Gestion Commerciale et ajoute un suivi des ventes du mois.",
      icon: "cube",
      hoursAgo: 2,
    },
    {
      name: "Planning Équipe",
      prompt:
        "Reprends mon application Planning Équipe et améliore la vue calendrier des tâches.",
      icon: "calendar",
      hoursAgo: 24,
    },
    {
      name: "Suivi Budget",
      prompt:
        "Reprends mon application Suivi Budget et ajoute un graphique des dépenses par catégorie.",
      icon: "chart",
      hoursAgo: 48,
    },
    {
      name: "Portail Clients",
      prompt:
        "Reprends mon application Portail Clients et ajoute un espace de suivi des demandes.",
      icon: "users",
      hoursAgo: 72,
    },
  ];

  for (const project of projects) {
    await prisma.project.create({
      data: {
        name: project.name,
        prompt: project.prompt,
        icon: project.icon,
        status: "ready",
        organizationId: organization.id,
        createdById: user.id,
        lastActivityAt: new Date(now - project.hoursAgo * hour),
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
