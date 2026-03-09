/**
 * useCart — Storefront API cart management hook
 *
 * Cart ID is persisted in localStorage so it survives page refreshes.
 *
 * Demonstrates:
 * - Cart creation and persistence
 * - Optimistic UI updates
 * - Merging guest cart on customer login (exercise left for reader)
 *
 * Shopify cart flow:
 *   cartCreate → get cartId + checkoutUrl
 *   cartLinesAdd / cartLinesRemove → update line items
 *   redirect to checkoutUrl → Shopify-hosted checkout handles payment
 */

import { useState, useEffect, useCallback } from 'react';
import { createCart, addToCart, removeFromCart, fetchCart } from '../api/storefront.js';

const CART_ID_KEY = 'also_cart_id';

export function useCart() {
  const [cart, setCart]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Load existing cart on mount
  useEffect(() => {
    const savedId = localStorage.getItem(CART_ID_KEY);
    if (savedId) {
      fetchCart(savedId)
        .then(data => {
          if (data.cart) setCart(data.cart);
          else localStorage.removeItem(CART_ID_KEY); // cart expired
        })
        .catch(() => localStorage.removeItem(CART_ID_KEY));
    }
  }, []);

  /**
   * Add a variant to the cart — creates cart if none exists
   */
  const addItem = useCallback(async (variantId, quantity = 1) => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (!cart) {
        data = await createCart(variantId, quantity);
        const newCart = data.cartCreate.cart;
        localStorage.setItem(CART_ID_KEY, newCart.id);
        setCart(newCart);
      } else {
        data = await addToCart(cart.id, variantId, quantity);
        setCart(data.cartLinesAdd.cart);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  /**
   * Remove a line item by its cart line ID
   */
  const removeItem = useCallback(async (lineId) => {
    if (!cart) return;
    setLoading(true);
    setError(null);
    try {
      const data = await removeFromCart(cart.id, lineId);
      setCart(data.cartLinesRemove.cart);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cart]);

  /**
   * Go to Shopify checkout
   */
  const checkout = useCallback(() => {
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  }, [cart]);

  const lineItems = cart?.lines?.edges?.map(e => e.node) ?? [];
  const itemCount = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const total     = cart?.cost?.totalAmount;

  return {
    cart,
    lineItems,
    itemCount,
    total,
    loading,
    error,
    addItem,
    removeItem,
    checkout,
  };
}
