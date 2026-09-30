import React, { useState, useEffect } from 'react';

// API base defaults to relative path /api so it works seamlessly behind
// both Vite dev proxy and Nginx reverse proxy.
const API_BASE = '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('products');
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Auth form states
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState('customer');

  // Admin new product form
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductPrice, setNewProductPrice] = useState(29.99);
  const [newProductStock, setNewProductStock] = useState(50);

  // Helper to show message banner
  const showNotice = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Helper for authenticated fetch
  const authFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
    return fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  };

  // Fetch current user details when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      localStorage.removeItem('token');
      return;
    }
    localStorage.setItem('token', token);
    authFetch('/users/me')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || data);
        } else {
          // Token expired or invalid
          setToken('');
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      });
  }, [token]);

  // Load products catalogue
  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  // Load user orders
  const loadOrders = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await authFetch('/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || data || []);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, token]);

  // Handle Authentication (Login / Register)
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/users/login' : '/users/register';
      const body = authMode === 'login' 
        ? { email, password } 
        : { email, password, role };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Authentication failed');
      }

      if (authMode === 'register') {
        showNotice('Registration successful! Please log in.', 'success');
        setAuthMode('login');
      } else {
        setToken(data.token);
        showNotice(`Welcome back! Logged in as ${data.user?.email || email}`, 'success');
        setActiveTab('products');
      }
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Place Order
  const handlePlaceOrder = async (productId, quantity = 1) => {
    if (!token) {
      showNotice('Please log in first to place an order.', 'error');
      setActiveTab('auth');
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ productId, quantity }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Order creation failed');
      }
      showNotice(`Order #${data.order?.id?.slice(0, 8)} placed successfully!`, 'success');
      loadProducts(); // Refresh stock
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Add Product
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!token) {
      showNotice('Admin authorization required', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: newProductName,
          description: newProductDesc,
          price: parseFloat(newProductPrice),
          stock: parseInt(newProductStock, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to create product');
      }
      showNotice(`Product "${newProductName}" added successfully!`, 'success');
      setNewProductName('');
      setNewProductDesc('');
      loadProducts();
      setActiveTab('products');
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <div>
            <h1 className="app-title">SecureStore DevSecOps</h1>
            <p className="app-subtitle">Zero-Trust Microservices Architecture</p>
          </div>
        </div>

        <div className="user-status">
          {user ? (
            <>
              <span className={`badge ${user.role === 'admin' ? 'badge-amber' : 'badge-green'}`}>
                ● {user.email} ({user.role})
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setToken('')}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('auth')}
            >
              Sign In / Register
            </button>
          )}
        </div>
      </header>

      {/* Security Architecture Callout */}
      <div className="security-banner">
        <svg className="security-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <div className="security-banner-text">
          <strong>Defense-in-Depth Active:</strong> Requests route through API Gateway with Helmet, strict CORS, and rate limiting. JWTs use HS256 with 15-min expiry. Services run as non-root (UID 10001) in hardened containers.
        </div>
      </div>

      {/* Notice / Toast */}
      {message && (
        <div className={`toast toast-${message.type}`}>
          <span>{message.text}</span>
          <button 
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => setMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Nav Tabs */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          🛍️ Products Catalogue ({products.length})
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📦 My Orders {orders.length > 0 && `(${orders.length})`}
        </button>
        {user?.role === 'admin' && (
          <button 
            className={`nav-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            ⚙️ Admin Panel
          </button>
        )}
        <button 
          className={`nav-tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => setActiveTab('auth')}
        >
          🔑 Authentication
        </button>
        <button 
          className={`nav-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          🛡️ Security Telemetry
        </button>
      </nav>

      {/* TAB 1: Products Catalogue */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Available Products</h2>
            <button className="btn btn-secondary" onClick={loadProducts} disabled={loading}>
              ↻ Refresh Catalogue
            </button>
          </div>

          {products.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                No products found in the database.
              </p>
              {user?.role === 'admin' && (
                <button className="btn btn-primary" onClick={() => setActiveTab('admin')}>
                  Add First Product
                </button>
              )}
            </div>
          ) : (
            <div className="grid-products">
              {products.map((p) => (
                <div key={p.id} className="product-card">
                  <div>
                    <div className="product-header">
                      <h3 className="product-name">{p.name}</h3>
                      <p className="product-desc">{p.description || 'No description provided.'}</p>
                    </div>
                  </div>
                  <div>
                    <div className="product-meta">
                      <span className="product-price">${Number(p.price).toFixed(2)}</span>
                      <span className="stock-tag">
                        {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%' }}
                      disabled={loading || p.stock <= 0}
                      onClick={() => handlePlaceOrder(p.id, 1)}
                    >
                      {p.stock > 0 ? 'Buy 1 Now' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Orders */}
      {activeTab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="card-title">My Orders History</h2>
            <button className="btn btn-secondary" onClick={loadOrders} disabled={loading}>
              ↻ Refresh Orders
            </button>
          </div>

          {!token ? (
            <p style={{ color: 'var(--text-secondary)' }}>
              Please <button className="btn btn-primary" style={{ padding: '2px 8px', margin: '0 4px' }} onClick={() => setActiveTab('auth')}>log in</button> to view your order history.
            </p>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>You haven't placed any orders yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Created At</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><code>{o.id.slice(0, 13)}...</code></td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>${Number(o.total_amount).toFixed(2)}</td>
                    <td>
                      <span className="badge badge-green">
                        {o.status || 'confirmed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: Admin */}
      {activeTab === 'admin' && (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 className="card-title">Add New Product (Admin Only)</h2>
          <form onSubmit={handleCreateProduct}>
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input 
                className="form-input" 
                value={newProductName} 
                onChange={(e) => setNewProductName(e.target.value)} 
                placeholder="e.g. YubiKey 5C NFC" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-input" 
                style={{ resize: 'vertical', minHeight: 80 }}
                value={newProductDesc} 
                onChange={(e) => setNewProductDesc(e.target.value)} 
                placeholder="Hardware security key for multi-factor authentication" 
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Price (USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={newProductPrice} 
                  onChange={(e) => setNewProductPrice(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Initial Stock</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={newProductStock} 
                  onChange={(e) => setNewProductStock(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              Create Product
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Authentication */}
      {activeTab === 'auth' && (
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button 
              className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setAuthMode('login')}
            >
              Sign In
            </button>
            <button 
              className={`btn ${authMode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setAuthMode('register')}
            >
              Register New
            </button>
          </div>

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>

            {authMode === 'register' && (
              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select 
                  className="form-input" 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin (Catalogue Manager)</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {authMode === 'login' ? 'Authenticate' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 8 }}><strong>Quick Demo Presets:</strong></p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => { setEmail('alice@example.com'); setPassword('Password123!'); setRole('customer'); }}
              >
                Alice (Customer)
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={() => { setEmail('admin@example.com'); setPassword('AdminPass123!'); setRole('admin'); }}
              >
                Admin User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Telemetry & Security Overview */}
      {activeTab === 'telemetry' && (
        <div className="grid-cols-2">
          <div className="card">
            <h2 className="card-title">Active Security State</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gateway Host:</span>
                <code>http://localhost:3000</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Authentication:</span>
                <span>{token ? '✅ Bearer JWT Attached' : '❌ Unauthenticated'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Active Identity:</span>
                <span>{user ? `${user.email} [${user.role}]` : 'Guest'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Token Expiry:</span>
                <span>15 Minutes (HS256)</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Decoded JWT Token</h2>
            {token ? (
              <pre className="code-block">
                {JSON.stringify(
                  (() => {
                    try {
                      return JSON.parse(atob(token.split('.')[1]));
                    } catch {
                      return { error: 'Invalid token format' };
                    }
                  })(),
                  null,
                  2
                )}
              </pre>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No token present in storage. Sign in to view claims.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
