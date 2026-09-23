// ──────────────────────────────────────────────────────────────
// src/product-service/src/models/product.js — Product Data Access
// Purpose: All database operations for the products table.
// Security: ALL queries use parameterised SQL. No string
//           concatenation or template literals for SQL.
// ──────────────────────────────────────────────────────────────

import { pool } from '../lib/db.js';

/**
 * Get all products from the catalogue.
 * @returns {Array} List of all products
 */
export async function findAll() {
  const result = await pool.query(
    'SELECT id, name, description, price, stock, created_at FROM products ORDER BY created_at DESC'
  );
  return result.rows;
}

/**
 * Find a product by its UUID.
 * @param {string} id - Product UUID
 * @returns {object|null} The product or null
 */
export async function findById(id) {
  const result = await pool.query(
    'SELECT id, name, description, price, stock, created_at FROM products WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new product (admin only).
 * @param {object} data - { name, description, price, stock }
 * @returns {object} The created product
 */
export async function create({ name, description, price, stock }) {
  const result = await pool.query(
    `INSERT INTO products (name, description, price, stock)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, price, stock, created_at`,
    [name, description, price, stock]
  );
  return result.rows[0];
}

/**
 * Update product stock (internal use by order-service).
 * Uses a WHERE clause to ensure stock doesn't go negative.
 * @param {string} id - Product UUID
 * @param {number} quantityChange - Negative to decrement, positive to increment
 * @returns {object|null} Updated product or null if insufficient stock
 */
export async function updateStock(id, quantityChange) {
  // The CHECK constraint on the stock column (stock >= 0)
  // provides a database-level guard against negative stock.
  // We also check in the WHERE clause for an application-level guard.
  const result = await pool.query(
    `UPDATE products
     SET stock = stock + $2, updated_at = NOW()
     WHERE id = $1 AND stock + $2 >= 0
     RETURNING id, name, description, price, stock, created_at`,
    [id, quantityChange]
  );
  return result.rows[0] || null;
}
