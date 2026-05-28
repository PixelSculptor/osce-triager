import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "next-auth/adapters"

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  hashedPassword: text("hashed_password"),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

// --- Domain tables ---

export const scenarios = pgTable("scenario", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  timeLimitSeconds: integer("time_limit_seconds").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const diagnosticTests = pgTable("diagnostic_test", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const testClassifications = pgTable(
  "test_classification",
  {
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    testId: text("test_id")
      .notNull()
      .references(() => diagnosticTests.id, { onDelete: "cascade" }),
    classification: text("classification")
      .$type<"critical" | "optimal" | "acceptable" | "unnecessary">()
      .notNull(),
  },
  (tc) => [primaryKey({ columns: [tc.scenarioId, tc.testId] })]
)

export const sessionResults = pgTable("session_result", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: text("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "restrict" }),
  outcome: text("outcome")
    .$type<"in_progress" | "positive" | "negative">()
    .notNull()
    .default("in_progress"),
  isFailed: boolean("is_failed").notNull().default(false),
  startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: "date" }),
})

export const sessionEvents = pgTable("session_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessionResults.id, { onDelete: "cascade" }),
  testId: text("test_id")
    .notNull()
    .references(() => diagnosticTests.id, { onDelete: "restrict" }),
  validatorResult: text("validator_result")
    .$type<"correct" | "suboptimal" | "critical_miss">()
    .notNull(),
  selectedAt: timestamp("selected_at", { mode: "date" }).notNull().defaultNow(),
})
