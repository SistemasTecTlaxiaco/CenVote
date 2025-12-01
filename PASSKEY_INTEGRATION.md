# Passkey + Freighter Integration Guide

## 🎯 Overview

This guide explains how to integrate **Passkeys (WebAuthn)** with **Freighter Wallet** in your CenVote dApp for Soroban smart contracts.

### What's New
- **PasskeyService.ts** - WebAuthn registration and authentication helpers
- **PasskeyConnector.astro** - UI component for passkey operations
- **FreighterService.ts** - Enhanced wallet connection with better Edge browser support
- **freighter.d.ts** - Clean TypeScript declarations for the Freighter API

---

## 📋 Architecture

### 1. **Passkey Authentication (Client-Side)**
Users register their biometric/device PIN as a passkey. The public key is stored in your Soroban contract.

```
User Device (WebAuthn)
    ↓
PasskeyService (register/authenticate)
    ↓
Soroban Contract (__check_auth verification)
```

### 2. **Wallet Integration (Freighter)**
Freighter handles Stellar transactions, XLM transfers, and contract interactions.

```
User
    ↓
FreighterService (connect/sign)
    ↓
Freighter Extension
    ↓
Stellar Network (Testnet)
```

### 3. **Combined Flow**
```
User Authentication (Passkey) + Wallet Authorization (Freighter) = Signed Transaction
```

---

## 🚀 Quick Start

### 1. Add Passkey Component to Your Page

In any `.astro` page (e.g., `src/pages/index.astro`):

```astro
---
import PasskeyConnector from '../components/PasskeyConnector.astro';
import { freighterService } from '../services/FreighterService';
---

<Layout title="CenVote">
  <PasskeyConnector title="Passkey Authentication" showDebug={true} />
  <!-- Your existing voting UI here -->
</Layout>
```

### 2. Listen for Passkey Events (Optional)

Handle passkey registration/authentication events:

```javascript
// In a script tag or separate .ts file
window.addEventListener('passkeyRegistered', (e: any) => {
  const { userId, credentialId, userName } = e.detail;
  console.log(`Registered: ${userName}`);
  // Send credentialId to your backend or Soroban contract
});

window.addEventListener('passkeyAuthenticated', (e: any) => {
  const { signature, clientDataJSON, authenticatorData } = e.detail;
  console.log(`Authenticated! Ready to sign transaction.`);
  // Use these in your Soroban __check_auth
});
```

### 3. Connect Freighter Wallet

```javascript
import { freighterService } from '../services/FreighterService';

// Check if wallet is available and connect
const isConnected = await freighterService.checkConnection();
if (!isConnected) {
  const result = await freighterService.connect();
  if (!result.success) {
    alert(result.message); // "Install Freighter" or "Switch to TESTNET"
  }
}

// Get connected wallet info
console.log('Public Key:', freighterService.publicKey);
console.log('Network:', freighterService.networkDetails?.network);
```

### 4. Sign a Transaction

```javascript
// Build your Soroban transaction XDR
const txXDR = '...'; // Your transaction XDR string

// Sign with Freighter
const { signed, error } = await freighterService.signTransaction(txXDR);
if (error) {
  alert(`Signing failed: ${error}`);
} else {
  // Submit signed transaction
  console.log('Signed XDR:', signed);
}
```

---

## 🔐 Passkey Storage

Credentials are stored in `localStorage` under key `passkey_credentials`:

```json
{
  "user-1234567890": {
    "credentialId": "base64url_encoded_id",
    "name": "John Doe",
    "createdAt": "2025-11-10T12:00:00Z"
  }
}
```

**In production**, send credential data to your backend/contract instead.

---

## ⚙️ Configuration

### Environment Variables

Create `.env.local` (or `.env`):

```env
# Soroban Contract Address
PUBLIC_SOROBAN_CONTRACT_ID=CBHVPL...

# Stellar Network
PUBLIC_STELLAR_NETWORK=TESTNET
PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Freighter
# (No config needed; Freighter auto-detects via extension)
```

### HTTPS Requirement (Development)

WebAuthn **requires HTTPS**. For local development with self-signed certificate:

```bash
npm run dev:https
# or
npm run build && npm run preview
```

If you don't have `dev:https` script, add it to `package.json`:

```json
{
  "scripts": {
    "dev": "astro dev",
    "dev:https": "astro dev --host localhost --https"
  }
}
```

---

## 🧪 Testing

### Test Passkey Registration
1. Open PasskeyConnector component
2. Click "📱 Register Passkey"
3. Enter your name when prompted
4. Use your device's biometric (fingerprint, face) or PIN
5. See "✓ Passkey registered successfully"

### Test Passkey Authentication
1. Click "🔐 Authenticate"
2. Verify with biometric/PIN
3. See "✓ Authentication successful!"

### Test Freighter Connection
1. Ensure Freighter extension is installed (Windows/macOS/Linux)
2. In browser console:
```javascript
const { freighterService } = await import('./services/FreighterService.ts');
const result = await freighterService.connect();
console.log(result);
```
3. Approve connection in Freighter popup
4. Check console for `publicKey` and `networkDetails`

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebAuthn | ✅ | ✅ | ✅ (12.1+) | ✅ |
| Freighter | ✅ | ✅ | ❌ | ✅ |

---

## 📁 File Structure

```
src/
├── services/
│   ├── FreighterService.ts      # Wallet connection & signing
│   └── PasskeyService.ts        # WebAuthn helpers
├── components/
│   └── PasskeyConnector.astro   # UI for passkey operations
├── types/
│   └── freighter.d.ts           # Freighter API declarations
└── pages/
    └── index.astro              # Main page (add PasskeyConnector here)
```

---

## 🔗 Integration with Soroban Contract

Your Soroban contract should verify signatures using secp256r1 (the curve used by passkeys):

```rust
// contract/src/lib.rs
use soroban_sdk::{contract, contractimpl, Env, BytesN, Error};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn init(env: Env, public_key: BytesN<64>) {
        // Store the passkey public key
        env.storage().instance().set(&0, &public_key);
    }

    pub fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: BytesN<64>,
        _auth_context: Vec<Context>,
    ) -> Result<(), Error> {
        let public_key: BytesN<64> = env.storage().instance().get(&0)?;
        
        // Verify secp256r1 signature
        env.crypto().secp256r1_verify(
            &public_key,
            &signature_payload.into(),
            &signature
        )?;
        
        Ok(())
    }
}
```

---

## 🐛 Troubleshooting

### "Freighter no está disponible"
- Ensure Freighter extension is installed
- Reload the page (Freighter needs time to inject)
- Check browser console for timeout logs

### "WebAuthn not available"
- Ensure you're on HTTPS (or `localhost` in dev)
- Check device supports biometric/PIN (most modern devices do)
- Try a different browser (Safari on iOS, Chrome on Android, Windows Hello on Win10+)

### PasskeyConnector buttons don't work
- Check browser console for errors
- Ensure you're on HTTPS
- Try disabling browser extensions (except Freighter)
- Test with a different device/browser

### Freighter says "Switch to TESTNET"
- Open Freighter extension
- Click network selector (top of popup)
- Select "TESTNET" (or "Stellar Testnet")
- Reload the dApp page

---

## 📚 Resources

- [WebAuthn Guide](https://webauthn.guide/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [Stellar JavaScript SDK](https://github.com/stellar/js-stellar-sdk)
- [Freighter Wallet](https://www.freighter.app/)
- [passkeySoroban Reference](https://github.com/josealfredo79/passkeySoroban)

---

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Test in different browsers
4. Open an issue on the repository

---

**Last Updated**: November 10, 2025
