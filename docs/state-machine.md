# TrustLock Escrow State Machine

## State Definitions

### CREATED
- **Description**: Escrow initialized through the factory contract, awaiting initial funding
- **Data**: Buyer and seller addresses assigned, amount and deadline set
- **Entry**: Only the factory contract can transition the system to this state through `initialize-escrow`. Direct calls are rejected with `ERR-NOT-FACTORY (u104)`.
- **Actions Available**: `deposit()`, `cancel-escrow()`
- **Who Can Act**: Buyer (deposit, cancel), Creator via factory (cancel)

### FUNDED
- **Description**: Buyer has deposited funds, awaiting seller confirmation or timeout
- **Data**: Amount locked in contract, funded timestamp recorded
- **Actions Available**: `release()`, `refund()` (after deadline)
- **Who Can Act**: Seller (release), Buyer (refund after deadline)

### RELEASED
- **Description**: Funds successfully transferred to seller (terminal state)
- **Data**: Release timestamp recorded in `released-at` field
- **Actions Available**: None (terminal)
- **Who Can Act**: None

### REFUNDED
- **Description**: Funds returned to buyer (terminal state)
- **Data**: Refund timestamp recorded in `refunded-at` field
- **Actions Available**: None (terminal)
- **Who Can Act**: None

### CANCELLED
- **Description**: Escrow cancelled before funding (terminal state)
- **Data**: Cancellation event emitted for indexing
- **Actions Available**: None (terminal)
- **Who Can Act**: None

## State Transitions

```
    ┌─────────┐
    │ CREATED │
    └─┬─────┬─┘
      │     │
      │     └─ cancel-escrow() ──────────► ┌───────────┐
      │        [buyer or creator]           │ CANCELLED │
      │                                     └───────────┘
      │ deposit() [buyer only]
      │
    ┌─▼──────┐
    │ FUNDED  │
    └─┬─────┬─┘
      │     │
      └─ release() ───────────────────── ► ┌──────────┐
      │    [seller only]                    │ RELEASED │
      │                                     └──────────┘
      │
      └─ refund() [after deadline] ──────► ┌──────────┐
                                            │ REFUNDED │
                                            └──────────┘
```

## Transition Rules

### CREATED → CANCELLED
- **Trigger**: `cancel-escrow()` called by buyer (direct) or creator (via factory)
- **Preconditions**:
  - Current state must be CREATED
  - Caller must be buyer (direct) or creator (through factory)
- **Postconditions**:
  - State changes to CANCELLED
  - Print event emitted for indexing

### CREATED → FUNDED
- **Trigger**: `deposit()` called by buyer
- **Preconditions**:
  - Caller must be buyer
  - Amount must match escrow amount
  - Current state must be CREATED
  - Deadline must not have passed
- **Postconditions**:
  - Funds transferred from buyer to contract
  - State changes to FUNDED
  - Funded timestamp recorded

### FUNDED → RELEASED
- **Trigger**: `release()` called by seller
- **Preconditions**:
  - Caller must be seller
  - Current state must be FUNDED
- **Postconditions**:
  - Funds transferred from contract to seller
  - State changes to RELEASED
  - Release timestamp recorded

### FUNDED → REFUNDED
- **Trigger**: `refund()` called after deadline
- **Preconditions**:
  - Current block height ≥ deadline
  - Current state must be FUNDED
  - Caller can be buyer or any third party (permissionless refund)
- **Postconditions**:
  - Funds transferred from contract to buyer
  - State changes to REFUNDED
  - Refund timestamp recorded

## Error Handling

Each transition enforces preconditions and returns specific error codes:

| Violation | Error Code | Description |
|-----------|------------|-------------|
| Wrong caller on deposit | `u100` | ERR-NOT-BUYER |
| Wrong caller on release | `u101` | ERR-NOT-SELLER |
| Deposit when already funded | `u200` | ERR-ALREADY-FUNDED |
| Release when not funded | `u201` | ERR-NOT-FUNDED |
| Transition from terminal state | `u202/u203` | ERR-ALREADY-RELEASED/REFUNDED |
| Invalid amount on deposit | `u303` | ERR-AMOUNT-MISMATCH |
| Cancel wrong state | `u204` | ERR-INVALID-STATE |
| Refund before deadline | `u302` | ERR-DEADLINE-NOT-REACHED |
| Transfer execution failure | `u400` | ERR-TRANSFER-FAILED |

## Security Considerations

1. **Reentrancy Protection**: State changes before external calls
2. **Deadline Enforcement**: Block height comparison (deterministic)
3. **Authorization**: Strict role checks on state-changing functions
4. **Atomicity**: All-or-nothing transfers (no partial states)
5. **Terminal States**: RELEASED, REFUNDED, and CANCELLED are irreversible
