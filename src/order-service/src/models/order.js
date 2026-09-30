// ──────────────────────────────────────────────────────────────
// src/order-service/src/models/order.js — Order Data Access
// Purpose: All database operations for the orders table.
// Security: ALL queries use parameterised SQL.
// ──────────────────────────────────────────────────────────────

import { pool } from '../lib/db.js';

/**
 * Create a new order.
 * @param {object} data - Order data including user_id, product details, quantity
 * @returns {object} The created order
 */
export async function create({ userId, productId, productName, quantity, unitPrice, totalPrice }) {
  const result = await pool.query(
    `INSERT INTO orders (user_id, product_id, product_name, quantity, unit_price, total_price, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
     RETURNING id, user_id, product_id, product_name, quantity, unit_price, total_price, status, created_at`,
    [userId, productId, productName, quantity, unitPrice, totalPrice]
  );
  return result.rows[0];
}

/**
 * Find all orders for a specific user.
 * Used by GET /orders — users can only see their own orders.
 * @param {string} userId - The user's UUID
 * @returns {Array} List of orders
 */
export async function findByUserId(userId) {
  const result = await pool.query(
    `SELECT id, user_id, product_id, product_name, quantity, unit_price, total_price, status, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Find a single order by ID.
 * @param {string} id - Order UUID
 * @returns {object|null} The order or null
 */
export async function findById(id) {
  const result = await pool.query(
    `SELECT id, user_id, product_id, product_name, quantity, unit_price, total_price, status, created_at
     FROM orders
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
