// ──────────────────────────────────────────────────────────────
// src/order-service/src/routes/order-routes.js — Order Routes
// Purpose: Handle order creation and retrieval. Creating an order
//          calls product-service over HTTP to validate the product
//          exists, has sufficient stock, and to get the current price.
// Security:
//   - Users can only view their own orders (authorisation check)
//   - zod validates all inputs, rejecting unknown fields
//   - Cross-service call validates price/stock at order time
//   - Product name and price are snapshotted (denormalised) so
//     later changes don't retroactively alter order records
// ──────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import * as Order from '../models/order.js';

export const router = Router();

// ── Input validation schemas ────────────────────────────────

const createOrderSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
}).strict();

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
});

// ── POST /orders ────────────────────────────────────────────
// Creates an order after validating the product with product-service.

router.post('/', async (req, res, next) => {
  try {
    // The user ID comes from the x-user-id header, set by the
    // API gateway after JWT verification.
    const userId = req.headers['x-user-id'];
    if (!userId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const { productId, quantity } = createOrderSchema.parse(req.body);

    // ── Cross-service call: validate product exists and has stock ──
    // order-service calls product-service over HTTP to:
    //   1. Confirm the product exists
    //   2. Get the current price (snapshot at order time)
    //   3. Check available stock
    // This is NOT a database join — it's an HTTP call between
    // independently deployed services.
    const productUrl = `${config.PRODUCT_SERVICE_URL}/${productId}`;
    const productResponse = await fetch(productUrl);

    if (!productResponse.ok) {
      const err = new Error('Product not found or unavailable');
      err.statusCode = 404;
      throw err;
    }

    const { data: product } = await productResponse.json();

    // Validate sufficient stock
    if (product.stock < quantity) {
      const err = new Error(`Insufficient stock. Available: ${product.stock}, requested: ${quantity}`);
      err.statusCode = 409;
      throw err;
    }

    // Calculate total price
    const unitPrice = parseFloat(product.price);
    const totalPrice = unitPrice * quantity;

    // Create the order with denormalised product data
    const order = await Order.create({
      userId,
      productId,
      productName: product.name,
      quantity,
      unitPrice,
      totalPrice,
    });

    // ── Decrement stock in product-service ──
    // Call the internal PATCH endpoint to reduce stock.
    // This is eventually consistent — if this call fails,
    // the order exists but stock isn't decremented.
    // A production system would use a saga or outbox pattern.
    try {
      const stockResponse = await fetch(
        `${config.PRODUCT_SERVICE_URL}/${productId}/stock`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: -quantity }),
        }
      );

      if (!stockResponse.ok) {
        // Log the failure but don't fail the order — the order
        // is already created. This is a known limitation.
        logger.warn({
          productId,
          quantity,
          correlationId: req.correlationId,
        }, 'Failed to decrement stock after order creation');
      }
    } catch (stockErr) {
      logger.warn({
        err: stockErr,
        productId,
        correlationId: req.correlationId,
      }, 'Stock decrement call failed');
    }

    logger.info({
      orderId: order.id,
      userId,
      productId,
      quantity,
      totalPrice,
      correlationId: req.correlationId,
    }, 'Order created successfully');

    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
});

// ── GET /orders ─────────────────────────────────────────────
// Returns all orders for the authenticated user.

router.get('/', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const orders = await Order.findByUserId(userId);
    res.status(200).json({ data: orders });
  } catch (err) {
    next(err);
  }
});

// ── GET /orders/:id ─────────────────────────────────────────
// Returns a specific order. Users can only access their own orders.
// Threat mitigated: IDOR (Insecure Direct Object Reference, CWE-639).

router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const { id } = uuidParamSchema.parse(req.params);
    const order = await Order.findById(id);

    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    // Authorisation check: users can only see their own orders.
    // Without this check, any authenticated user could view
    // another user's order by guessing the order ID (IDOR).
    if (order.user_id !== userId) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    res.status(200).json({ data: order });
  } catch (err) {
    next(err);
  }
});
