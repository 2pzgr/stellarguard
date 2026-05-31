# Frontend Environment Setup

This guide explains how to configure the StellarGuard frontend with environment variables, including mock mode for local development without smart contracts.

## Quick Start

1. Copy the example file:
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

2. For **local development with mock data**, set:
   ```bash
   NEXT_PUBLIC_USE_MOCK_TREASURY=1
   ```

3. For **real contracts**, populate the contract IDs and remove the mock flag.

---

## Required Public Environment Variables

### Network Configuration

These control which Stellar network the frontend connects to.

| Variable | Default | Options | Description |
|----------|---------|---------|-------------|
| `NEXT_PUBLIC_NETWORK` | `testnet` | `testnet`, `futurenet`, `mainnet` | The Stellar network to use |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | testnet default | Valid HTTPS URL | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | testnet default | Valid HTTPS URL | Horizon API endpoint |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | testnet default | Network phrase string | Network identification passphrase |

### Contract IDs

These are required **unless `NEXT_PUBLIC_USE_MOCK_TREASURY=1`** is set.

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `NEXT_PUBLIC_TREASURY_CONTRACT_ID` | String | Yes* | Deployed treasury contract ID (Stellar contract address) |
| `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` | String | Yes* | Deployed governance contract ID |
| `NEXT_PUBLIC_VAULT_CONTRACT_ID` | String | Yes* | Deployed token vault contract ID |
| `NEXT_PUBLIC_ACL_CONTRACT_ID` | String | Yes* | Deployed access control contract ID |

*Not required when using mock mode.

### Application Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | `StellarGuard` | Application name shown in UI |
| `NEXT_PUBLIC_APP_VERSION` | `0.1.0` | Application version |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `false` | Whether to enable analytics tracking |
| `NEXT_PUBLIC_ANALYTICS_ID` | (empty) | Analytics service ID (if enabled) |
| `NEXT_PUBLIC_ENABLE_DEBUG` | `true` | Enable debug output in console |

---

## Mock Mode

### What is Mock Mode?

Mock mode allows you to run the frontend **without deployed smart contracts**. All contract data is mocked with sample values, letting new contributors:
- Explore the UI without contract setup
- Test frontend features in isolation
- Develop and iterate quickly

### Enabling Mock Mode

Set the environment variable:
```bash
NEXT_PUBLIC_USE_MOCK_TREASURY=1
```

When mock mode is enabled:
- Contract ID environment variables are **optional** (mock IDs are used instead)
- No wallet connection is required to view data
- Contract calls return mock data defined in `src/lib/treasuryMocks.ts`
- Transaction submissions are simulated (no on-chain activity)

### Example: Mock Mode Setup

```bash
# frontend/.env.local
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Mock mode enabled — contract IDs below are optional
NEXT_PUBLIC_USE_MOCK_TREASURY=1

# Application config
NEXT_PUBLIC_APP_NAME=StellarGuard
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_ENABLE_DEBUG=true
```

Then start the dev server:
```bash
cd frontend
npm run dev
```

---

## Production Setup

### Example: Using Deployed Contracts

```bash
# frontend/.env.local
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015

# Contract IDs (populate after deployment)
NEXT_PUBLIC_TREASURY_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID=CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4
NEXT_PUBLIC_VAULT_CONTRACT_ID=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBSC4
NEXT_PUBLIC_ACL_CONTRACT_ID=CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSC4

# Application config
NEXT_PUBLIC_APP_NAME=StellarGuard
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

---

## Behavior by Environment

### Missing Contract IDs in Production Mode

If `NEXT_PUBLIC_USE_MOCK_TREASURY` is **not set** and a contract ID is missing:

```
Error: Missing required frontend environment variable: NEXT_PUBLIC_TREASURY_CONTRACT_ID.
Add it to frontend/.env.local before starting the app.
```

**Resolution**: Either:
1. Add all contract IDs to `.env.local`, or
2. Enable mock mode with `NEXT_PUBLIC_USE_MOCK_TREASURY=1`

---

## Troubleshooting

### "Cannot read contracts — contracts are not configured"

**Cause**: Missing contract IDs in production mode  
**Solution**: Add contract IDs to `.env.local` or enable mock mode

### "Failed to connect to RPC"

**Cause**: Invalid or unreachable `NEXT_PUBLIC_SOROBAN_RPC_URL`  
**Solution**: Verify the URL is correct and the endpoint is live

### Mock data is not showing

**Cause**: `NEXT_PUBLIC_USE_MOCK_TREASURY` is not set to `"1"`  
**Solution**: Ensure the variable is exactly `NEXT_PUBLIC_USE_MOCK_TREASURY=1` (the value must be the string `"1"`)

### "Network mismatch" warning

**Cause**: Freighter wallet is on a different network than `NEXT_PUBLIC_NETWORK`  
**Solution**: Switch your wallet to match the configured network or update the env var

---

## Development Workflow

### For Feature Development (Use Mock Mode)

```bash
# Minimal setup for quick iteration
NEXT_PUBLIC_USE_MOCK_TREASURY=1
NEXT_PUBLIC_ENABLE_DEBUG=true
```

### For Integration Testing (Use Real Contracts)

```bash
# Full setup with deployed contracts
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_TREASURY_CONTRACT_ID=<deployed-id>
NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID=<deployed-id>
NEXT_PUBLIC_VAULT_CONTRACT_ID=<deployed-id>
NEXT_PUBLIC_ACL_CONTRACT_ID=<deployed-id>
```

### For Production Deployment

```bash
# Production settings
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_ENABLE_DEBUG=false
# All contract IDs must be populated
```

---

## File Locations

- **Environment configuration**: `frontend/.env.local` (git-ignored, never commit)
- **Example reference**: `frontend/.env.example` (commit this, don't commit `.env.local`)
- **Mock data**: `frontend/src/lib/treasuryMocks.ts`
- **Environment utilities**: `frontend/src/lib/env.ts`
- **Contract configuration**: `frontend/src/lib/soroban.ts`

---

## Next Steps

- **First run**: Use mock mode to explore the UI
- **Testing contracts**: Get deployed contract IDs and populate them
- **Integration**: See `docs/CONTRIBUTOR_CHECKLIST.md` for full onboarding
