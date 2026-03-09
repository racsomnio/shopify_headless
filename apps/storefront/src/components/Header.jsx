import { useState } from 'react';
import { useCustomer } from '../hooks/useCustomer.js';

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: '#0f0f0f',
    color: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', textDecoration: 'none' },
  nav: { display: 'flex', gap: '2rem', alignItems: 'center' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '0.875rem' },
  cartBtn: {
    background: '#2ECC71',
    color: '#fff',
    border: 'none',
    borderRadius: '2rem',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  badge: {
    background: '#fff',
    color: '#0f0f0f',
    borderRadius: '50%',
    width: '1.25rem',
    height: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  loginBtn: {
    background: 'transparent',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '2rem',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
  },
  accountArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  customerName: {
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  logoutBtn: {
    background: 'transparent',
    color: '#888',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '0.25rem 0.5rem',
  },
};

export function Header({ itemCount = 0, onCartOpen }) {
  const { customer, loggedIn, loading, login, logout } = useCustomer();
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      await login();
    } catch (err) {
      console.error('Login error:', err.message);
      setLoggingIn(false);
    }
  };

  return (
    <header style={styles.header}>
      <a href="/" style={styles.logo}>My Store</a>

      <nav style={styles.nav}>
        <a href="/" style={styles.navLink}>Products</a>
        <a href="#" style={styles.navLink}>About</a>
        <a href="#" style={styles.navLink}>Support</a>

        {/* Account area */}
        {loggedIn ? (
          <div style={styles.accountArea}>
            <a href="/account" style={{ ...styles.customerName, textDecoration: 'none' }}>
              {loading
                ? 'Loading…'
                : customer
                  ? `Hi, ${customer.firstName || customer.emailAddress?.emailAddress || 'there'}`
                  : 'My Account'}
            </a>
            <button style={styles.logoutBtn} onClick={logout}>
              Log out
            </button>
          </div>
        ) : (
          <button
            style={styles.loginBtn}
            onClick={handleLogin}
            disabled={loggingIn || loading}
          >
            {loggingIn ? 'Redirecting…' : 'Log in'}
          </button>
        )}

        {/* Cart */}
        <button style={styles.cartBtn} onClick={onCartOpen}>
          Cart
          {itemCount > 0 && <span style={styles.badge}>{itemCount}</span>}
        </button>
      </nav>
    </header>
  );
}
