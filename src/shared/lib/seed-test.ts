import bcrypt from 'bcryptjs';

// Short-limit scenario used only by the timeout E2E so the timer can reach 0:00
// in seconds instead of the 300 s of seed.ts scenarios. dt-001 is seeded by
// seed.ts and classified critical here, so leaving it unordered yields Negatywny.
const TEST_TIMEOUT_SCENARIO_ID = '01935a5f-0000-7000-8000-000000000003';

async function seedTest() {
  const { getDb } = await import('./db');
  const { users, scenarios, testClassifications } = await import('./schema');

  const db = getDb();

  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;
  const hashedPassword = await bcrypt.hash(password, 12);

  await db
    .insert(users)
    .values({ email, name: 'Test User', hashedPassword })
    .onConflictDoNothing();

  await db
    .insert(scenarios)
    .values({
      id: TEST_TIMEOUT_SCENARIO_ID,
      title: 'Test timeout — krótki limit',
      description:
        'Scenariusz testowy E2E: krótki limit czasu, aby zweryfikować auto-finalizację przy 0:00.',
      timeLimitSeconds: 5,
    })
    .onConflictDoNothing();

  await db
    .insert(testClassifications)
    .values({
      scenarioId: TEST_TIMEOUT_SCENARIO_ID,
      testId: 'dt-001',
      classification: 'critical',
    })
    .onConflictDoNothing();

  console.log(`Seed test user: ${email}`);
  console.log(
    'Seed test scenario: Test timeout — krótki limit (5s, dt-001 critical)',
  );
  process.exit(0);
}

seedTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
