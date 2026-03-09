/**
 * useProducts — Storefront API product listing hook
 *
 * Demonstrates:
 * - Fetching from Storefront API with loading/error state
 * - Cursor-based pagination (not offset — Shopify uses cursors)
 * - Deduplicating re-fetches
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchProducts } from '../api/storefront.js';

export function useProducts(pageSize = 12) {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [pageInfo, setPageInfo]   = useState({ hasNextPage: false, endCursor: null });

  const load = useCallback(async (after = null, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts(pageSize, after);
      const newProducts = data.products.edges.map(e => e.node);

      setProducts(prev => append ? [...prev, ...newProducts] : newProducts);
      setPageInfo(data.products.pageInfo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(() => {
    if (pageInfo.hasNextPage) {
      load(pageInfo.endCursor, true);
    }
  }, [pageInfo, load]);

  return { products, loading, error, pageInfo, loadMore };
}
