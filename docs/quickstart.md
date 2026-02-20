# TrustLock Quick Start Guide

Get started with TrustLock in 10 minutes.

## Prerequisites

Install required tools:

```bash
# Install Clarinet (macOS)
brew install clarinet

# Install Clarinet (Linux)
wget https://github.com/hirosystems/clarinet/releases/download/v2.9.0/clarinet-linux-x64.tar.gz
tar -xzf clarinet-linux-x64.tar.gz
sudo mv clarinet /usr/local/bin/

# Install Node.js (if needed)
# https://nodejs.org/

# Verify installations
clarinet --version
node --version
```

## 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/Yusufolosun/trustlock.git
cd trustlock

# Install dependencies
npm install

# Verify setup
clarinet check
npm test
```

Expected output:
```
✔ 3 contracts checked
✓ 26 tests passed (26)
```

## 2. Understand the Architecture

### Three Core Contracts

> These must be deployed in order — traits first, then escrow, then factory — because each depends on the one before it.

1. **trustlock-traits.clar**
   - Interface definitions
   - Error codes (15 codes across 4 categories)

2. **trustlock-escrow.clar**
   - Core escrow logic
   - Deposit, release, refund functions
   - State machine: CREATED → FUNDED → RELEASED/REFUNDED

3. **trustlock-factory.clar**
   - Deploy escrow instances
   - Registry and tracking
   - Query functions

### Basic Flow

```
1. User calls factory.create-escrow(buyer, seller, amount, deadline)
   → Returns escrow-id

2. Buyer calls escrow.deposit(escrow-id)
   → Funds locked, state = FUNDED

3a. Seller calls escrow.release(escrow-id)
    → Funds to seller, state = RELEASED

3b. OR wait for deadline, anyone calls escrow.refund(escrow-id)
    → Funds to buyer, state = REFUNDED
```

## 3. Local Testing (Devnet)

### Start Clarinet Console

```bash
clarinet console
```

In the console:

```clarity
;; Create escrow
(contract-call? .trustlock-factory create-escrow
  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5  ;; buyer
  'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG  ;; seller
  u1000000  ;; 1 STX
  u100)     ;; 100 blocks

;; Returns: (ok u0)  <- escrow-id is 0

;; Buyer deposits (as wallet_1)
::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
(contract-call? .trustlock-escrow deposit u0)

;; Returns: (ok true)

;; Check status
(contract-call? .trustlock-escrow get-status u0)

;; Returns: (ok "FUNDED")

;; Seller releases (as wallet_2)
::set_tx_sender ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG
(contract-call? .trustlock-escrow release u0)

;; Returns: (ok true)

;; Verify final state
(contract-call? .trustlock-escrow get-status u0)

;; Returns: (ok "RELEASED")
```

## 4. Run Automated Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/trustlock-escrow.test.ts

# Watch mode (re-run on changes)
npm test -- --watch
```

## 5. Deploy to Testnet

### Get Testnet STX

1. Create wallet: https://wallet.hiro.so/
2. Get testnet STX: https://explorer.hiro.so/sandbox/faucet

### Configure Testnet

Create `settings/Testnet.toml` (do NOT commit):

```toml
[network]
name = "testnet"
node_rpc_address = "https://api.testnet.hiro.so"

[accounts.deployer]
mnemonic = "YOUR_TESTNET_WALLET_MNEMONIC_HERE"
```

### Deploy

```bash
# Deploy all contracts to testnet
clarinet deployments apply -p deployments/default.testnet-plan.yaml --network testnet

# Note the deployed contract addresses
# Example output:
# ✓ ST1234...ABC.trustlock-traits
# ✓ ST1234...ABC.trustlock-escrow
# ✓ ST1234...ABC.trustlock-factory
```

## 6. Interact on Testnet

Use Hiro Explorer or Sandbox:

1. Go to: https://explorer.hiro.so/sandbox/deploy
2. Connect your testnet wallet
3. Call contract functions:
   - `create-escrow` on factory
   - `deposit` on escrow
   - `release` or `refund` on escrow

## Next Steps

- Read [State Machine Documentation](state-machine.md)
- Review [Error Codes Reference](error-codes.md)
- Check [Deployment Guide](deployment-guide.md) for mainnet
- Review [Contributing Guidelines](../CONTRIBUTING.md)

## Troubleshooting

### Tests Failing

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear Clarinet cache
rm -rf .cache

# Re-run tests
npm test
```

### Contract Check Errors

```bash
# Ensure LF line endings (not CRLF)
git config core.autocrlf input

# Re-checkout files
git checkout -- contracts/
```

### Deployment Issues

- Ensure testnet wallet has enough STX (0.5-1 STX recommended)
- Check network status: https://status.hiro.so/
- Verify contract addresses don't conflict

## Support

- Issues: https://github.com/Yusufolosun/trustlock/issues
- Discussions: https://github.com/Yusufolosun/trustlock/discussions
- Security: See [SECURITY.md](../SECURITY.md)
