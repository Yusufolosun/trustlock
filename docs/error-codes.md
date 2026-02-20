# TrustLock Error Codes Reference

## Quick Lookup Table

| Code | Constant | Category | Description |
|------|----------|----------|-------------|
| `u100` | ERR-NOT-BUYER | Authorization | Caller is not the designated buyer |
| `u101` | ERR-NOT-SELLER | Authorization | Caller is not the designated seller |
| `u102` | ERR-NOT-PARTY | Authorization | Caller is neither buyer nor seller |
| `u103` | ERR-UNAUTHORIZED | Authorization | Caller lacks required permissions |
| `u104` | ERR-NOT-FACTORY | Authorization | Caller is not the factory contract |
| `u200` | ERR-ALREADY-FUNDED | State | Escrow has already been funded |
| `u201` | ERR-NOT-FUNDED | State | Escrow has not been funded yet |
| `u202` | ERR-ALREADY-RELEASED | State | Funds have already been released |
| `u203` | ERR-ALREADY-REFUNDED | State | Funds have already been refunded |
| `u204` | ERR-INVALID-STATE | State | Current state doesn't allow this action |
| `u300` | ERR-INVALID-AMOUNT | Validation | Amount is invalid or out of range |
| `u301` | ERR-DEADLINE-PASSED | Validation | Deadline has already passed |
| `u302` | ERR-DEADLINE-NOT-REACHED | Validation | Deadline has not been reached yet |
| `u303` | ERR-AMOUNT-MISMATCH | Validation | Provided amount doesn't match required |
| `u400` | ERR-TRANSFER-FAILED | Execution | STX transfer operation failed |
| `u401` | ERR-INSUFFICIENT-BALANCE | Execution | Insufficient balance for operation |

## Error Categories

### Authorization Errors (u100-u199)
Returned when the caller doesn't have permission to perform the action.

**Common Causes**:
- Wrong wallet connected
- Attempting to act on behalf of another party
- Missing required role

**User Actions**:
- Verify correct wallet is connected
- Check which role you have in the escrow
- Contact counterparty if action requires their involvement

---

### State Errors (u200-u299)
Returned when the escrow is in the wrong state for the requested action.

**Common Causes**:
- Attempting duplicate operations
- Calling functions out of sequence
- Interacting with completed escrow

**User Actions**:
- Check current escrow status with `get-info()`
- Verify state machine requirements in documentation
- Ensure escrow hasn't already been completed

---

### Validation Errors (u300-u399)
Returned when input parameters are invalid or preconditions aren't met.

**Common Causes**:
- Incorrect amount provided
- Deadline constraints violated
- Invalid parameter values

**User Actions**:
- Double-check input values
- Verify deadline hasn't passed (for deposits)
- Ensure amount matches escrow requirement

---

### Execution Errors (u400-u499)
Returned when the Stacks blockchain operation fails.

**Common Causes**:
- Insufficient STX balance
- Network issues during transfer
- Smart contract execution limits

**User Actions**:
- Verify wallet has sufficient balance (amount + gas fees)
- Check network status
- Retry transaction if transient failure

## Debugging Workflow

1. **Identify Error Code**: Check transaction result for error code (e.g., `(err u101)`)
2. **Look Up Category**: Use table above to find error name and category
3. **Check State**: Call `get-info()` to verify current escrow state
4. **Verify Permissions**: Confirm you're calling from the correct wallet/role
5. **Review Preconditions**: Check state machine docs for required conditions
6. **Retry or Report**: Fix issue and retry, or report bug if error is unexpected

## Frontend Integration

When handling errors in the frontend:

```typescript
const handleError = (errorCode: number): string => {
  const errorMessages: Record<number, string> = {
    100: "You are not authorized as the buyer for this escrow",
    101: "You are not authorized as the seller for this escrow",
    200: "This escrow has already been funded",
    201: "This escrow needs to be funded first",
    202: "Funds have already been released to the seller",
    203: "Funds have already been refunded to the buyer",
    301: "The deadline for this escrow has passed",
    302: "Cannot refund until the deadline is reached",
    303: "The amount provided doesn't match the escrow amount",
    400: "Transfer failed - please try again",
    401: "Insufficient balance in your wallet"
  };
  
  return errorMessages[errorCode] || `Unknown error: ${errorCode}`;
};
```
