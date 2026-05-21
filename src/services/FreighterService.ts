// FreighterService.ts - Servicio para integración con Freighter Wallet
// Implementado según documentación oficial: https://docs.freighter.app/docs/guide/usingFreighterWebApp
// Usa @stellar/freighter-api v5 con imports directos

import {
    isConnected,
    isAllowed,
    setAllowed,
    requestAccess,
    getAddress,
    getNetworkDetails,
    signTransaction,
} from '@stellar/freighter-api';
import * as StellarSdk from 'stellar-sdk';

interface NetworkDetails {
    network: string;
    networkUrl: string;
    networkPassphrase: string;
    sorobanRpcUrl?: string;
}

interface ConnectionResult {
    success: boolean;
    message: string;
    publicKey?: string;
}

interface AccountBalance {
    balance: string;
    asset: string;
}

export class FreighterService {
    private static instance: FreighterService;
    private _isConnected = false;
    private _publicKey = '';
    private _networkDetails: NetworkDetails | null = null;
    private readonly STORAGE_KEY_PUBLIC_KEY = 'freighter_public_key';
    private readonly STORAGE_KEY_NETWORK = 'freighter_network';
    private readonly EXPECTED_PUBLIC_KEY = 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV';

    private constructor() {
        this.loadFromStorage();
    }

    static getInstance() {
        if (!FreighterService.instance) {
            FreighterService.instance = new FreighterService();
        }
        return FreighterService.instance;
    }

    private loadFromStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            const savedPublicKey = localStorage.getItem(this.STORAGE_KEY_PUBLIC_KEY);
            const savedNetwork = localStorage.getItem(this.STORAGE_KEY_NETWORK);
            if (savedPublicKey && savedNetwork) {
                this._publicKey = savedPublicKey;
                console.log('✓ Datos de wallet cargados desde localStorage');
            }
        } catch (e) {
            console.error('Error al cargar datos de localStorage:', e);
        }
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            if (this._publicKey) {
                localStorage.setItem(this.STORAGE_KEY_PUBLIC_KEY, this._publicKey);
            }
            if (this._networkDetails) {
                localStorage.setItem(this.STORAGE_KEY_NETWORK, this._networkDetails.network);
            }
        } catch (e) {
            console.error('Error al guardar en localStorage:', e);
        }
    }

    private clearStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(this.STORAGE_KEY_PUBLIC_KEY);
            localStorage.removeItem(this.STORAGE_KEY_NETWORK);
        } catch (e) {
            console.error('Error al limpiar localStorage:', e);
        }
    }

    /**
     * Verifica si Freighter está instalado en el navegador.
     * Según docs oficiales: isConnected() retorna { isConnected: boolean }
     */
    async isFreighterInstalled(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        try {
            const result = await isConnected();
            console.log('🔍 isConnected() result:', result);
            return !!result.isConnected;
        } catch (error) {
            console.log('❌ Freighter no detectado:', error);
            return false;
        }
    }

    /**
     * Verifica el estado de conexión actual con Freighter.
     */
    async checkConnection(): Promise<boolean> {
        if (typeof window === 'undefined') return false;
        try {
            const connResult = await isConnected();
            if (!connResult.isConnected) {
                this._isConnected = false;
                return false;
            }

            // Verificar si la app ya está autorizada
            const allowedResult = await isAllowed();
            if (!allowedResult.isAllowed) {
                this._isConnected = false;
                return false;
            }

            // Obtener dirección si ya tenemos permiso
            try {
                const addressResult = await getAddress();
                if (addressResult.address) {
                    this._publicKey = addressResult.address;
                }
            } catch (err) {
                console.warn('No se pudo obtener address en checkConnection:', err);
            }

            // Obtener detalles de red
            try {
                const netDetails = await getNetworkDetails();
                this._networkDetails = netDetails as NetworkDetails;
            } catch (err) {
                console.warn('No se pudo obtener networkDetails en checkConnection:', err);
            }

            this._isConnected = true;
            return true;
        } catch (e) {
            console.error('Error en checkConnection:', e);
            return false;
        }
    }

    /**
     * Conecta con Freighter solicitando acceso al usuario.
     * Flujo oficial: isConnected -> setAllowed -> requestAccess -> getNetworkDetails
     */
    async connect(): Promise<ConnectionResult> {
        try {
            console.log('🔄 Iniciando conexión con Freighter...');

            // 1. Verificar que Freighter esté instalado
            const connResult = await isConnected();
            console.log('1️⃣ isConnected:', connResult);
            
            if (!connResult.isConnected) {
                return {
                    success: false,
                    message: 'Freighter no está instalada. Instálala desde freighter.app y recarga la página.'
                };
            }

            // 2. Verificar/solicitar permisos
            const allowedResult = await isAllowed();
            console.log('2️⃣ isAllowed:', allowedResult);
            
            if (!allowedResult.isAllowed) {
                console.log('📝 Solicitando permiso con setAllowed()...');
                const setAllowedResult = await setAllowed();
                console.log('   setAllowed result:', setAllowedResult);
                
                if (!setAllowedResult.isAllowed) {
                    return {
                        success: false,
                        message: 'Permiso denegado. Acepta la solicitud en Freighter.'
                    };
                }
            }

            // 3. Solicitar acceso / obtener clave pública
            console.log('3️⃣ Solicitando requestAccess()...');
            const accessResult = await requestAccess();
            console.log('   requestAccess result:', accessResult);

            if (accessResult.error) {
                return {
                    success: false,
                    message: `Error de Freighter: ${accessResult.error}`
                };
            }

            const publicKey = accessResult.address;
            if (!publicKey) {
                return {
                    success: false,
                    message: 'No se recibió clave pública de Freighter.'
                };
            }

            this._publicKey = publicKey;

            // 4. Obtener detalles de red
            console.log('4️⃣ Obteniendo getNetworkDetails()...');
            const networkResult = await getNetworkDetails();
            console.log('   networkDetails:', networkResult);
            this._networkDetails = networkResult as NetworkDetails;

            // 5. Validar red TESTNET
            if (networkResult.network !== 'TESTNET') {
                return {
                    success: false,
                    message: `Cambia a TESTNET en Freighter. Red actual: ${networkResult.network}`
                };
            }

            // 6. Marcar como conectado y guardar
            this._isConnected = true;
            this.saveToStorage();

            // Verificar cuenta esperada
            if (publicKey === this.EXPECTED_PUBLIC_KEY) {
                console.log('✅ Cuenta verificada: Es la cuenta esperada!');
            } else {
                console.log('⚠️ Cuenta diferente a la esperada');
                console.log('   Esperada:', this.EXPECTED_PUBLIC_KEY);
                console.log('   Conectada:', publicKey);
            }

            console.log('✅ Wallet conectada:', `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`);

            // Disparar evento
            window.dispatchEvent(new CustomEvent('walletConnected', {
                detail: {
                    publicKey,
                    network: networkResult.network,
                    networkPassphrase: networkResult.networkPassphrase
                }
            }));

            return {
                success: true,
                message: '✅ Wallet conectada exitosamente',
                publicKey
            };
        } catch (error) {
            console.error('❌ Error al conectar con Freighter:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Error desconocido al conectar'
            };
        }
    }

    async disconnect(): Promise<void> {
        console.log('🔌 Desconectando wallet...');
        this._isConnected = false;
        this._publicKey = '';
        this._networkDetails = null;
        this.clearStorage();
        window.dispatchEvent(new CustomEvent('walletDisconnected'));
        console.log('✅ Wallet desconectada');
    }

    async sendPayment(destinationPublicKey: string, amount: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        try {
            if (!this._publicKey) {
                return { success: false, error: 'Wallet no conectada.' };
            }

            const passphrase = this._networkDetails?.networkPassphrase || 'Test SDF Network ; September 2015';
            const horizonUrl = this._networkDetails?.networkUrl || 'https://horizon-testnet.stellar.org';

            console.log('💸 Preparando pago de', amount, 'XLM a', `${destinationPublicKey.slice(0, 6)}...${destinationPublicKey.slice(-6)}`);

            const server = new StellarSdk.Horizon.Server(horizonUrl);

            let account;
            try {
                account = await server.loadAccount(this._publicKey);
            } catch (err: any) {
                const is404 = err.status === 404 || (err.response?.status === 404) || err.message?.includes('404');
                if (is404) {
                    throw new Error('Tu cuenta no está activa. Fondéala con Friendbot: https://laboratory.stellar.org/#account-creator');
                }
                throw err;
            }

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: passphrase
            })
                .addOperation(StellarSdk.Operation.payment({
                    destination: destinationPublicKey,
                    asset: StellarSdk.Asset.native(),
                    amount
                }))
                .setTimeout(180)
                .build();

            const xdr = transaction.toXDR();
            const { signed, error } = await this.signTransactionXdr(xdr);
            if (error || !signed) throw new Error(error || 'Error al firmar');

            const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(signed, passphrase);

            let result;
            try {
                result = await server.submitTransaction(signedTransaction as any);
            } catch (submitErr: any) {
                if (submitErr.response?.data?.extras?.result_codes) {
                    const codes = submitErr.response.data.extras.result_codes;
                    const txCode = codes.transaction;
                    const opCodes = codes.operations || [];
                    if (txCode === 'tx_underfunded' || opCodes.includes('op_underfunded')) {
                        throw new Error('Balance insuficiente de XLM.');
                    } else if (txCode === 'tx_bad_seq') {
                        throw new Error('Secuencia inválida. Recarga e intenta de nuevo.');
                    } else if (opCodes.includes('op_no_destination')) {
                        throw new Error('Cuenta destino no activa en Testnet.');
                    } else {
                        throw new Error(`Rechazada: ${txCode} (${opCodes.join(', ')})`);
                    }
                }
                throw submitErr;
            }

            console.log('✅ Pago exitoso! Hash:', result.hash);
            return { success: true, transactionHash: result.hash };
        } catch (error) {
            console.error('❌ Error en pago:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Error en pago' };
        }
    }

    /**
     * Firma una transacción XDR usando Freighter.
     * Según docs: signTransaction retorna { signedTxXdr: string; signerAddress: string; }
     */
    async signTransactionXdr(xdr: string): Promise<{ signed?: string; error?: string }> {
        try {
            if (!this._publicKey) {
                return { error: 'Wallet no conectada.' };
            }

            const passphrase = this._networkDetails?.networkPassphrase || 'Test SDF Network ; September 2015';
            console.log('✍️ Firmando transacción...');

            const result = await signTransaction(xdr, {
                networkPassphrase: passphrase,
                address: this._publicKey,
            });

            console.log('✅ signTransaction result:', result);

            if ((result as any).error) {
                return { error: (result as any).error };
            }

            // v5 API: result es { signedTxXdr, signerAddress }
            const signedXdr = (result as any).signedTxXdr || (result as any).signed || (typeof result === 'string' ? result : undefined);
            if (!signedXdr) {
                return { error: 'No se recibió transacción firmada.' };
            }

            return { signed: signedXdr };
        } catch (error) {
            console.error('❌ Error al firmar:', error);
            return { error: error instanceof Error ? error.message : 'Error al firmar' };
        }
    }

    async getAccountBalance(): Promise<AccountBalance | null> {
        try {
            if (!this._publicKey) return null;

            const horizonUrl = this._networkDetails?.networkUrl || 'https://horizon-testnet.stellar.org';
            const response = await fetch(`${horizonUrl}/accounts/${this._publicKey}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const accountData = await response.json();
            const nativeBalance = accountData.balances.find((b: any) => b.asset_type === 'native');

            if (nativeBalance) {
                return { balance: nativeBalance.balance, asset: 'XLM' };
            }
            return null;
        } catch (error) {
            console.error('❌ Error al obtener balance:', error);
            return null;
        }
    }

    get isConnected(): boolean { return this._isConnected; }
    get publicKey(): string { return this._publicKey; }
    get networkDetails(): NetworkDetails | null { return this._networkDetails; }
    get expectedPublicKey(): string { return this.EXPECTED_PUBLIC_KEY; }
}

export const freighterService = FreighterService.getInstance();