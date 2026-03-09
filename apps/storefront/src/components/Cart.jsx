const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 200,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    background: '#fff',
    width: '420px',
    maxWidth: '100vw',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: '1.2rem', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#666' },
  items: { flex: 1, overflowY: 'auto', padding: '1rem' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', color: '#888', gap: '1rem',
  },
  lineItem: {
    display: 'flex', gap: '1rem', alignItems: 'center',
    padding: '1rem 0', borderBottom: '1px solid #f5f5f0',
  },
  itemImage: { width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0.5rem', background: '#f0f0ea' },
  itemInfo: { flex: 1 },
  itemTitle: { fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' },
  itemVariant: { color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' },
  itemPrice: { color: '#2ECC71', fontWeight: 700, fontSize: '0.875rem' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1.2rem' },
  footer: {
    padding: '1.5rem',
    borderTop: '1px solid #f0f0f0',
  },
  subtotal: {
    display: 'flex', justifyContent: 'space-between',
    marginBottom: '1rem', fontWeight: 600, fontSize: '1rem',
  },
  checkoutBtn: {
    width: '100%', padding: '1rem',
    background: '#0f0f0f', color: '#fff',
    border: 'none', borderRadius: '0.75rem',
    fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
    transition: 'background 0.15s',
  },
};

export function Cart({ isOpen, onClose, lineItems, total, loading, onRemove, onCheckout }) {
  if (!isOpen) return null;

  const formatted = total
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: total.currencyCode }).format(total.amount)
    : '$0.00';

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Your Cart</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.items}>
          {lineItems.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={{ fontSize: '3rem' }}>🛒</span>
              <p>Your cart is empty.</p>
            </div>
          ) : (
            lineItems.map(line => {
              const variant  = line.merchandise;
              const product  = variant?.product;
              const price    = variant?.price;
              const imgUrl   = product?.featuredImage?.url;

              const linePrice = price
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currencyCode })
                    .format(price.amount * line.quantity)
                : '';

              return (
                <div key={line.id} style={styles.lineItem}>
                  {imgUrl
                    ? <img src={imgUrl} alt={product?.title} style={styles.itemImage} />
                    : <div style={styles.itemImage} />
                  }
                  <div style={styles.itemInfo}>
                    <div style={styles.itemTitle}>{product?.title}</div>
                    <div style={styles.itemVariant}>{variant?.title} × {line.quantity}</div>
                    <div style={styles.itemPrice}>{linePrice}</div>
                  </div>
                  <button
                    style={styles.removeBtn}
                    onClick={() => onRemove(line.id)}
                    disabled={loading}
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={styles.footer}>
          <div style={styles.subtotal}>
            <span>Total</span>
            <span>{formatted}</span>
          </div>
          <button
            style={styles.checkoutBtn}
            onClick={onCheckout}
            disabled={lineItems.length === 0 || loading}
          >
            {loading ? 'Updating...' : 'Checkout →'}
          </button>
        </div>
      </div>
    </div>
  );
}
