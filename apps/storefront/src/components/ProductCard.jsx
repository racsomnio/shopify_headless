const styles = {
  card: {
    background: '#fff',
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  image: {
    width: '100%',
    aspectRatio: '4/3',
    objectFit: 'cover',
    background: '#f0f0ea',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: '4/3',
    background: 'linear-gradient(135deg, #f0f0ea 0%, #e0e0d8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
  },
  body: { padding: '1.25rem' },
  title: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' },
  price: { color: '#2ECC71', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' },
  badge: {
    display: 'inline-block',
    background: '#f0f9f4',
    color: '#2ECC71',
    borderRadius: '1rem',
    padding: '0.125rem 0.625rem',
    fontSize: '0.7rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  unavailableBadge: {
    display: 'inline-block',
    background: '#fff0f0',
    color: '#e53e3e',
    borderRadius: '1rem',
    padding: '0.125rem 0.625rem',
    fontSize: '0.7rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  addBtn: {
    width: '100%',
    padding: '0.75rem',
    background: '#0f0f0f',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'background 0.15s',
  },
  addBtnDisabled: {
    width: '100%',
    padding: '0.75rem',
    background: '#ccc',
    color: '#888',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'not-allowed',
    fontSize: '0.875rem',
  },
};

/**
 * ProductCard — displays a single Shopify product
 *
 * @param {object} product - from Storefront API products query
 * @param {Function} onAddToCart - (variantId) => void
 * @param {boolean} loading - cart loading state
 */
export function ProductCard({ product, onAddToCart, loading }) {
  const price  = product.priceRange?.minVariantPrice;
  const inStock = product.availableForSale;

  // Default to first available variant
  const firstAvailableVariant = product.variants?.edges
    ?.find(e => e.node.availableForSale)?.node
    ?? product.variants?.edges?.[0]?.node;

  const formatted = price
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currencyCode }).format(price.amount)
    : 'Price unavailable';

  return (
    <div style={styles.card}>
      {product.featuredImage?.url ? (
        <img
          src={product.featuredImage.url}
          alt={product.featuredImage.altText || product.title}
          style={styles.image}
          loading="lazy"
        />
      ) : (
        <div style={styles.imagePlaceholder}>📦</div>
      )}

      <div style={styles.body}>
        <span style={inStock ? styles.badge : styles.unavailableBadge}>
          {inStock ? 'In Stock' : 'Out of Stock'}
        </span>
        <div style={styles.title}>{product.title}</div>
        <div style={styles.price}>{formatted}</div>

        <button
          style={inStock && firstAvailableVariant ? styles.addBtn : styles.addBtnDisabled}
          disabled={!inStock || !firstAvailableVariant || loading}
          onClick={() => firstAvailableVariant && onAddToCart(firstAvailableVariant.id)}
        >
          {loading ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
