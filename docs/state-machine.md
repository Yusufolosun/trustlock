# TrustLock Escrow State Machine

## State Definitions

### CREATED
- **Description**: Escrow initialized through the factory contract, awaiting initial funding
- **Data**: Buyer and seller addresses assigned, amount and deadline set
- **Entry**: Only the factory contract can transition the system to this state through `initialize-escrow`. Direct calls are rejected with `ERR-NOT-FACTORY (u104)`.
- **Actions Available**: `deposit()`
- **Who Can Act**: Buyer only

### FUNDED
- **Description**: Buyer has deposited funds, awaiting seller confirmation or timeout
- **Data**: Amount locked in contract, funded timestamp recorded
- **Actions Available**: `release()`, `refund()` (after deadline)
- **Who Can Act**: Seller (release), Buyer (refund after deadline)

### RELEASED
- **Description**: Funds successfully transferred to seller (terminal state)
- **Data**: Release timestamp recorded
- **Actions Available**: None (terminal)
- **Who Can Act**: None

### REFUNDED
- **Description**: Funds returned to buyer (terminal state)
- **Data**: Refund timestamp recorded
- **Actions Available**: None (terminal)
- **Who Can Act**: None

## State Transitions

```
    ┌─────────┐
    │ CREATED │
    └────┬────┘
         │ deposit() [buyer only]
         │
    ┌────▼────┐
    │ FUNDED  │
    └─┬─────┬─┘
      │     │
      │     └─ refund() [after deadline] ──► ┌──────────┐
      │                                       │ REFUNDED │
      │                                       └──────────┘
      │
      └─ release() [seller only] ────────► ┌──────────┐
                                            │ RELEASED │
                                            └──────────┘
```

## Transition Rules

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
| Refund before deadline | `u302` | ERR-DEADLINE-NOT-REACHED |
| Transfer execution failure | `u400` | ERR-TRANSFER-FAILED |

## Security Considerations

1. **Reentrancy Protection**: State changes before external calls
2. **Deadline Enforcement**: Block height comparison (deterministic)
3. **Authorization**: Strict role checks on state-changing functions
4. **Atomicity**: All-or-nothing transfers (no partial states)
5. **Terminal States**: RELEASED and REFUNDED are irreversible
