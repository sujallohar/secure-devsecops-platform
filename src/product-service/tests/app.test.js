import { PostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import pg from 'pg';
import { app } from '../src/app.js';
import { setTestPool } from '../src/lib/db.js';

let container;
let testPool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('productsdb')
    .withUsername('product_svc')
    .withPassword('testpass123')
    .start();

  testPool = new pg.Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: 'productsdb',
    user: 'product_svc',
    password: 'testpass123',
  });

  setTestPool(testPool);

  // Create schema matching db/init/01-init.sh
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      price       DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
      stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}, 60000);

afterAll(async () => {
  if (testPool) await testPool.end();
  if (container) await container.stop();
});

beforeEach(async () => {
  await testPool.query('TRUNCATE products CASCADE');
});

describe('Product Service - Integration & Security Tests', () => {

  describe('POST / (create product - admin only)', () => {
    it('should create a product when user has admin role', async () => {
      const res = await request(app)
        .post('/')
        .set('x-user-role', 'admin')
        .send({ name: 'Widget', description: 'A test widget', price: 9.99, stock: 100 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Widget');
      expect(res.body.data.price).toBe('9.99');
      expect(res.body.data.stock).toBe(100);
    });

    it('SECURITY: should return 403 when non-admin tries to create a product', async () => {
      const res = await request(app)
        .post('/')
        .set('x-user-role', 'customer')
        .send({ name: 'Hack', price: 1.00, stock: 1 });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Admin');
    });

    it('SECURITY: should return 403 when no role header is present', async () => {
      const res = await request(app)
        .post('/')
        .send({ name: 'Hack', price: 1.00, stock: 1 });

      expect(res.status).toBe(403);
    });

    it('SECURITY: SQL injection via name field is safely parameterised', async () => {
      const res = await request(app)
        .post('/')
        .set('x-user-role', 'admin')
        .send({
          name: "'; DROP TABLE products; --",
          price: 1.00,
          stock: 1,
        });

      // The SQL injection string is treated as a literal product name
      // due to parameterised queries — the table still exists.
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("'; DROP TABLE products; --");

      // Verify the table wasn't dropped
      const { rows } = await testPool.query('SELECT count(*) FROM products');
      expect(parseInt(rows[0].count)).toBe(1);
    });
  });

  describe('GET / (list products)', () => {
    beforeEach(async () => {
      // Seed two products directly via SQL
      await testPool.query(`
        INSERT INTO products (name, description, price, stock) VALUES
        ('Product A', 'Desc A', 19.99, 50),
        ('Product B', 'Desc B', 29.99, 30);
      `);
    });

    it('should return all products', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /:id (get product by ID)', () => {
    let productId;

    beforeEach(async () => {
      const { rows } = await testPool.query(
        "INSERT INTO products (name, price, stock) VALUES ('Test', 5.00, 10) RETURNING id"
      );
      productId = rows[0].id;
    });

    it('should return a product by valid UUID', async () => {
      const res = await request(app).get(`/${productId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test');
    });

    it('should return 404 for non-existent UUID', async () => {
      const res = await request(app).get('/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const res = await request(app).get('/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /:id/stock (update stock - internal)', () => {
    let productId;

    beforeEach(async () => {
      const { rows } = await testPool.query(
        "INSERT INTO products (name, price, stock) VALUES ('Stockable', 10.00, 20) RETURNING id"
      );
      productId = rows[0].id;
    });

    it('should decrement stock', async () => {
      const res = await request(app)
        .patch(`/${productId}/stock`)
        .send({ quantity: -5 });

      expect(res.status).toBe(200);
      expect(res.body.data.stock).toBe(15);
    });

    it('should return 409 if stock would go negative', async () => {
      const res = await request(app)
        .patch(`/${productId}/stock`)
        .send({ quantity: -25 });

      expect(res.status).toBe(409);
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
