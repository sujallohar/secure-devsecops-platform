// ──────────────────────────────────────────────────────────────
// src/user-service/src/models/user.js — User Data Access Layer
// Purpose: All database operations for the users table.
// Security: ALL queries use parameterised SQL ($1, $2, ...).
//           String concatenation or template literals are NEVER
//           used to build SQL. This is the primary defence against
//           SQL injection (CWE-89). Even if input validation
//           fails to catch a malicious input, parameterised
//           queries ensure it is treated as data, not code.
// ──────────────────────────────────────────────────────────────

import { pool } from '../lib/db.js';

/**
 * Find a user by email address.
 * Used during login to retrieve the stored password hash.
 * @param {string} email - The email to look up
 * @returns {object|null} The user row or null if not found
 */
export async function findByEmail(email) {
  // Parameterised query: $1 is replaced by the pg driver safely
  const result = await pool.query(
    'SELECT id, email, password, role, created_at FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by their UUID.
 * Used by GET /me to retrieve the authenticated user's profile.
 * @param {string} id - The user's UUID
 * @returns {object|null} The user row (without password) or null
 */
export async function findById(id) {
  const result = await pool.query(
    'SELECT id, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new user with a pre-hashed password.
 * The password is hashed with bcrypt BEFORE reaching this function.
 * @param {string} email - The user's email
 * @param {string} hashedPassword - bcrypt hash (never plaintext)
 * @param {string} role - User role (default: 'customer')
 * @returns {object} The created user row (without password)
 */
export async function create(email, hashedPassword, role = 'customer') {
  const result = await pool.query(
    `INSERT INTO users (email, password, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, created_at`,
    [email, hashedPassword, role]
  );
  return result.rows[0];
}
