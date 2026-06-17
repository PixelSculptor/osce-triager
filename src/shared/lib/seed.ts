// dotenv must run before any db module is loaded.
// Static ESM imports are hoisted, so db is imported dynamically inside seed().
// import { config } from "dotenv"
// config({ path: ".env.local", override: false })

const SCENARIO_1_ID = '01935a5f-0000-7000-8000-000000000001';
const SCENARIO_2_ID = '01935a5f-0000-7000-8000-000000000002';

const SCENARIOS = [
  {
    id: SCENARIO_1_ID,
    title: 'Ostry ból w klatce piersiowej',
    description:
      '55-letni mężczyzna przywieziony przez rodzinę. RR 150/90 mmHg, HR 110/min, SpO2 94% na powietrzu. Skarży się na ból zamostkowy promieniujący do lewego ramienia (NRS 8/10), pocenie się, nudności. Wywiad: nadciśnienie tętnicze leczone farmakologicznie, palenie tytoniu od 20 lat.',
    timeLimitSeconds: 300,
  },
  {
    id: SCENARIO_2_ID,
    title: 'Zaburzenia świadomości',
    description:
      '68-letni mężczyzna znaleziony przez żonę leżący na podłodze, nie reaguje na pytania. RR 110/70 mmHg, HR 95/min, RR 12 oddechów/min, Glasgow 10 (M4V3E3), glukoza z glukometru 38 mg/dl. Wywiad: cukrzyca insulin-zależna od 15 lat, wieczorem była kolacja, rano zaplanowany długi spacer.',
    timeLimitSeconds: 240,
  },
];

const TESTS = [
  { id: 'dt-001', name: 'EKG 12-odprowadzeniowe' },
  { id: 'dt-002', name: 'Troponiny sercowe' },
  { id: 'dt-003', name: 'Glukoza z glukometru' },
  { id: 'dt-004', name: 'KT głowy bez kontrastu' },
  { id: 'dt-005', name: 'Morfologia krwi' },
  { id: 'dt-006', name: 'Elektrolity (Na, K)' },
  { id: 'dt-007', name: 'Gazometria krwi' },
  { id: 'dt-008', name: 'Kreatynina i mocznik' },
  { id: 'dt-009', name: 'Koagulogram (INR, APTT)' },
  { id: 'dt-010', name: 'RTG klatki piersiowej' },
  { id: 'dt-011', name: 'USG Point-of-Care (POCUS)' },
  { id: 'dt-012', name: 'D-dimer' },
  { id: 'dt-013', name: 'CRP' },
  { id: 'dt-014', name: 'Badanie ogólne moczu' },
  { id: 'dt-015', name: 'Toksykologia (mocz/krew)' },
  { id: 'dt-016', name: 'Enzymy wątrobowe (AST, ALT)' },
  { id: 'dt-017', name: 'Lipaza w surowicy' },
  { id: 'dt-018', name: 'Prokalcytonina' },
];

type Classification = 'critical' | 'optimal' | 'acceptable' | 'unnecessary';

// [testId, s1Classification, s2Classification]
const CLASSIFICATIONS: [string, Classification, Classification][] = [
  ['dt-001', 'critical', 'acceptable'],
  ['dt-002', 'critical', 'unnecessary'],
  ['dt-003', 'acceptable', 'critical'],
  ['dt-004', 'unnecessary', 'critical'],
  ['dt-005', 'optimal', 'optimal'],
  ['dt-006', 'optimal', 'optimal'],
  ['dt-007', 'acceptable', 'optimal'],
  ['dt-008', 'optimal', 'optimal'],
  ['dt-009', 'optimal', 'acceptable'],
  ['dt-010', 'acceptable', 'unnecessary'],
  ['dt-011', 'acceptable', 'unnecessary'],
  ['dt-012', 'acceptable', 'unnecessary'],
  ['dt-013', 'unnecessary', 'acceptable'],
  ['dt-014', 'unnecessary', 'acceptable'],
  ['dt-015', 'unnecessary', 'acceptable'],
  ['dt-016', 'unnecessary', 'unnecessary'],
  ['dt-017', 'unnecessary', 'unnecessary'],
  ['dt-018', 'unnecessary', 'unnecessary'],
];

async function seed() {
  // Dynamic imports guarantee DATABASE_URL is set before postgres client initializes
  const { getDb } = await import('./db');
  const { scenarios, diagnosticTests, testClassifications } =
    await import('./schema');

  const db = getDb();

  await db.insert(scenarios).values(SCENARIOS).onConflictDoNothing();
  await db.insert(diagnosticTests).values(TESTS).onConflictDoNothing();

  const classificationRows = CLASSIFICATIONS.flatMap(([testId, s1, s2]) => [
    { scenarioId: SCENARIO_1_ID, testId, classification: s1 },
    { scenarioId: SCENARIO_2_ID, testId, classification: s2 },
  ]);
  await db
    .insert(testClassifications)
    .values(classificationRows)
    .onConflictDoNothing();

  console.log('Seed complete: 2 scenarios, 18 tests, 36 classifications');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
