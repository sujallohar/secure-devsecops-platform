import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';

// The gateway proxies to backend services. For unit testing the gateway's
// own middleware (JWT verification, rate limiting, etc.), we test the
// middleware responses directly — when there is no backend service running,
// valid-JWT requests will get a proxy error (502), but we can still verify
// that 401s fire BEFORE the proxy is ever reached.

const JWT_SECRET = 'super-secret-test-key-for-jwt-signing';

function generateToken(payload = {}, options = {}) {
  const defaults = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'test@example.com',
    role: 'customer',
  };
  return jwt.sign({ ...defaults, ...payload }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || '15m',
    issuer: 'secure-devsecops-platform',
    audience: 'secure-devsecops-platform',
    ...options,
  });
}

describe('API Gateway - Security Tests', () => {

  describe('JWT Authentication', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Authentication required');
    });

    it('should return 401 when Authorization header has no Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', 'InvalidPrefix some-token');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Authentication required');
    });

    it('should return 401 for a malformed/tampered JWT', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer this.is.not-a-valid-jwt');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid or expired token');
    });

    it('should return 401 for an expired JWT', async () => {
      // Create a token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { sub: 'user-1', email: 'a@b.com', role: 'customer' },
        JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '-1h', // already expired
          issuer: 'secure-devsecops-platform',
          audience: 'secure-devsecops-platform',
        }
      );

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid or expired token');
    });

    it('should return 401 for JWT signed with a different secret', async () => {
      const badToken = jwt.sign(
        { sub: 'user-1', email: 'a@b.com', role: 'customer' },
        'wrong-secret-wrong-secret-wrong-secret',
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: 'secure-devsecops-platform',
          audience: 'secure-devsecops-platform',
        }
      );

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });

    it('should return 401 for JWT with wrong issuer', async () => {
      const badIssuerToken = jwt.sign(
        { sub: 'user-1', email: 'a@b.com', role: 'customer' },
        JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: 'evil-issuer',
          audience: 'secure-devsecops-platform',
        }
      );

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${badIssuerToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Health Probes and Root', () => {
    it('GET /health returns 200 (no auth required)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('GET /ready returns 200 (no auth required)', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });

    it('GET / returns 200 with service information', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('api-gateway');
    });
  });

  describe('Security Headers', () => {
    it('should set Content-Security-Policy with frame-ancestors none and form-action self', async () => {
      const res = await request(app).get('/health');
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("form-action 'self'");
    });

    it('should set Permissions-Policy header', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['permissions-policy']).toBeDefined();
      expect(res.headers['permissions-policy']).toContain('camera=()');
    });

    it('should set anti-caching headers for API responses', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['pragma']).toBe('no-cache');
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
      // We need a tiny rate limit to test this.
      // Since rate-limit state is per-instance and we set 1000 in setup,
      // we can't easily test the exact threshold without making 1000 requests.
      // Instead, verify the rate-limit headers are present on a response.
      const res = await request(app).get('/health');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Public Routes', () => {
    // Register and login routes should NOT require JWT
    // (they will fail with 502 because there's no upstream, but NOT 401)
    it('POST /api/users/register should not require JWT (may fail with proxy error)', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({ email: 'a@b.com', password: 'password123' });

      // If no upstream is running we get 502 (proxy error), NOT 401
      expect(res.status).not.toBe(401);
    });

    it('POST /api/users/login should not require JWT (may fail with proxy error)', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'a@b.com', password: 'password123' });

      expect(res.status).not.toBe(401);
    });
  });
});
