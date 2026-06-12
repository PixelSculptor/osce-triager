import bcrypt from 'bcryptjs';

async function seedTest() {
  const { db } = await import('./db');
  const { users } = await import('./schema');

  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;
  const hashedPassword = await bcrypt.hash(password, 12);

  await db
    .insert(users)
    .values({ email, name: 'Test User', hashedPassword })
    .onConflictDoNothing();

  console.log(`Seed test user: ${email}`);
  process.exit(0);
}

seedTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
