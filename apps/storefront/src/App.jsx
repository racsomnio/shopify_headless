import { useState } from 'react';
import { Header } from './components/Header.jsx';
import { ProductCard } from './components/ProductCard.jsx';
import { Cart } from './components/Cart.jsx';
import { AuthCallback } from './components/AuthCallback.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { useProducts } from './hooks/useProducts.js';
import { useCart } from './hooks/useCart.js';

const styles = {
  main: { minHeight: '100vh' },
  hero: {
    background: 'linear-gradient(135deg, #0f0f0f 0%, #1a2f1a 100%)',
    color: '#fff',
    padding: '6rem 2rem 4rem',
    textAlign: 'center',
  },
  heroTag: {
    display: 'inline-block',
    background: 'rgba(46,204,113,0.2)',
    color: '#2ECC71',
    borderRadius: '2rem',
    padding: '0.25rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '1.5rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 'clamp(2.5rem, 6vw, 5rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '1.5rem',
  },
  heroSub: { color: '#ccc', fontSize: '1.1rem', maxWidth: '560px', margin: '0 auto 2.5rem' },
  shopBtn: {
    background: '#2ECC71', color: '#fff', border: 'none',
    borderRadius: '3rem', padding: '1rem 2.5rem',
    fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
  },
  products: { padding: '4rem 2rem' },
  sectionTitle: { fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loadMore: {
    display: 'block',
    margin: '3rem auto 0',
    padding: '0.875rem 2.5rem',
    background: '#fff',
    color: '#0f0f0f',
    border: '2px solid #0f0f0f',
    borderRadius: '3rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBox: {
    background: '#fff0f0', color: '#c53030', borderRadius: '0.75rem',
    padding: '1.5rem', margin: '2rem auto', maxWidth: '600px', textAlign: 'center',
  },
  loading: { textAlign: 'center', padding: '4rem', color: '#666' },
};

export default function App() {
  const { pathname } = window.location;
  if (pathname === '/auth/callback') return <AuthCallback />;
  if (pathname === '/account')       return <AccountPage />;
  return <Store />;
}

function Store() {
  const { products, loading, error, pageInfo, loadMore } = useProducts(12);
  const { lineItems, total, loading: cartLoading, error: cartError, addItem, removeItem, checkout, itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div style={styles.main}>
      <Header itemCount={itemCount} onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroTag}>New Arrivals</div>
        <h1 style={styles.heroTitle}>
          Shop our products.
        </h1>
        <p style={styles.heroSub}>
          Browse our full collection and find what you need.
        </p>
        <button style={styles.shopBtn} onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
          Shop Now
        </button>
      </section>

      {/* Products */}
      <section style={styles.products} id="products">
        <h2 style={styles.sectionTitle}>Our Products</h2>

        {error && (
          <div style={styles.errorBox}>
            <strong>Could not load products</strong><br />{error}
          </div>
        )}

        {loading && products.length === 0 && (
          <div style={styles.loading}>Loading products…</div>
        )}

        <div style={styles.grid}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={(variantId) => {
                addItem(variantId, 1);
                setCartOpen(true);
              }}
              loading={cartLoading}
            />
          ))}
        </div>

        {pageInfo.hasNextPage && (
          <button style={styles.loadMore} onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>

      <Cart
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        lineItems={lineItems}
        total={total}
        loading={cartLoading}
        onRemove={removeItem}
        onCheckout={checkout}
      />
    </div>
  );
}
