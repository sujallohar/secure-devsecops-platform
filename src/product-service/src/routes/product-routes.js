// ──────────────────────────────────────────────────────────────
// src/product-service/src/routes/product-routes.js — Product Routes
// Purpose: CRUD operations for the product catalogue.
// Security:
//   - zod validation on all inputs, rejecting unknown fields
//   - POST /products restricted to admin role (via x-user-role header)
//   - PATCH /products/:id/stock is internal-only (no gateway route)
//   - Parameterised SQL in the model layer
// ──────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import * as Product from '../models/product.js';

export const router = Router();

// ── Input validation schemas ────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(1000).optional().default(''),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().nonnegative('Stock must be non-negative').default(0),
}).strict();

const updateStockSchema = z.object({
  quantity: z.number().int('Quantity must be an integer'),
}).strict();

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

// ── GET /products ───────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const products = await Product.findAll();
    res.status(200).json({ data: products });
  } catch (err) {
    next(err);
  }
});

// ── GET /products/:id ───────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const product = await Product.findById(id);

    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({ data: product });
  } catch (err) {
    next(err);
  }
});

// ── POST /products (admin only) ─────────────────────────────
// The x-user-role header is set by the API gateway after JWT
// verification. Only users with role 'admin' can create products.

router.post('/', async (req, res, next) => {
  try {
    // Check admin role from gateway-forwarded header
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'admin') {
      const err = new Error('Admin access required');
      err.statusCode = 403;
      throw err;
    }

    const data = createProductSchema.parse(req.body);
    const product = await Product.create(data);

    logger.info({
      productId: product.id,
      correlationId: req.correlationId,
    }, 'Product created');

    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /products/:id/stock (internal only) ───────────────
// Called by order-service to decrement stock after an order.
// This route is NOT exposed through the API gateway — it is
// accessible only within the cluster network.

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const { quantity } = updateStockSchema.parse(req.body);

    const product = await Product.updateStock(id, quantity);

    if (!product) {
      const err = new Error('Insufficient stock or product not found');
      err.statusCode = 409;
      throw err;
    }

    logger.info({
      productId: id,
      stockChange: quantity,
      newStock: product.stock,
      correlationId: req.correlationId,
    }, 'Stock updated');

    res.status(200).json({ data: product });
  } catch (err) {
    next(err);
  }
});
