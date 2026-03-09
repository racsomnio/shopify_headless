import { useEffect, useState } from 'react';
import { handleCallback } from '../auth/customerAuth.js';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  box: {
    background: '#fff',
    borderRadius: '1rem',
    padding: '3rem 2.5rem',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid #e0e0e0',
    borderTop: '3px solid #2ECC71',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 1.5rem',
  },
  errorTitle: { color: '#c53030', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' },
  errorMsg:   { color: '#666', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.5 },
  link:       { color: '#2ECC71', fontWeight: 600, textDecoration: 'none' },
};

export function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    handleCallback()
      .then(() => {
        window.location.replace('/');
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.page}>
        <div style={styles.box}>
          {error ? (
            <>
              <p style={styles.errorTitle}>Login failed</p>
              <p style={styles.errorMsg}>{error}</p>
              <a href="/" style={styles.link}>← Back to store</a>
            </>
          ) : (
            <>
              <div style={styles.spinner} />
              <p style={{ color: '#666' }}>Completing login…</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
