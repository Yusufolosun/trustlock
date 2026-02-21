# TrustLock Deployment Guide

## Deployment Order

Contracts must be deployed in dependency order:

1. **trustlock-traits.clar** (no dependencies) — error codes & trait interface
2. **trustlock-escrow.clar** (depends on traits) — core escrow state machine
3. **trustlock-factory.clar** (depends on traits + escrow) — registry & deployment

> **Important**: If you change the deployment order, the contracts will fail to
> resolve cross-contract references. The simnet plan in
> `deployments/default.simnet-plan.yaml` already follows this order. Make sure
> any new network plans (testnet, mainnet) use the same ordering.

## Devnet Deployment

```bash
# Start Clarinet devnet
clarinet integrate

# Deploy all contracts
clarinet deployments apply -p deployments/default.devnet-plan.yaml
```

## Testnet Deployment

### Prerequisites
- Stacks wallet with testnet STX (get from [faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet))
- Clarinet CLI installed (`clarinet --version`)

### Steps

1. **Create Testnet Settings**

```bash
cp settings/Testnet.toml.example settings/Testnet.toml
# Edit settings/Testnet.toml — replace YOUR_TESTNET_MNEMONIC with your actual mnemonic
```

2. **Run Pre-Deployment Checks**

```bash
bash scripts/pre-deploy-check.sh testnet
```

Expected output:
```
  [PASS] Clarinet check passes
  [PASS] All tests pass
  [PASS] Testnet plan exists
  [PASS] Testnet.toml exists
  ...
  STATUS: READY for testnet deployment
```

3. **Deploy Contracts**

```bash
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

4. **Verify Deployment**

Check deployed contracts on testnet explorer:
- https://explorer.hiro.so/txid/TXID?chain=testnet

## Mainnet Deployment

### Prerequisites
- Production wallet with mainnet STX (>= 1 STX)
- Security audit completed
- Testnet deployment fully tested
- Emergency pause mechanism verified on testnet

### Pre-Deployment Checklist

```bash
bash scripts/pre-deploy-check.sh mainnet
```

### Steps

1. **Create Mainnet Settings**

```bash
cp settings/Mainnet.toml.example settings/Mainnet.toml
# Edit settings/Mainnet.toml — use a dedicated deployer wallet, NOT personal
```

2. **Final Pre-Flight Checks**

```bash
# Verify contract syntax
clarinet check

# Run full test suite
clarinet test

# Dry-run deployment (no actual deployment)
clarinet deployments generate --low-cost --network mainnet
```

3. **Deploy to Mainnet**

```bash
# Deploy with low-cost strategy
clarinet deployments apply -p deployments/default.mainnet-plan.yaml --network mainnet --low-cost
```

4. **Post-Deployment Verification**

- Verify contracts on mainnet explorer
- Test basic functionality (create escrow, deposit, release)
- Monitor first few transactions for issues
- Update frontend with mainnet contract addresses

## Gas Cost Estimates

Based on Clarity 2 on Stacks mainnet:

| Contract | Deployment Cost | Notes |
|----------|----------------|-------|
| trustlock-traits | ~0.05-0.1 STX | Small contract, trait definitions only |
| trustlock-escrow | ~0.15-0.25 STX | Core logic, moderate size |
| trustlock-factory | ~0.1-0.2 STX | Factory deployment logic |
| **Total** | **~0.3-0.55 STX** | Plus network fees (~10-20%) |

**Transaction Costs** (per user interaction):
- Initialize escrow: ~0.01-0.015 STX
- Deposit: ~0.01-0.015 STX
- Release: ~0.008-0.012 STX
- Refund: ~0.008-0.012 STX
- Read-only queries: ~0.001 STX

## Troubleshooting

### Deployment Fails with "contract already exists"

Check if contract was partially deployed:
```bash
clarinet deployments check --network [testnet|mainnet]
```

### Transaction Rejected - Insufficient Fees

Increase fee multiplier in deployment plan:
```yaml
fee_rate: 200  # Increase if network is congested
```

### Contract Not Found After Deployment

Wait for 1-2 block confirmations (~10-20 minutes), then verify on explorer.

## Security Considerations

1. **Never commit** `settings/*.toml` files (contains private keys)
2. **Use hardware wallet** for mainnet deployment if possible
3. **Test extensively on testnet** before mainnet deployment
4. **Have emergency contact** for Stacks protocol team if critical issues arise
5. **Monitor first 24-48 hours** closely after mainnet deployment

## Contract Addresses

After deployment, record contract addresses here:

### Testnet
- trustlock-traits: `STXXXXX.trustlock-traits`
- trustlock-escrow: `STXXXXX.trustlock-escrow`
- trustlock-factory: `STXXXXX.trustlock-factory`

### Mainnet
- trustlock-traits: `SPXXXXX.trustlock-traits`
- trustlock-escrow: `SPXXXXX.trustlock-escrow`
- trustlock-factory: `SPXXXXX.trustlock-factory`
