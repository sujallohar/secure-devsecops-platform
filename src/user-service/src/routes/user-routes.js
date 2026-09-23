// ──────────────────────────────────────────────────────────────
// src/user-service/src/routes/user-routes.js — User Routes
// Purpose: Handle user registration, login, and profile retrieval.
// Security:
//   - bcrypt cost factor 12 for password hashing
//   - JWT issuance with HS256, 15-min expiry, iss + aud claims
//   - zod validation on every route rejects unknown fields
//   - Passwords never returned in responses or logged
// ──────────────────────────────────────────────────────────────

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import * as User from '../models/user.js';

export const router = Router();

// ── Input validation schemas ────────────────────────────────

// .strict() rejects any fields not defined in the schema.
// Threat mitigated: mass assignment / parameter pollution.
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'), // bcrypt limit
}).strict();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict();

// ── POST /register ──────────────────────────────────────────

router.post('/register', async (req, res, next) => {
  try {
    // Validate input — rejects unknown fields
    const { email, password } = registerSchema.parse(req.body);

    // Check if user already exists
    const existing = await User.findByEmail(email);
    if (existing) {
      // Return a generic message to avoid user enumeration.
      // Threat mitigated: user enumeration via registration (CWE-204).
      // An attacker shouldn't be able to determine which emails
      // are registered by observing different error messages.
      const err = new Error('Registration failed');
      err.statusCode = 409;
      throw err;
    }

    // Hash password with bcrypt cost factor 12.
    // Cost 12 = 2^12 = 4096 iterations. This makes brute-force
    // attacks against stolen hashes computationally expensive.
    // Threat mitigated: offline password cracking (CWE-916).
    const BCRYPT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user — the plaintext password is never stored
    const user = await User.create(email, hashedPassword);

    logger.info({ userId: user.id, correlationId: req.correlationId },
      'User registered successfully');

    // Return created user without password
    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /login ─────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    // Validate input
    const { email, password } = loginSchema.parse(req.body);

    // Look up user by email
    const user = await User.findByEmail(email);

    if (!user) {
      // Use the same error message whether the email exists or not.
      // Threat mitigated: user enumeration via login (CWE-204).
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Compare plaintext password against stored bcrypt hash.
    // bcrypt.compare is timing-safe, preventing timing attacks.
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Issue a JWT with specific claims:
    //   sub: user ID (who the token is about)
    //   email: for display purposes
    //   role: for authorisation decisions
    //   iss: identifies this service as the token issuer
    //   aud: identifies the intended audience
    //   exp: 15 minutes (short-lived to limit window if stolen)
    // Algorithm: HS256 (HMAC-SHA256) with a symmetric secret.
    // Threat mitigated: algorithm confusion attacks by pinning to HS256.
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      config.JWT_SECRET,
      {
        algorithm: 'HS256',           // pinned — prevents alg:none attack
        expiresIn: config.JWT_EXPIRY, // 15m default
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      }
    );

    logger.info({ userId: user.id, correlationId: req.correlationId },
      'User logged in successfully');

    // Return the token. The password is never included.
    res.status(200).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /me ─────────────────────────────────────────────────
// Returns the authenticated user's profile.
// The user ID comes from the x-user-id header set by the API
// gateway after JWT verification. See trust assumption note
// in the gateway middleware.

router.get('/me', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];

    if (!userId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const user = await User.findById(userId);

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});
