// ──────────────────────────────────────────────────────────────
// DELIBERATELY INSECURE — This file exists ONLY to demonstrate
// that our Semgrep custom rules detect real vulnerabilities.
// This file will be committed on the scratch/sast-test branch,
// shown to trigger the Semgrep scan failure, then reverted.
//
// DO NOT use any of these patterns in production code.
// ──────────────────────────────────────────────────────────────

import pg from 'pg';

const pool = new pg.Pool();

// VULNERABLE: SQL injection via template literal concatenation
// Our custom rule "custom-sql-string-concatenation" should catch this.
// CWE-89: An attacker could supply userId = "'; DROP TABLE users; --"
// and the query would execute arbitrary SQL.
async function getUser(userId) {
  const result = await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
  return result.rows[0];
}

export { getUser };
