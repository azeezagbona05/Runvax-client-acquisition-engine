import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'info@beamai.net';
  const password = 'Jomi@2025@@';
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'BeamAI',
      password: hash,
      plan: 'agency',
    },
    update: {
      plan: 'agency',
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      // Platform-default identity — used as fallback for all AI prompts
      senderName: 'BeamAI Team',
      businessName: 'BeamAI',
      whatsapp: '+234 800 000 0000',
      replyEmail: 'info@beamai.net',
      city: 'Lagos, Nigeria',
      tagline: 'Building digital front doors for Nigerian businesses',
      dailyGoal: 20,
      avgDealValue: 350000,
      closeRatePct: 10,
    },
    update: {
      senderName: 'BeamAI Team',
      businessName: 'BeamAI',
      whatsapp: '+234 800 000 0000',
      replyEmail: 'info@beamai.net',
      city: 'Lagos, Nigeria',
      tagline: 'Building digital front doors for Nigerian businesses',
    },
  });

  console.log(`Default user seeded: ${email} (id: ${user.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
