# RMA Flow — Return Merchandise Authorization

## Full Lifecycle

```
Customer          Backend (also)         Shopify Admin
   │                   │                     │
   │── POST /api/rma ──▶│                     │
   │                   │── getOrderById() ───▶│
   │                   │◀─ order data ────────│
   │                   │                     │
   │                   │ createRMA()          │
   │                   │ status = 'pending'   │
   │◀── RMA created ───│                     │
   │    RMA-2024-0001   │                     │
   │                   │                     │
   │                   │ publish: rma.created │
   │                   │ (→ email ops team)   │
   │                   │                     │
Ops Team approves:     │                     │
   │── POST /rma/:id/approve ──▶│            │
   │                   │── calculateRefund() ▶│
   │                   │◀─ suggested refund ──│
   │                   │                     │
   │                   │ status = 'approved'  │
   │                   │ refund_amount = $X   │
   │◀── Approved ──────│                     │
   │                   │                     │
Item physically received:                    │
   │── POST /rma/:id/refund ──▶│             │
   │                   │── createRefund() ───▶│
   │                   │◀─ refund confirmed ──│
   │                   │                     │
   │                   │ status = 'refunded'  │
   │                   │ shopify_refund_id set│
   │◀── Refunded ──────│                     │
   │                   │                     │
   │── POST /rma/:id/close ──▶│              │
   │                   │ status = 'closed'    │
   │◀── Closed ────────│                     │
```

## RMA Status State Machine

```
pending ──────────────────── approve ──── approved ─── refund ─── refunded ─── close ─── closed
   └──── reject ──── rejected                                                              
```

**States:**
- `pending`   — awaiting ops review
- `approved`  — return authorized, waiting for physical item
- `refunded`  — Shopify refund created, money returned
- `closed`    — case closed, all done
- `rejected`  — return denied (outside window, no defect found, etc.)

## RMA Reasons

| Code | Description | Example |
|---|---|---|
| `defective` | Product has a manufacturing defect | Battery won't charge |
| `wrong_item` | Wrong item shipped | Ordered red, got blue |
| `not_as_described` | Does not match listing | Range claim inaccurate |
| `changed_mind` | Customer no longer wants it | (check return policy) |
| `damaged_shipping` | Arrived damaged | Frame cracked in transit |

## Restocking Options

When creating a Shopify refund, set `restockType`:
- `RETURN` — item returned to inventory (default for functional returns)
- `CANCEL` — item not returned, don't restock (defective, write-off)
- `NO_RESTOCK` — manually managed

## API Examples

### Create RMA
```bash
curl -X POST http://localhost:3000/api/rma \
  -H "Content-Type: application/json" \
  -d '{
    "shopifyOrderId": "gid://shopify/Order/6789012345",
    "customerEmail": "rider@also.com",
    "reason": "defective",
    "lineItems": [
      {
        "lineItemId": "gid://shopify/LineItem/1234567890",
        "quantity": 1,
        "reason": "Battery drains to 0% in under 10 miles"
      }
    ],
    "notes": "Customer reported issue 2 weeks after delivery"
  }'
```

### Approve RMA (calculates refund from Shopify)
```bash
curl -X POST http://localhost:3000/api/rma/1/approve
```

### Process refund (call after physical return received)
```bash
curl -X POST http://localhost:3000/api/rma/1/refund
```

### List open RMAs
```bash
curl "http://localhost:3000/api/rma?status=approved"
```

## Common Interview Questions

**Q: How do you prevent double-refunds?**
A: `shopify_refund_id` field — check for non-null before calling `createRefund`. State machine enforces `approved → refunded` transition.

**Q: What if the Shopify refund API call fails mid-process?**
A: The RMA stays in `approved` state (DB not updated until refund confirmed). Operator can retry. The event bus logs failed events for replay.

**Q: How would you handle partial returns?**
A: `lineItems` is a JSON array — each item has its own `quantity`. The refund is calculated per line item via `calculateRefund`.

**Q: How do you track return rate by product?**
A: Join `rma_requests.line_items` (JSON) with `orders` table. Add a materialized view or report query.
