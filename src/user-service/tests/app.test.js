import { PostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import pg from 'pg';
import * as jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { setTestPool } from '../src/lib/db.js';
import { config } from '../src/config.js';

let container;
let testPool;

beforeAll(async () => {
  // Start postgres container for integration tests
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('usersdb')
    .withUsername('user_svc')
    .withPassword('testpass123')
    .start();

  // Create a connection pool directed to the test container
  testPool = new pg.Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: 'usersdb',
    user: 'user_svc',
    password: 'testpass123',
  });

  // Inject the test pool into the app
  setTestPool(testPool);

  // Initialize the schema
  await testPool.query(`
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'customer',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}, 60000);

afterAll(async () => {
  if (testPool) {
    await testPool.end();
  }
  if (container) {
    await container.stop();
  }
});

beforeEach(async () => {
  // Clear the table before each test
  await testPool.query('TRUNCATE users CASCADE');
});

describe('User Service - Integration & Security Tests', () => {
  
  describe('POST /register', () => {
    it('should successfully register a user', async () => {
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('test@example.com');
      // SECURITY: password should never appear in response body
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should reject SQL-injection-shaped input cleanly without 500 or SQL error text', async () => {
      const res = await request(app)
        .post('/register')
        .send({ email: "' OR '1'='1", password: 'password123' });
        
      // Zod catches invalid email format and returns 400 — no SQL is ever executed.
      // Verify no 500 and no leaked SQL error text.
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.text).not.toContain('syntax error at or near');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/register')
        .send({ email: 'login@example.com', password: 'correcthorse' });
    });

    it('should login and return a JWT', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email: 'login@example.com', password: 'correcthorse' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      await request(app)
        .post('/register')
        .send({ email: 'me@example.com', password: 'mypassword' });
        
      const res = await request(app)
        .post('/login')
        .send({ email: 'me@example.com', password: 'mypassword' });
        
      token = res.body.data.token;
      userId = res.body.data.user.id;
    });

    it('should return user details', async () => {
      // In this architecture, the API gateway verifies the JWT and forwards identity headers.
      const res = await request(app)
        .get('/me')
        .set('x-user-id', userId)
        .set('x-user-email', 'me@example.com')
        .set('x-user-role', 'customer');

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('me@example.com');
      // SECURITY: no password hash exposed
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should return 401 if x-user-id header is missing (auth omitted)', async () => {
      const res = await request(app)
        .get('/me');
      
      expect(res.status).toBe(401);
    });
  });

  describe('Health Probes', () => {
    it('GET /health returns 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });

    it('GET /ready returns 200 when DB is up', async () => {
      const res = await request(app).get('/ready');
      expect(res.status).toBe(200);
    });
  });
});
