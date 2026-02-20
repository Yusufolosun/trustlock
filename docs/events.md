# TrustLock Event Schema

All state-transition functions in the escrow contract emit `(print ...)` events that can be captured by off-chain indexers, frontends, and analytics pipelines.

## Event Types

### escrow-created

Emitted when a new escrow is initialized through the factory.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string-ascii` | `"escrow-created"` |
| `escrow-id` | `uint` | Unique identifier for the escrow |
| `buyer` | `principal` | Buyer's address |
| `seller` | `principal` | Seller's address |
| `amount` | `uint` | Escrow amount in micro-STX |
| `deadline` | `uint` | Absolute block height after which refund is allowed |

### escrow-funded

Emitted when the buyer deposits funds into the escrow.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string-ascii` | `"escrow-funded"` |
| `escrow-id` | `uint` | Escrow identifier |
| `buyer` | `principal` | Address that deposited |
| `amount` | `uint` | Amount deposited in micro-STX |
| `funded-at` | `uint` | Block height of the deposit |

### escrow-released

Emitted when the seller releases the escrowed funds.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string-ascii` | `"escrow-released"` |
| `escrow-id` | `uint` | Escrow identifier |
| `seller` | `principal` | Address that received the funds |
| `amount` | `uint` | Amount released in micro-STX |

### escrow-refunded

Emitted when funds are returned to the buyer after the deadline.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string-ascii` | `"escrow-refunded"` |
| `escrow-id` | `uint` | Escrow identifier |
| `buyer` | `principal` | Address that received the refund |
| `amount` | `uint` | Amount refunded in micro-STX |

### escrow-cancelled

Emitted when an unfunded escrow is cancelled.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string-ascii` | `"escrow-cancelled"` |
| `escrow-id` | `uint` | Escrow identifier |
| `cancelled-by` | `principal` | Address that initiated the cancellation |

## Consuming Events

Events are included in the transaction receipt under the `events` array. Each print event has a `type` of `"contract_event"` and a `value` containing the tuple fields above.

### Example (Clarinet SDK)

```typescript
const { result, events } = simnet.callPublicFn(
    "trustlock-escrow",
    "deposit",
    [Cl.uint(escrowId)],
    buyer
);

// Filter for print events
const printEvents = events.filter(e => e.event === "print_event");
```

### Indexer Integration

When running a Stacks node or using the Stacks API, subscribe to contract events for the escrow contract address. Each event will contain the tuple payload documented above, allowing you to build real-time dashboards and notification systems.
