import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Default AI profile account ─────────────────────────────────────────
  // Used as fallback for all AI prompts when a user hasn't set their own profile.
  const defaultEmail = 'info@beamai.net';
  const defaultHash  = await bcrypt.hash('Jomi@2025@@', 12);

  const defaultUser = await prisma.user.upsert({
    where:  { email: defaultEmail },
    create: { email: defaultEmail, name: 'BeamAI', password: defaultHash, plan: 'agency', emailVerified: new Date() },
    update: { plan: 'agency', emailVerified: new Date() },
  });

  await prisma.userSettings.upsert({
    where:  { userId: defaultUser.id },
    create: {
      userId: defaultUser.id,
      senderName:   'BeamAI Team',
      businessName: 'BeamAI',
      whatsapp:     '+234 800 000 0000',
      replyEmail:   defaultEmail,
      city:         'Lagos, Nigeria',
      tagline:      'Building digital front doors for Nigerian businesses',
      dailyGoal:    20,
      avgDealValue: 350000,
      closeRatePct: 10,
      onboardingDone: true,
    },
    update: {
      senderName:   'BeamAI Team',
      businessName: 'BeamAI',
      whatsapp:     '+234 800 000 0000',
      replyEmail:   defaultEmail,
      city:         'Lagos, Nigeria',
      tagline:      'Building digital front doors for Nigerian businesses',
      onboardingDone: true,
    },
  });

  console.log(`✅ Default profile account: ${defaultEmail}`);

  // ── 2. Admin account ────────────────────────────────────────────────────────
  // Grants access to /admin panel. Email must also be in ADMIN_EMAILS env var.
  const adminEmail    = 'admin@beamai.net';
  const adminPassword = 'BeamAdmin@2025!';
  const adminHash     = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where:  { email: adminEmail },
    create: { email: adminEmail, name: 'Admin', password: adminHash, plan: 'agency', emailVerified: new Date() },
    update: { emailVerified: new Date() },
  });

  await prisma.userSettings.upsert({
    where:  { userId: adminUser.id },
    create: { userId: adminUser.id, onboardingDone: true },
    update: { onboardingDone: true },
  });

  console.log(`✅ Admin account:           ${adminEmail}`);
  console.log(`   Password:                ${adminPassword}`);
  console.log(`   Login at:                /admin/login`);
  console.log(``);
  console.log(`⚠️  Add to .env.local and Vercel env vars:`);
  console.log(`   ADMIN_EMAILS=${adminEmail},${defaultEmail}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
