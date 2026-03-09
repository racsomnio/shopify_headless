# Event-Driven Patterns — Local → AWS Migration Guide

## Why Event-Driven for E-Commerce?

E-commerce systems are inherently event-driven:
- Customer places order → triggers inventory check, payment processing, fulfillment
- Item ships → triggers tracking email, order status update
- Return approved → triggers refund, inventory restock

Decoupling these with events makes the system:
- **Resilient** — each service fails independently
- **Scalable** — add consumers without changing producers
- **Auditable** — event log is the source of truth

---

## Our Local EventBus vs AWS EventBridge

| Concept | Local (this project) | AWS EventBridge |
|---------|---------------------|-----------------|
| **Publish** | `eventBus.publish(source, detailType, detail)` | `EventBridgeClient.putEvents(...)` |
| **Subscribe** | `eventBus.subscribe(source, type, handler)` | EventBridge Rule → Lambda target |
| **Fan-out** | Multiple `.on()` listeners | Multiple rules match same event |
| **Persistence** | SQLite `events` table | EventBridge Archive + S3 |
| **Retry** | Manual replay from DB | Built-in retry + dead-letter SQS |
| **Filtering** | Exact key match | Content-based filter expressions |

### EventBridge event shape (we mirror this exactly)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "shopify.webhook",
  "detail-type": "orders/create",
  "detail": { "...shopify order payload..." },
  "time": "2024-01-15T10:30:00Z",
  "account": "123456789012",
  "region": "us-west-2"
}
```

---

## Migrating to AWS EventBridge

### Step 1: Publish to EventBridge instead of local bus

```javascript
// Before (local)
eventBus.publish('shopify.webhook', 'orders/create', orderPayload);

// After (AWS)
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const client = new EventBridgeClient({ region: 'us-west-2' });

await client.send(new PutEventsCommand({
  Entries: [{
    Source: 'shopify.webhook',
    DetailType: 'orders/create',
    Detail: JSON.stringify(orderPayload),
    EventBusName: process.env.EVENTBRIDGE_BUS_ARN,
  }]
}));
```

### Step 2: Convert handlers to Lambda functions

```javascript
// Before (local event handler)
eventBus.subscribe('shopify.webhook', 'orders/create', async (event) => {
  await handleOrderCreated(event.detail);
});

// After (Lambda handler in a separate file/service)
export const handler = async (event) => {
  // EventBridge wraps your detail in event.detail
  await handleOrderCreated(event.detail);
};
```

Deploy with a rule:
```yaml
# AWS SAM / CloudFormation
OrderCreatedRule:
  Type: AWS::Events::Rule
  Properties:
    EventBusName: !Ref AlsoBus
    EventPattern:
      source: ["shopify.webhook"]
      detail-type: ["orders/create"]
    Targets:
      - Id: OrderProcessorLambda
        Arn: !GetAtt OrderProcessorFunction.Arn
```

---

## SQS Queue Pattern (for async/retry-heavy work)

For operations that can be slow or need retries (e.g. calling 3PL APIs, sending emails):

```
Shopify webhook → EventBridge → SQS Queue → Lambda (polls queue)
```

```javascript
// Publish to SQS
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({ region: 'us-west-2' });

await sqs.send(new SendMessageCommand({
  QueueUrl: process.env.SQS_ORDER_QUEUE_URL,
  MessageBody: JSON.stringify({ orderId, action: 'fulfill' }),
  MessageGroupId: orderId,      // FIFO queue: process one order at a time
  MessageDeduplicationId: `${orderId}-fulfill-${Date.now()}`,
}));

// Consumer Lambda (polls SQS)
export const handler = async (event) => {
  for (const record of event.Records) {
    const { orderId, action } = JSON.parse(record.body);
    // process...
  }
};
```

---

## Event Patterns Reference

| Event Source | Detail Type | Triggered By |
|---|---|---|
| `shopify.webhook` | `orders/create` | New order placed |
| `shopify.webhook` | `orders/paid` | Payment captured |
| `shopify.webhook` | `orders/fulfilled` | Fulfillment created |
| `shopify.webhook` | `orders/cancelled` | Order cancelled |
| `shopify.webhook` | `refunds/create` | Refund initiated in Shopify |
| `shopify.webhook` | `inventory_levels/update` | Stock changed |
| `also.rma` | `rma.created` | New RMA request submitted |
| `also.rma` | `rma.approved` | Ops team approved return |
| `also.rma` | `rma.refunded` | Shopify refund processed |
| `also.rma` | `rma.closed` | RMA case closed |
| `also.fulfillment` | `fulfillment.shipped` | Tracking number added |

---

## Practice Exercise

1. Add a new event type: `also.inventory::low_stock`
2. Publish it from `orderProcessor.js` when inventory drops below threshold
3. Add a subscriber that (for now) logs a console alert
4. Then convert: replace the EventEmitter with an SQS publish
5. Write a Lambda handler that reads from SQS and sends a Slack message
