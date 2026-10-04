import 'dotenv/config';
import prisma from '../prisma.js';
import { hashPassword } from '../admin/auth.js';

// Use environment variables, never command-line password arguments or committed defaults.
try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || 'Platform Administrator';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191 || name.length > 120) throw new Error('Set a valid ADMIN_EMAIL and ADMIN_NAME (maximum 120 characters).');
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
  await prisma.$transaction(async tx => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) throw new Error('This email already exists. Use a new email; this command never promotes or overwrites an existing account.');
    const user = await tx.user.create({ data: { email, name, passwordHash, platformRole: 'SUPER_ADMIN', status: 'ACTIVE' } });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'BOOTSTRAP_SUPER_ADMIN', entityType: 'users', entityId: String(user.id) } });
  });
  console.log('Super administrator created. Sign in at /dashboard/. Remove ADMIN_PASSWORD from your environment after provisioning.');
} catch (error) {
  console.error(error.code ? `Administrator creation failed (${error.code}). Check the database migration and configuration.` : error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
