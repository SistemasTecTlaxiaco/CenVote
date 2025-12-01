#!/bin/bash

# CenVote Passkey + Freighter Quick Setup Script
# Run this after git clone to get started quickly

set -e

echo "🚀 CenVote dApp Setup"
echo "===================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js 18+ is required. You have Node.js $NODE_VERSION."
    echo "   Please upgrade: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment
echo ""
echo "🔧 Setting up environment..."

if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "✅ Created .env.local from .env.example"
        echo ""
        echo "📝 Edit .env.local with your settings:"
        echo "   - PUBLIC_SOROBAN_CONTRACT_ID (your deployed contract)"
        echo "   - Other Stellar testnet URLs (already configured)"
    fi
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Edit .env.local with your contract ID:"
echo "   nano .env.local  (or your preferred editor)"
echo ""
echo "2. Start the development server with HTTPS:"
echo "   npm run dev -- --host 127.0.0.1 --https"
echo ""
echo "3. Open your browser:"
echo "   https://127.0.0.1:3000        (Main page)"
echo "   https://127.0.0.1:3000/demo   (Demo page)"
echo ""
echo "4. Accept the self-signed certificate when prompted"
echo ""
echo "📚 Documentation:"
echo "   - PASSKEY_INTEGRATION.md     - Complete integration guide"
echo "   - IMPLEMENTATION_SUMMARY.md  - What's been implemented"
echo ""
echo "💡 Tips:"
echo "   - Register a passkey on the demo page"
echo "   - Connect Freighter wallet"
echo "   - Check browser console for debug logs"
echo "   - Ensure Freighter is set to TESTNET network"
echo ""
echo "🎉 Happy voting!"
