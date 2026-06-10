import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/shared/lib/db";
import { users, scenarios, sessionResults } from "@/shared/lib/schema";
import { getSessionById, getSessionEvents } from "@/modules/session/queries";

const runIntegration = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!runIntegration)(
  "getSessionById / getSessionEvents — isolation IDOR",
  () => {
    beforeAll(async () => {
      await db.insert(users).values([
        { id: "idor-user-a", email: "idor-a@integration.local" },
        { id: "idor-user-b", email: "idor-b@integration.local" },
      ]);
      await db.insert(scenarios).values({
        id: "idor-scenario",
        title: "IDOR Test Scenario",
        description: "Integration fixture for IDOR isolation test",
        timeLimitSeconds: 300,
      });
      await db.insert(sessionResults).values({
        id: "idor-session",
        userId: "idor-user-a",
        scenarioId: "idor-scenario",
      });
    });

    afterAll(async () => {
      await db
        .delete(sessionResults)
        .where(eq(sessionResults.id, "idor-session"));
      await db.delete(scenarios).where(eq(scenarios.id, "idor-scenario"));
      await db.delete(users).where(eq(users.id, "idor-user-a"));
      await db.delete(users).where(eq(users.id, "idor-user-b"));
    });

    it("getSessionById — owner session receives row (positive control)", async () => {
      const result = await getSessionById("idor-session", "idor-user-a");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("idor-session");
    });

    it("getSessionById — foreign userId returns null (IDOR blocked)", async () => {
      const result = await getSessionById("idor-session", "idor-user-b");
      expect(result).toBeNull();
    });

    it("getSessionEvents — owner session receives array (positive control)", async () => {
      const result = await getSessionEvents("idor-session", "idor-user-a");
      expect(Array.isArray(result)).toBe(true);
    });

    it("getSessionEvents — foreign userId returns empty array (IDOR blocked)", async () => {
      const result = await getSessionEvents("idor-session", "idor-user-b");
      expect(result).toEqual([]);
    });
  }
);
