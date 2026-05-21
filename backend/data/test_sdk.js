import * as StellarSdk from '@stellar/stellar-sdk';
console.log('BASE_FEE:', StellarSdk.BASE_FEE);
console.log('keys:', Object.keys(StellarSdk).filter(k => k.includes('FEE') || k.includes('Fee') || k.includes('Asset') || k.includes('Operation') || k.includes('Transaction')));
