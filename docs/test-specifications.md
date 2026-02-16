# TrustLock Test Specifications

## Overview

This document defines the comprehensive test suite for TrustLock contracts. Tests will be implemented in Phase 5 using Clarinet's testing framework.

## Test Categories

### 1. Trait Compliance Tests
Verify that escrow contracts properly implement the `escrow-trait` interface.

#### TC-TRAIT-001: Interface Implementation
- **Description**: Verify escrow contract implements all trait functions
- **Test**: Call each trait function and verify signature matches
- **Expected**: All functions callable, return correct types

#### TC-TRAIT-002: Error Code Constants
- **Description**: Verify all error codes are defined and unique
- **Test**: Reference each error constant
- **Expected**: All error codes accessible, no duplicate values

---

### 2. Deposit Function Tests

#### TC-DEP-001: Successful Deposit
- **Setup**: Deploy escrow, buyer has sufficient balance
- **Action**: Buyer calls `deposit()` with correct amount
- **Expected**: `(ok true)`, funds transferred, state = FUNDED

#### TC-DEP-002: Unauthorized Deposit
- **Setup**: Deploy escrow
- **Action**: Non-buyer calls `deposit()`
- **Expected**: `(err u100)` ERR-NOT-BUYER

#### TC-DEP-003: Amount Mismatch
- **Setup**: Deploy escrow with amount 1000
- **Action**: Buyer calls `deposit()` with amount 500
- **Expected**: `(err u303)` ERR-AMOUNT-MISMATCH

#### TC-DEP-004: Double Deposit Prevention
- **Setup**: Escrow already FUNDED
- **Action**: Buyer attempts second deposit
- **Expected**: `(err u200)` ERR-ALREADY-FUNDED

#### TC-DEP-005: Deposit After Deadline
- **Setup**: Escrow created, advance block height past deadline
- **Action**: Buyer calls `deposit()`
- **Expected**: `(err u301)` ERR-DEADLINE-PASSED

#### TC-DEP-006: Insufficient Balance
- **Setup**: Buyer has balance < escrow amount
- **Action**: Buyer calls `deposit()`
- **Expected**: `(err u401)` ERR-INSUFFICIENT-BALANCE

---

### 3. Release Function Tests

#### TC-REL-001: Successful Release
- **Setup**: Escrow FUNDED
- **Action**: Seller calls `release()`
- **Expected**: `(ok true)`, funds to seller, state = RELEASED

#### TC-REL-002: Unauthorized Release
- **Setup**: Escrow FUNDED
- **Action**: Buyer calls `release()`
- **Expected**: `(err u101)` ERR-NOT-SELLER

#### TC-REL-003: Release Before Funding
- **Setup**: Escrow in CREATED state
- **Action**: Seller calls `release()`
- **Expected**: `(err u201)` ERR-NOT-FUNDED

#### TC-REL-004: Double Release Prevention
- **Setup**: Escrow already RELEASED
- **Action**: Seller attempts second release
- **Expected**: `(err u202)` ERR-ALREADY-RELEASED

---

### 4. Refund Function Tests

#### TC-REF-001: Successful Refund After Deadline
- **Setup**: Escrow FUNDED, advance past deadline
- **Action**: Anyone calls `refund()`
- **Expected**: `(ok true)`, funds to buyer, state = REFUNDED

#### TC-REF-002: Refund Before Deadline
- **Setup**: Escrow FUNDED, deadline not reached
- **Action**: Call `refund()`
- **Expected**: `(err u302)` ERR-DEADLINE-NOT-REACHED

#### TC-REF-003: Refund Before Funding
- **Setup**: Escrow in CREATED state
- **Action**: Call `refund()`
- **Expected**: `(err u201)` ERR-NOT-FUNDED

#### TC-REF-004: Double Refund Prevention
- **Setup**: Escrow already REFUNDED
- **Action**: Attempt second refund
- **Expected**: `(err u203)` ERR-ALREADY-REFUNDED

#### TC-REF-005: Refund After Release
- **Setup**: Escrow already RELEASED
- **Action**: Call `refund()`
- **Expected**: `(err u202)` ERR-ALREADY-RELEASED

---

### 5. Get-Info Function Tests

#### TC-INFO-001: Read Created State
- **Setup**: Deploy escrow
- **Action**: Call `get-info()`
- **Expected**: Returns buyer, seller, amount, status="CREATED", deadline, funded-at=none

#### TC-INFO-002: Read Funded State
- **Setup**: Escrow FUNDED
- **Action**: Call `get-info()`
- **Expected**: status="FUNDED", funded-at=(some block-height)

#### TC-INFO-003: Read Released State
- **Setup**: Escrow RELEASED
- **Action**: Call `get-info()`
- **Expected**: status="RELEASED"

#### TC-INFO-004: Read Refunded State
- **Setup**: Escrow REFUNDED
- **Action**: Call `get-info()`
- **Expected**: status="REFUNDED"

---

### 6. State Transition Tests

#### TC-STATE-001: Full Success Path
- **Action**: CREATED → deposit → FUNDED → release → RELEASED
- **Expected**: All transitions succeed, funds end with seller

#### TC-STATE-002: Timeout Refund Path
- **Action**: CREATED → deposit → FUNDED → advance past deadline → refund → REFUNDED
- **Expected**: All transitions succeed, funds return to buyer

#### TC-STATE-003: Invalid Transition Rejection
- **Action**: Attempt CREATED → release (skip deposit)
- **Expected**: Transaction rejected with appropriate error

---

### 7. Integration Tests (Factory + Escrow)

#### TC-INT-001: Factory Deployment
- **Action**: Factory deploys new escrow instance
- **Expected**: New contract created, unique address returned

#### TC-INT-002: Multiple Concurrent Escrows
- **Action**: Deploy 5 escrows simultaneously
- **Expected**: All function independently, no state collision

#### TC-INT-003: Factory Query
- **Action**: Query factory for deployed escrows
- **Expected**: Returns correct list of escrow addresses

---

### 8. Edge Cases & Security Tests

#### TC-EDGE-001: Zero Amount Escrow
- **Action**: Create escrow with amount = 0
- **Expected**: Transaction rejected or properly handled

#### TC-EDGE-002: Maximum Amount Escrow
- **Action**: Create escrow with amount = u128-max
- **Expected**: Properly handled or rejected with clear error

#### TC-EDGE-003: Same Address Buyer/Seller
- **Action**: Create escrow where buyer = seller
- **Expected**: Allowed (user choice) or rejected with validation

#### TC-EDGE-004: Deadline in Past
- **Action**: Create escrow with deadline < current block
- **Expected**: Transaction rejected

#### TC-SEC-001: Reentrancy Attack Attempt
- **Action**: Malicious contract calls escrow recursively
- **Expected**: State protection prevents exploitation

#### TC-SEC-002: Front-Running Protection
- **Action**: Simulate mempool front-running scenario
- **Expected**: Transaction ordering doesn't break atomicity

---

## Test Execution Plan

### Phase 5 (Contract Implementation)
- Implement unit tests alongside each function
- Achieve 100% code coverage on contract logic
- Automated CI testing on every commit

### Phase 6 (Integration)
- Factory + Escrow integration tests
- Multi-contract interaction tests
- Gas optimization validation

### Phase 7 (Pre-Mainnet)
- Testnet deployment testing
- Real wallet interaction testing
- Security audit preparation

## Test Metrics

Target metrics for Phase 5:
- **Code Coverage**: ≥95%
- **Test Count**: ≥40 unit tests
- **Edge Cases**: ≥10 edge case tests
- **Security Tests**: ≥5 security-focused tests
- **Execution Time**: All tests complete in <30 seconds
