import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated, customerFetch, login, logout } from '../auth/customerAuth.js';

const CUSTOMER_QUERY = `
  query GetCustomer {
    customer {
      id
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          statusPageUrl
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 5) {
            nodes {
              title
              quantity
              image {
                url
                altText
              }
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export function useCustomer() {
  const [customer, setCustomer]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [loggedIn, setLoggedIn]   = useState(isAuthenticated());

  const fetchCustomer = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    setError(null);
    try {
      const { data, errors } = await customerFetch(CUSTOMER_QUERY);
      if (errors?.length) throw new Error(errors[0].message);
      setCustomer(data?.customer ?? null);
      setLoggedIn(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleLogout = useCallback(async () => {
    setCustomer(null);
    setLoggedIn(false);
    await logout();
  }, []);

  return { customer, loading, error, loggedIn, login, logout: handleLogout };
}
