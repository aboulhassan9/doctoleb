/**
 * labOrderToTestMap.js
 *
 * Maps lab_orders.title substrings (lowercase) to the checkbox_grid test
 * items in the default Lab Request Form template.
 *
 * This is the "closed set" for v1. Adding a new mapping is a doc change
 * (update § 14 Slice 6 in the plan + add the test item to the lab-request.json
 * spec if it doesn't already exist there).
 *
 * How it works:
 *   1. The lab order title is lowercased.
 *   2. Each entry in TITLE_TO_TESTS is checked against the title via
 *      `title.includes(pattern)`.
 *   3. ALL matching test items are collected into a Set (deduped).
 *   4. The result is an array of test item strings matching the
 *      checkbox_grid items in the lab-request.json spec.
 *
 * Usage (from documentService or a hook):
 *   import { resolveLabTests } from '../lib/labOrderToTestMap.js';
 *   const tests = resolveLabTests('CBC and Lipid Panel');
 *   // → ['CBC', 'ESR', 'Reticulocyte Count', 'Peripheral Smear', ...]
 *   // (all Hematology items + Lipid Panel)
 */

/**
 * Pattern → test items mapping.
 *
 * Keys: lowercase substring patterns matched against lab_orders.title.
 * Values: arrays of test item strings (must exactly match items in lab-request.json groups).
 *
 * Ordering: more specific patterns first, then broader ones.
 */
const TITLE_TO_TESTS = [
  // ── Hematology ─────────────────────────────────────────────────
  { pattern: 'cbc', tests: ['CBC'] },
  { pattern: 'complete blood count', tests: ['CBC'] },
  { pattern: 'blood count', tests: ['CBC'] },
  { pattern: 'esr', tests: ['ESR'] },
  { pattern: 'sedimentation', tests: ['ESR'] },
  { pattern: 'reticulocyte', tests: ['Reticulocyte Count'] },
  { pattern: 'peripheral smear', tests: ['Peripheral Smear'] },
  { pattern: 'coagulation', tests: ['Coagulation (PT/INR)', 'aPTT'] },
  { pattern: 'pt/inr', tests: ['Coagulation (PT/INR)'] },
  { pattern: 'prothrombin', tests: ['Coagulation (PT/INR)'] },
  { pattern: 'aptt', tests: ['aPTT'] },
  { pattern: 'd-dimer', tests: ['D-Dimer'] },
  { pattern: 'fibrinogen', tests: ['Fibrinogen'] },

  // ── Chemistry ──────────────────────────────────────────────────
  { pattern: 'fasting glucose', tests: ['FBS / Fasting Glucose'] },
  { pattern: 'fbs', tests: ['FBS / Fasting Glucose'] },
  { pattern: 'random glucose', tests: ['RBS / Random Glucose'] },
  { pattern: 'rbs', tests: ['RBS / Random Glucose'] },
  { pattern: 'hba1c', tests: ['HbA1c'] },
  { pattern: 'glycated', tests: ['HbA1c'] },
  { pattern: 'lipid', tests: ['Lipid Panel'] },
  { pattern: 'cholesterol', tests: ['Lipid Panel'] },
  { pattern: 'bun', tests: ['BUN / Urea'] },
  { pattern: 'urea', tests: ['BUN / Urea'] },
  { pattern: 'creatinine', tests: ['Creatinine', 'eGFR'] },
  { pattern: 'egfr', tests: ['eGFR'] },
  { pattern: 'uric acid', tests: ['Uric Acid'] },
  { pattern: 'electrolytes', tests: ['Electrolytes (Na/K/Cl)'] },
  { pattern: 'sodium', tests: ['Electrolytes (Na/K/Cl)'] },
  { pattern: 'potassium', tests: ['Electrolytes (Na/K/Cl)'] },
  { pattern: 'calcium', tests: ['Calcium'] },
  { pattern: 'magnesium', tests: ['Magnesium'] },
  { pattern: 'phosphorus', tests: ['Phosphorus'] },

  // ── Liver Function ─────────────────────────────────────────────
  { pattern: 'liver function', tests: ['ALT (SGPT)', 'AST (SGOT)', 'ALP', 'GGT', 'Total Bilirubin', 'Direct Bilirubin', 'Albumin', 'Total Protein'] },
  { pattern: 'lft', tests: ['ALT (SGPT)', 'AST (SGOT)', 'ALP', 'GGT', 'Total Bilirubin', 'Direct Bilirubin', 'Albumin', 'Total Protein'] },
  { pattern: 'alt', tests: ['ALT (SGPT)'] },
  { pattern: 'sgpt', tests: ['ALT (SGPT)'] },
  { pattern: 'ast', tests: ['AST (SGOT)'] },
  { pattern: 'sgot', tests: ['AST (SGOT)'] },
  { pattern: 'alp', tests: ['ALP'] },
  { pattern: 'alkaline phosphatase', tests: ['ALP'] },
  { pattern: 'ggt', tests: ['GGT'] },
  { pattern: 'bilirubin', tests: ['Total Bilirubin', 'Direct Bilirubin'] },
  { pattern: 'albumin', tests: ['Albumin'] },

  // ── Thyroid ────────────────────────────────────────────────────
  { pattern: 'thyroid', tests: ['TSH', 'Free T4', 'Free T3'] },
  { pattern: 'tsh', tests: ['TSH'] },
  { pattern: 'free t4', tests: ['Free T4'] },
  { pattern: 'free t3', tests: ['Free T3'] },
  { pattern: 'anti-tpo', tests: ['Anti-TPO'] },
  { pattern: 'thyroglobulin', tests: ['Thyroglobulin'] },

  // ── Cardiac Markers ────────────────────────────────────────────
  { pattern: 'cardiac', tests: ['Troponin I', 'CK-MB', 'BNP / NT-proBNP', 'LDH'] },
  { pattern: 'troponin', tests: ['Troponin I'] },
  { pattern: 'ck-mb', tests: ['CK-MB'] },
  { pattern: 'bnp', tests: ['BNP / NT-proBNP'] },
  { pattern: 'ldh', tests: ['LDH'] },

  // ── Inflammatory / Autoimmune ──────────────────────────────────
  { pattern: 'crp', tests: ['CRP'] },
  { pattern: 'c-reactive', tests: ['CRP'] },
  { pattern: 'rheumatoid', tests: ['RF (Rheumatoid Factor)'] },
  { pattern: 'ana', tests: ['ANA'] },
  { pattern: 'anti-dsdna', tests: ['Anti-dsDNA'] },
  { pattern: 'complement', tests: ['Complement C3', 'Complement C4'] },

  // ── Endocrine ──────────────────────────────────────────────────
  { pattern: 'cortisol', tests: ['Cortisol'] },
  { pattern: 'prolactin', tests: ['Prolactin'] },
  { pattern: 'fsh', tests: ['FSH'] },
  { pattern: 'lh', tests: ['LH'] },
  { pattern: 'estradiol', tests: ['Estradiol'] },
  { pattern: 'testosterone', tests: ['Testosterone'] },
  { pattern: 'dhea', tests: ['DHEA-S'] },
  { pattern: 'insulin', tests: ['Insulin'] },
  { pattern: 'pth', tests: ['PTH'] },
  { pattern: 'parathyroid', tests: ['PTH'] },
  { pattern: 'vitamin d', tests: ['Vitamin D (25-OH)'] },

  // ── Serology / Infectious ──────────────────────────────────────
  { pattern: 'hepatitis b', tests: ['HBsAg'] },
  { pattern: 'hbsag', tests: ['HBsAg'] },
  { pattern: 'hepatitis c', tests: ['Anti-HCV'] },
  { pattern: 'hcv', tests: ['Anti-HCV'] },
  { pattern: 'hiv', tests: ['HIV 1/2'] },
  { pattern: 'rpr', tests: ['RPR / VDRL'] },
  { pattern: 'vdrl', tests: ['RPR / VDRL'] },
  { pattern: 'syphilis', tests: ['RPR / VDRL'] },
  { pattern: 'cmv', tests: ['CMV IgG/IgM'] },
  { pattern: 'cytomegalovirus', tests: ['CMV IgG/IgM'] },
  { pattern: 'ebv', tests: ['EBV Panel'] },
  { pattern: 'epstein', tests: ['EBV Panel'] },
  { pattern: 'h. pylori', tests: ['H. Pylori Ab'] },
  { pattern: 'helicobacter', tests: ['H. Pylori Ab'] },
  { pattern: 'blood culture', tests: ['Blood Culture'] },

  // ── Urinalysis ─────────────────────────────────────────────────
  { pattern: 'urine routine', tests: ['Urine Routine'] },
  { pattern: 'urinalysis', tests: ['Urine Routine'] },
  { pattern: 'urine culture', tests: ['Urine Culture'] },
  { pattern: 'microalbumin', tests: ['Urine Microalbumin'] },
  { pattern: '24h urine protein', tests: ['24h Urine Protein'] },
  { pattern: '24h urine creatinine', tests: ['24h Urine Creatinine'] },

  // ── Vitamins & Minerals ────────────────────────────────────────
  { pattern: 'vitamin b12', tests: ['Vitamin B12'] },
  { pattern: 'b12', tests: ['Vitamin B12'] },
  { pattern: 'folate', tests: ['Folate'] },
  { pattern: 'folic acid', tests: ['Folate'] },
  { pattern: 'ferritin', tests: ['Ferritin'] },
  { pattern: 'iron studies', tests: ['Iron Studies (TIBC)'] },
  { pattern: 'tibc', tests: ['Iron Studies (TIBC)'] },
  { pattern: 'iron', tests: ['Iron Studies (TIBC)'] },
  { pattern: 'zinc', tests: ['Zinc'] },

  // ── Tumor Markers ──────────────────────────────────────────────
  { pattern: 'psa', tests: ['PSA'] },
  { pattern: 'prostate', tests: ['PSA'] },
  { pattern: 'ca-125', tests: ['CA-125'] },
  { pattern: 'ca 125', tests: ['CA-125'] },
  { pattern: 'ca 19-9', tests: ['CA 19-9'] },
  { pattern: 'ca19-9', tests: ['CA 19-9'] },
  { pattern: 'cea', tests: ['CEA'] },
  { pattern: 'afp', tests: ['AFP'] },
  { pattern: 'alpha-fetoprotein', tests: ['AFP'] },

  // ── Comprehensive panels ───────────────────────────────────────
  { pattern: 'metabolic panel', tests: ['FBS / Fasting Glucose', 'BUN / Urea', 'Creatinine', 'Electrolytes (Na/K/Cl)', 'Calcium', 'ALT (SGPT)', 'AST (SGOT)', 'Total Bilirubin', 'Albumin', 'Total Protein'] },
  { pattern: 'renal function', tests: ['BUN / Urea', 'Creatinine', 'eGFR', 'Electrolytes (Na/K/Cl)'] },
  { pattern: 'kidney function', tests: ['BUN / Urea', 'Creatinine', 'eGFR', 'Electrolytes (Na/K/Cl)'] },
  { pattern: 'rft', tests: ['BUN / Urea', 'Creatinine', 'eGFR', 'Electrolytes (Na/K/Cl)'] },
  { pattern: 'diabetes', tests: ['FBS / Fasting Glucose', 'HbA1c', 'Creatinine', 'eGFR', 'Urine Microalbumin'] },
  { pattern: 'anemia', tests: ['CBC', 'Ferritin', 'Iron Studies (TIBC)', 'Vitamin B12', 'Folate', 'Reticulocyte Count'] },
  { pattern: 'pre-operative', tests: ['CBC', 'Coagulation (PT/INR)', 'aPTT', 'Creatinine', 'Electrolytes (Na/K/Cl)', 'FBS / Fasting Glucose'] },
  { pattern: 'preop', tests: ['CBC', 'Coagulation (PT/INR)', 'aPTT', 'Creatinine', 'Electrolytes (Na/K/Cl)', 'FBS / Fasting Glucose'] },
];

/**
 * Resolve a lab order title to matching test items from the checkbox_grid.
 *
 * @param {string} title - The lab_orders.title value
 * @returns {string[]} Array of test item strings matching checkbox_grid items
 */
/**
 * Escape a literal pattern string so it can be embedded in a RegExp source.
 * The mapping table uses safe ASCII patterns today, but punctuation like
 * `19-9` or `(pt/inr)` would still need escaping if the table evolves.
 */
function escapeRe(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a word-boundary-aware regex for a pattern. We treat `[A-Za-z0-9]`
 * characters as part of a word so `alt` matches `alt range` but NOT `salt`
 * or `default`. Patterns that contain non-word characters (spaces, slashes,
 * hyphens) bypass the boundary clamp because their punctuation already
 * disambiguates the match.
 */
function patternToRegex(pattern) {
  const isPureWord = /^[a-z0-9]+$/.test(pattern);
  const escaped = escapeRe(pattern);
  return isPureWord
    ? new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i')
    : new RegExp(escaped, 'i');
}

const COMPILED_PATTERNS = TITLE_TO_TESTS.map((entry) => ({
  ...entry,
  regex: patternToRegex(entry.pattern),
}));

export function resolveLabTests(title) {
  if (!title || typeof title !== 'string') return [];

  const lower = title.toLowerCase().trim();
  if (!lower) return [];

  const matched = new Set();

  for (const entry of COMPILED_PATTERNS) {
    if (entry.regex.test(lower)) {
      for (const test of entry.tests) {
        matched.add(test);
      }
    }
  }

  return [...matched];
}

/**
 * Exported for tests — the raw mapping table.
 * @internal
 */
export { TITLE_TO_TESTS };
