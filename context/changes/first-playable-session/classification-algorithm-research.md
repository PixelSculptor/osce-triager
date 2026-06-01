---
change_id: first-playable-session
research_type: external
sources: exa.ai web_search
conducted: 2026-05-31
query_scope: diagnostic test classification algorithms, OSCE scoring systems, deterministic rule engines, Next.js server-side validation
---

# Research: Diagnostic Test Classification Algorithm for S-02 Validator

## TL;DR

There is a well-established algorithm family that directly matches what S-02 needs. The existing 4-tier classification (`critical` / `optimal` / `acceptable` / `unnecessary`) maps precisely to the **ACR/ESR Appropriateness Criteria** model — the academic gold standard used in radiology and general diagnostics education. The correct implementation pattern for the constraints (deterministic, server-side, <1 s, TypeScript) is a **pre-classified lookup table + pure rule engine** — not ML, not Bayesian inference, not LLMs.

---

## 1. Academic Lineage — What Classification System Is Already in the Seed Data?

The **ESR eGUIDE** (European Society of Radiology) and **ACR Appropriateness Criteria** (American College of Radiology) are the dominant classification frameworks in diagnostic test simulation for medical students. They use a 1–9 numeric scale that collapses to exactly 3–4 tiers:

| ESR/ACR Score | Tier | Maps To Seed Data (`src/shared/lib/seed.ts`) |
|---|---|---|
| 7–9 | Usually appropriate | `critical` / `optimal` |
| 4–6 | May be appropriate | `acceptable` |
| 1–3 | Usually not appropriate | `unnecessary` |

The seed data already implements this correctly as a 4-tier variant — splitting "usually appropriate" into `critical` (life-saving, penalises omission) and `optimal` (high diagnostic value, no penalty for omission). This split is the OSCE-specific addition on top of the standard ESR/ACR model.

**Source:** Diekhoff et al. (Charité Berlin), *ESR eGUIDE effectiveness study*, European Radiology — explicitly used this classification to give real-time feedback to students on their test selections, which is exactly what S-02's validator does. https://link.springer.com/content/pdf/10.1007/s00330-020-06942-2.pdf

---

## 2. The Algorithm: Pre-classified Lookup Table + Pure Rule Engine

This is the correct and only appropriate algorithm for the determinism + <1 s constraint.

### Why NOT the alternatives

| Alternative | Reason to Reject |
|---|---|
| Bayesian/probabilistic (ACTMED, BN) | Used for *suggesting* the next test to an AI agent; non-deterministic; >1 s. Source: openreview.net/pdf/664ac042... |
| Deep Reinforcement Learning (SM-DDPO) | Used for discovering optimal pathways, not validating against a pre-defined rubric. Source: sciencedirect.com/S0933365724002367 |
| LLM scoring | Non-deterministic (temperature > 0); latency unpredictable; explicitly prohibited by PRD <1 s NFR. Source: arxiv.org/html/2501.13957v2 |
| Borderline Regression Method (BRM) | Post-session cohort-level standard-setting, not real-time per-selection feedback. Source: pmc.ncbi.nlm.nih.gov/PMC5756405 |

### What to use — Weighted Checklist / Rule Engine

```
classify(scenarioId, testId) → { category, feedbackKey, triggersIrreversibleFail, scoreChange }
```

Pure function. Lookup table. Zero ML. Zero probabilistic computation. In OSCE literature this is called **criterion-referenced assessment** — classification is pre-defined by expert judgment, not computed at runtime. The ESR eGUIDE uses this exact pattern at scale.

**Source:** Homer et al. *Shining a spotlight on scoring in the OSCE: checklists and item weighting*, White Rose eprints — confirms differentially-weighted checklists are more valid than uniform scoring and that weights must be set at station design time, not computed. https://eprints.whiterose.ac.uk/id/eprint/161400/3/ShiningASpotlightOnOSCEScoringMain.pdf

**Stack compatibility confirmation:** LogRocket article *How to build advanced forms in Next.js using a rule engine* (2026-05-21) demonstrates the exact architectural pattern for Next.js 16 + Server Actions: rule engine is a pure TypeScript function invoked server-side, deterministic, <1 ms execution, same input → same output. https://blog.logrocket.com/how-build-advanced-forms-next-js-rule-engine/

---

## 3. The Irreversible-Negative Rule — Academic Backing

"Session marked irreversibly negative after missing a life-saving test" is a direct implementation of the **non-compensatory model** in OSCE literature.

Schoonheim-Klein et al. (dental OSCE) compared compensatory / partial-compensatory / non-compensatory models. The non-compensatory model — where a single critical failure cannot be offset by high scores elsewhere — is the most defensible and most clinically valid model for patient-safety-sensitive tests.

In code: a binary flag set when `session ends AND any critical test was not ordered`.

**Source:** Schoonheim-Klein et al., *Who will pass the dental OSCE?*, European Journal of Dental Education, 2009 — cited in discovery.researcher.life/article/standard-setting-methods…

---

## 4. Scoring Formula (for S-03 Session History)

Differentially-weighted checklist model from Homer et al. — the best-evidenced method for this scenario:

| Category | Suggested Weight | Rationale |
|---|---|---|
| `critical` ordered | +10 | Life-saving; must be done |
| `critical` skipped at session end | triggers `irreversible_fail` flag | Non-compensatory rule |
| `optimal` ordered | +5 | High diagnostic value |
| `acceptable` ordered | +1 | Low value but not harmful |
| `unnecessary` ordered | −2 | Waste / potential harm |

Score formula: `clamp((rawScore / maxPossibleScore) * 100, 0, 100)`, forced to 0 if `irreversible_fail = true`.

Exact weights are author-defined (pre-defined in scenario data). The 0:2:4 weight ratio from Homer et al. is a common starting point; the important invariant is that weights are **static per scenario, not computed at runtime**.

---

## 5. TypeScript Implementation Pattern — Stack-Compatible Reference

The `@eu-ai-act/sdk` project (found in search) is a production reference of this pattern in TypeScript + Next.js: pure `classify()` function, zero runtime deps, deterministic, exported from a shared lib. https://github.com/AbdelStark/eu-ai-act-toolkit

Recommended module shape for `src/shared/lib/validator.ts`:

```typescript
// server-only — never import from client components
export type TestCategory = 'critical' | 'optimal' | 'acceptable' | 'unnecessary';

export interface ValidationResult {
  category: TestCategory;
  feedbackKey: string;           // i18n key for UI message
  scoreChange: number;
  isSessionFail: boolean;        // set only when session ends + critical was skipped
}

export function validateTestSelection(
  testId: string,
  classifications: Record<string, TestCategory>  // loaded once at session start from DB
): ValidationResult {
  const category = classifications[testId] ?? 'unnecessary';
  return CATEGORY_RULES[category];  // pure object lookup — <1 ms
}

export function evaluateSessionEnd(
  orderedTestIds: string[],
  classifications: Record<string, TestCategory>
): { irreversibleFail: boolean; skippedCritical: string[] } {
  const skippedCritical = Object.entries(classifications)
    .filter(([id, cat]) => cat === 'critical' && !orderedTestIds.includes(id))
    .map(([id]) => id);
  return { irreversibleFail: skippedCritical.length > 0, skippedCritical };
}
```

Both functions are called from a **Next.js Server Action** — never directly from client-side code. This satisfies the PRD's determinism and server-side-only constraints.

---

## 6. Decision Summary

| Decision | Recommendation | Evidence |
|---|---|---|
| Algorithm family | Pre-classified lookup table + weighted checklist rule engine | ESR eGUIDE, ACR Appropriateness Criteria, Homer et al. |
| Classification source | Seed data already correct (`critical/optimal/acceptable/unnecessary`) | Matches ESR/ACR 4-tier model |
| Runtime location | Server Action only — never client-side | PRD NFR + LogRocket Next.js rule engine article |
| Irreversible-fail trigger | Session end: check if any `critical` test was not ordered | Non-compensatory model, Schoonheim-Klein et al. |
| Scoring for S-03 | Weighted sum, `irreversible_fail` overrides to 0 | Homer et al. differential weighting |
| ML / Bayesian needed? | No — out of scope; violates determinism NFR | ACTMED, DRL papers rejected on latency + non-determinism grounds |

---

## Sources

1. Diekhoff et al., *ESR eGUIDE effectiveness for teaching diagnostic imaging test selection*, European Radiology, 2020 — https://link.springer.com/content/pdf/10.1007/s00330-020-06942-2.pdf
2. Homer, Fuller et al., *Shining a spotlight on scoring in the OSCE: checklists and item weighting*, White Rose eprints — https://eprints.whiterose.ac.uk/id/eprint/161400/3/ShiningASpotlightOnOSCEScoringMain.pdf
3. Schoonheim-Klein et al., *Who will pass the dental OSCE?*, European Journal of Dental Education, 2009 — via discovery.researcher.life
4. ACTMED framework, *Optimal diagnostic test selection using Bayesian Experimental Design*, OpenReview 2025 — https://openreview.net/pdf/664ac042af443f56386bbc92a26ca7f0e61378c7.pdf
5. Akinyemi, *How to build advanced forms in Next.js using a rule engine*, LogRocket Blog, 2026-05-21 — https://blog.logrocket.com/how-build-advanced-forms-next-js-rule-engine/
6. AbdelStark, `@eu-ai-act/sdk` — pure TypeScript deterministic classification reference — https://github.com/AbdelStark/eu-ai-act-toolkit
7. Zheng Yu et al., *Deep Reinforcement Learning for Cost-Effective Medical Diagnosis*, OpenReview — https://openreview.net/forum?id=0WVNuEnqVu
8. Benchmarking LLMs for OSCE scoring (MIRS), arXiv 2501.13957v2 — https://arxiv.org/html/2501.13957v2
