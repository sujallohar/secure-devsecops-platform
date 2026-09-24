import { PostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import pg from 'pg';
import nock from 'nock';
import { app } from '../src/app.js';
import { setTestPool } from '../src/lib/db.js';

let container;
let testPool;

const FAKE_USER_A = '11111111-1111-1111-1111-111111111111';
const FAKE_USER_B = '22222222-2222-2222-2222-222222222222';
const FAKE_PRODUCT_ID = '33333333-3333-3333-3333-333333333333';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('ordersdb')
    .withUsername('order_svc')
    .withPassword('testpass123')
    .start();

  testPool = new pg.Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: 'ordersdb',
    user: 'order_svc',
    password: 'testpass123',
  });

  setTestPool(testPool);

  // Create schema matching db/init/01-init.sh
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL,
      product_id   UUID NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity     INTEGER NOT NULL CHECK (quantity > 0),
      unit_price   DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
      total_price  DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
      status       VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}, 60000);

afterAll(async () => {
  nock.cleanAll();
  nock.restore();
  if (testPool) await testPool.end();
  if (container) await container.stop();
});

beforeEach(async () => {
  await testPool.query('TRUNCATE orders CASCADE');
  nock.cleanAll();
});

// Helper: mock the product-service HTTP calls for order creation
function mockProductService(stock = 50) {
  // Mock GET /products/:id (fetch product details)
  nock('http://localhost:3002')
    .get(`/products/${FAKE_PRODUCT_ID}`)
    .reply(200, {
      data: {
        id: FAKE_PRODUCT_ID,
        name: 'Test Product',
        price: '25.00',
        stock,
      },
    });

  // Mock PATCH /products/:id/stock (decrement stock)
  nock('http://localhost:3002')
    .patch(`/products/${FAKE_PRODUCT_ID}/stock`)
    .reply(200, {
      data: {
        id: FAKE_PRODUCT_ID,
        name: 'Test Product',
        price: '25.00',
        stock: stock - 2,
      },
    });
}

describe('Order Service - Integration & Security Tests', () => {

  describe('POST / (create order)', () => {
    it('should create an order for an authenticated user', async () => {
      mockProductService(50);

      const res = await request(app)
        .post('/')
        .set('x-user-id', FAKE_USER_A)
        .send({ productId: FAKE_PRODUCT_ID, quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body.data.user_id).toBe(FAKE_USER_A);
      expect(res.body.data.product_name).toBe('Test Product');
      expect(res.body.data.quantity).toBe(2);
      expect(res.body.data.total_price).toBe('50.00');
    });

    it('should return 401 if x-user-id header is missing', async () => {
      const res = await request(app)
        .post('/')
        .send({ productId: FAKE_PRODUCT_ID, quantity: 1 });

      expect(res.status).toBe(401);
    });

    it('should return 409 for insufficient stock', async () => {
      mockProductService(1); // only 1 in stock

      const res = await request(app)
        .post('/')
        .set('x-user-id', FAKE_USER_A)
        .send({ productId: FAKE_PRODUCT_ID, quantity: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Insufficient stock');
    });
  });

  describe('GET / (list orders)', () => {
    beforeEach(async () => {
      // Insert orders directly for user A and user B
      await testPool.query(`
        INSERT INTO orders (user_id, product_id, product_name, quantity, unit_price, total_price, status)
        VALUES
          ($1, $2, 'Product X', 1, 10.00, 10.00, 'confirmed'),
          ($3, $2, 'Product Y', 2, 20.00, 40.00, 'confirmed')
      `, [FAKE_USER_A, FAKE_PRODUCT_ID, FAKE_USER_B]);
    });

    it('should return only the authenticated user orders', async () => {
      const res = await request(app)
        .get('/')
        .set('x-user-id', FAKE_USER_A);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].user_id).toBe(FAKE_USER_A);
    });
  });

  describe('GET /:id (get order by ID)', () => {
    let orderIdA;

    beforeEach(async () => {
      const { rows } = await testPool.query(`
        INSERT INTO orders (user_id, product_id, product_name, quantity, unit_price, total_price, status)
        VALUES ($1, $2, 'Widget', 3, 15.00, 45.00, 'confirmed')
        RETURNING id
      `, [FAKE_USER_A, FAKE_PRODUCT_ID]);
      orderIdA = rows[0].id;
    });

    it('should return order for the owning user', async () => {
      const res = await request(app)
        .get(`/${orderIdA}`)
        .set('x-user-id', FAKE_USER_A);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderIdA);
    });

    it('SECURITY (IDOR): should return 403 when a different user tries to access the order', async () => {
      const res = await request(app)
        .get(`/${orderIdA}`)
        .set('x-user-id', FAKE_USER_B);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Access denied');
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .get('/00000000-0000-0000-0000-000000000000')
        .set('x-user-id', FAKE_USER_A);

      expect(res.status).toBe(404);
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
