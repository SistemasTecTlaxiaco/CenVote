// Stellar SDK utilities for CenVote DApp
// Helper functions for working with Stellar and Soroban

import {
    Asset,
    Keypair,
    Networks,
    Operation,
    TransactionBuilder,
    BASE_FEE,
    Horizon
} from 'stellar-sdk';

export interface StellarAccount {
    publicKey: string;
    balance: string;
    sequence: string;
}

export class StellarUtils {
    private static horizonTestnetUrl = 'https://horizon-testnet.stellar.org';
    private static sorobanTestnetUrl = 'https://soroban-testnet.stellar.org';

    /**
     * Get account details from Horizon
     */
    static async getAccount(publicKey: string, isTestnet: boolean = true): Promise<StellarAccount | null> {
        try {
            const horizonUrl = isTestnet ? this.horizonTestnetUrl : 'https://horizon.stellar.org';
            const server = new Horizon.Server(horizonUrl);

            const account = await server.loadAccount(publicKey);
            const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');

            return {
                publicKey: account.accountId(),
                balance: nativeBalance?.balance || '0',
                sequence: account.sequence
            };
        } catch (error) {
            console.error('Error fetching account:', error);
            return null;
        }
    }

    /**
     * Get account balance in XLM
     */
    static async getAccountBalance(publicKey: string, isTestnet: boolean = true): Promise<number> {
        const account = await this.getAccount(publicKey, isTestnet);
        return account ? parseFloat(account.balance) : 0;
    }

    /**
     * Validate Stellar public key format
     */
    static isValidPublicKey(publicKey: string): boolean {
        try {
            Keypair.fromPublicKey(publicKey);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Format public key for display (shortened)
     */
    static formatPublicKey(publicKey: string, startChars: number = 6, endChars: number = 6): string {
        if (!publicKey || publicKey.length < startChars + endChars) {
            return publicKey;
        }
        return `${publicKey.slice(0, startChars)}...${publicKey.slice(-endChars)}`;
    }

    /**
     * Get network passphrase for testnet or mainnet
     */
    static getNetworkPassphrase(isTestnet: boolean = true): string {
        return isTestnet ? Networks.TESTNET : Networks.PUBLIC;
    }

    /**
     * Create a simple payment transaction XDR
     * This is a helper for testing transaction signing
     */
    static async createPaymentTransactionXDR(
        sourcePublicKey: string,
        destinationPublicKey: string,
        amount: string,
        isTestnet: boolean = true
    ): Promise<string | null> {
        try {
            const horizonUrl = isTestnet ? this.horizonTestnetUrl : 'https://horizon.stellar.org';
            const server = new Horizon.Server(horizonUrl);
            const sourceAccount = await server.loadAccount(sourcePublicKey);

            const transaction = new TransactionBuilder(sourceAccount, {
                fee: BASE_FEE,
                networkPassphrase: this.getNetworkPassphrase(isTestnet)
            })
                .addOperation(
                    Operation.payment({
                        destination: destinationPublicKey,
                        asset: Asset.native(),
                        amount: amount
                    })
                )
                .setTimeout(180)
                .build();

            return transaction.toXDR();
        } catch (error) {
            console.error('Error creating payment transaction:', error);
            return null;
        }
    }

    /**
     * Check if account exists on the network
     */
    static async accountExists(publicKey: string, isTestnet: boolean = true): Promise<boolean> {
        const account = await this.getAccount(publicKey, isTestnet);
        return account !== null;
    }

    /**
     * Format XLM amount for display
     */
    static formatXLMAmount(amount: string | number, decimals: number = 2): string {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return numAmount.toFixed(decimals);
    }

    /**
     * Get Horizon server instance
     */
    static getHorizonServer(isTestnet: boolean = true): Horizon.Server {
        const url = isTestnet ? this.horizonTestnetUrl : 'https://horizon.stellar.org';
        return new Horizon.Server(url);
    }
}

export default StellarUtils;
