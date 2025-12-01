# Manual Contract Deployment Guide

Due to network conditions, contracts may need to be deployed manually. Here's how:

## Option 1: Deploy via CLI (Recommended)

```bash
# From project root
cd contracts

# Deploy each contract
stellar contract deploy --wasm user_registry/target/wasm32-unknown-unknown/release/user_registry.wasm --source deployer --network testnet

stellar contract deploy --wasm candidate_registry/target/wasm32-unknown-unknown/release/candidate_registry.wasm --source deployer --network testnet

stellar contract deploy --wasm survey/target/wasm32-unknown-unknown/release/survey.wasm --source deployer --network testnet
```

Each command will output a Contract ID. Copy these IDs.

## Option 2: Initialize Survey Contract

The survey contract requires initialization:

```bash
stellar contract invoke \
  --id <SURVEY_CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS>
```

## Update Configuration

After deployment, update `contracts/deploy-info.json` with the contract IDs, and set them in your environment:

```bash
# Copy .env.example to .env if you haven't
cp .env.example .env

# Edit .env and add your contract IDs
USER_REGISTRY_CONTRACT_ID=<id_from_deploy>
CANDIDATE_REGISTRY_CONTRACT_ID=<id_from_deploy>
SURVEY_CONTRACT_ID=<id_from_deploy>
```

## Testing Deployment

Test each contract:

```bash
# Test user registry
stellar contract invoke --id <USER_REGISTRY_CONTRACT_ID> --source deployer --network testnet -- get_user_count

# Expected output: 0
```

Contract IDs are also logged in `deploy-info.json` for reference.
