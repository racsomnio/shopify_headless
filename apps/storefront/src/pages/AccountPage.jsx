import { useCustomer } from '../hooks/useCustomer.js';
import { Header } from '../components/Header.jsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const FINANCIAL_COLORS = {
  PAID:             { bg: '#f0fdf4', color: '#15803d' },
  PENDING:          { bg: '#fffbeb', color: '#b45309' },
  PARTIALLY_PAID:   { bg: '#fffbeb', color: '#b45309' },
  REFUNDED:         { bg: '#fef2f2', color: '#b91c1c' },
  PARTIALLY_REFUNDED:{ bg: '#fef2f2', color: '#b91c1c' },
  VOIDED:           { bg: '#f1f5f9', color: '#475569' },
};

const FULFILLMENT_LABELS = {
  UNFULFILLED:        'Unfulfilled',
  PARTIALLY_FULFILLED:'Partially Fulfilled',
  FULFILLED:          'Fulfilled',
  RESTOCKED:          'Restocked',
  PENDING_FULFILLMENT:'Pending',
  OPEN:               'Open',
  IN_PROGRESS:        'In Progress',
  ON_HOLD:            'On Hold',
  SCHEDULED:          'Scheduled',
};

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page:     { minHeight: '100vh', background: '#f5f5f0' },
  inner:    { maxWidth: '900px', margin: '0 auto', padding: '2.5rem 1.5rem' },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#666', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '2rem' },

  // Profile card
  profileCard: {
    background: '#fff', borderRadius: '1rem', padding: '2rem',
    display: 'flex', alignItems: 'center', gap: '1.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '2rem',
  },
  avatar: {
    width: '64px', height: '64px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #0f0f0f, #2ECC71)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '1.5rem', fontWeight: 700, flexShrink: 0,
  },
  profileName:  { fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' },
  profileEmail: { color: '#666', fontSize: '0.875rem' },

  // Section
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#0f0f0f' },

  // Order card
  orderCard: {
    background: '#fff', borderRadius: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '1rem', overflow: 'hidden',
  },
  orderHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0eb', flexWrap: 'wrap', gap: '0.5rem',
  },
  orderName:  { fontWeight: 700, fontSize: '1rem' },
  orderMeta:  { color: '#888', fontSize: '0.8rem', marginTop: '0.2rem' },
  badges:     { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  badge: (colors) => ({
    background: colors?.bg || '#f1f5f9',
    color:      colors?.color || '#475569',
    borderRadius: '2rem', padding: '0.2rem 0.75rem',
    fontSize: '0.75rem', fontWeight: 600,
  }),
  fulfillBadge: {
    background: '#f0f4ff', color: '#3b5bdb',
    borderRadius: '2rem', padding: '0.2rem 0.75rem',
    fontSize: '0.75rem', fontWeight: 600,
  },
  orderTotal: { fontWeight: 700, fontSize: '1rem' },

  // Line items
  lineItems: { padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  lineItem:  { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  thumb: {
    width: '44px', height: '44px', borderRadius: '0.5rem',
    objectFit: 'cover', background: '#f0f0ea', flexShrink: 0,
  },
  thumbPlaceholder: {
    width: '44px', height: '44px', borderRadius: '0.5rem',
    background: '#f0f0ea', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.1rem',
  },
  itemTitle: { fontWeight: 500, fontSize: '0.875rem', flex: 1 },
  itemMeta:  { color: '#888', fontSize: '0.8rem' },

  // Order footer
  orderFooter: { padding: '0.75rem 1.5rem', borderTop: '1px solid #f0f0eb', textAlign: 'right' },
  statusLink: {
    color: '#2ECC71', fontWeight: 600, fontSize: '0.8rem',
    textDecoration: 'none',
  },

  // States
  loading:  { textAlign: 'center', padding: '4rem', color: '#666' },
  errorBox: { background: '#fff0f0', color: '#c53030', borderRadius: '0.75rem', padding: '1.5rem', textAlign: 'center' },
  emptyOrders: { textAlign: 'center', color: '#888', padding: '3rem 1rem', background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
};

// ── Components ────────────────────────────────────────────────────────────────

function OrderCard({ order }) {
  const financialColors = FINANCIAL_COLORS[order.financialStatus] || FINANCIAL_COLORS.VOIDED;
  const fulfillLabel = FULFILLMENT_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus;

  return (
    <div style={s.orderCard}>
      <div style={s.orderHeader}>
        <div>
          <div style={s.orderName}>{order.name}</div>
          <div style={s.orderMeta}>{formatDate(order.processedAt)}</div>
        </div>
        <div style={s.badges}>
          {order.financialStatus && (
            <span style={s.badge(financialColors)}>
              {order.financialStatus.replace(/_/g, ' ')}
            </span>
          )}
          {order.fulfillmentStatus && (
            <span style={s.fulfillBadge}>{fulfillLabel}</span>
          )}
        </div>
        <div style={s.orderTotal}>
          {formatMoney(order.totalPrice.amount, order.totalPrice.currencyCode)}
        </div>
      </div>

      {order.lineItems?.nodes?.length > 0 && (
        <div style={s.lineItems}>
          {order.lineItems.nodes.map((item, i) => (
            <div key={i} style={s.lineItem}>
              {item.image ? (
                <img src={item.image.url} alt={item.image.altText || item.title} style={s.thumb} />
              ) : (
                <div style={s.thumbPlaceholder}>📦</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={s.itemTitle}>{item.title}</div>
                <div style={s.itemMeta}>
                  Qty: {item.quantity} · {formatMoney(item.price.amount, item.price.currencyCode)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.orderFooter}>
        <a href={order.statusPageUrl} target="_blank" rel="noreferrer" style={s.statusLink}>
          View order status →
        </a>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AccountPage() {
  const { customer, loading, error, logout } = useCustomer();

  const initials = customer
    ? `${customer.firstName?.[0] ?? ''}${customer.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';

  return (
    <div style={s.page}>
      <Header />

      <div style={s.inner}>
        <a href="/" style={s.backLink}>← Back to store</a>

        {loading && <div style={s.loading}>Loading your account…</div>}

        {error && (
          <div style={s.errorBox}>
            <strong>Could not load account</strong><br />{error}
          </div>
        )}

        {customer && (
          <>
            {/* Profile */}
            <div style={s.profileCard}>
              <div style={s.avatar}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={s.profileName}>
                  {customer.firstName} {customer.lastName}
                </div>
                <div style={s.profileEmail}>
                  {customer.emailAddress?.emailAddress}
                </div>
              </div>
              <button
                onClick={logout}
                style={{
                  background: 'transparent', border: '1px solid #ddd',
                  borderRadius: '2rem', padding: '0.4rem 1rem',
                  cursor: 'pointer', color: '#666', fontSize: '0.875rem',
                }}
              >
                Log out
              </button>
            </div>

            {/* Orders */}
            <h2 style={s.sectionTitle}>Order History</h2>

            {customer.orders?.nodes?.length === 0 ? (
              <div style={s.emptyOrders}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🛍️</p>
                <p>You haven't placed any orders yet.</p>
              </div>
            ) : (
              customer.orders?.nodes?.map(order => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
