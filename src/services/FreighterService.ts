// FreighterService.ts - Servicio para integración con Freighter Wallet
// Usa la librería oficial @stellar/freighter-api

import {
    isConnected,
    isAllowed,
    setAllowed,
    requestAccess,
    signTransaction,
    getAddress,
    getNetworkDetails
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

    async isFreighterInstalled(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        try {
            // Verificar si Freighter está instalado usando la API oficial
            const result = await isConnected();
            console.log('🔍 Freighter instalado:', result.isConnected);
            return result.isConnected;
        } catch (error) {
            console.log('❌ Freighter no está instalado');
            return false;
        }
    }

    async checkConnection(): Promise<boolean> {
        try {
            if (typeof window === 'undefined') {
                return false;
            }

            const result = await isConnected();

            console.log('Estado de conexión:', {
                isConnected: result.isConnected,
                hasPublicKey: !!this._publicKey
            });

            this._isConnected = result.isConnected;

            // Si está conectado, intentar obtener detalles de la red si no los tenemos
            if (this._isConnected) {
                try {
                    // Si no tenemos public key, intentar obtenerla
                    if (!this._publicKey) {
                        const addressResult = await getAddress();
                        this._publicKey = addressResult.address;
                    }

                    // Siempre actualizar network details para asegurar que tenemos passphrase
                    const networkDetails = await getNetworkDetails();
                    this._networkDetails = networkDetails as NetworkDetails;
                } catch (err) {
                    console.warn('Error al obtener detalles adicionales de conexión:', err);
                }
            }

            return result.isConnected;
        } catch (e) {
            console.error('Error al verificar la conexión:', e);
            return false;
        }
    }

    async connect(): Promise<ConnectionResult> {
        try {
            console.log('🔄 Iniciando conexión con Freighter...');

            // Verificar si Freighter está instalado
            const installed = await this.isFreighterInstalled();
            if (!installed) {
                return {
                    success: false,
                    message: 'Freighter no está instalada. Por favor instala la extensión desde freighter.app'
                };
            }

            // Verificar si ya tenemos permiso
            console.log('🔐 Verificando permisos...');
            const allowedResult = await isAllowed();
            const allowed = allowedResult.isAllowed;

            if (!allowed) {
                console.log('📝 Solicitando acceso a Freighter...');
                const accessResult = await setAllowed();

                if (!accessResult) {
                    return {
                        success: false,
                        message: 'Acceso denegado. Por favor acepta la solicitud de conexión en Freighter.'
                    };
                }
            }

            // Obtener la clave pública
            console.log('🔑 Obteniendo dirección pública...');
            const addressResult = allowed ? await getAddress() : await requestAccess();
            const publicKey = addressResult.address;
            this._publicKey = publicKey;

            // Verificar si es la cuenta esperada
            if (publicKey === this.EXPECTED_PUBLIC_KEY) {
                console.log('✅ Cuenta verificada: Es la cuenta esperada!');
                console.log(`   ${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`);
            } else {
                console.log('⚠️ Advertencia: La cuenta conectada no coincide con la esperada');
                console.log('   Esperada:', this.EXPECTED_PUBLIC_KEY);
                console.log('   Conectada:', publicKey);
            }

            // Obtener detalles de la red
            console.log('🌐 Obteniendo detalles de la red...');
            const networkDetails = await getNetworkDetails();
            this._networkDetails = networkDetails as NetworkDetails;

            console.log('Red detectada:', networkDetails.network);

            // Validar que esté en TESTNET
            if (networkDetails.network !== 'TESTNET') {
                return {
                    success: false,
                    message: `Por favor cambia a la red TESTNET en Freighter. Red actual: ${networkDetails.network}`
                };
            }

            this._isConnected = true;

            // Guardar en localStorage
            this.saveToStorage();

            console.log('✅ Wallet conectada:', `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`);

            // Disparar evento de conexión
            const event = new CustomEvent('walletConnected', {
                detail: {
                    publicKey: publicKey,
                    network: networkDetails.network,
                    networkPassphrase: networkDetails.networkPassphrase
                }
            });
            window.dispatchEvent(event);

            return {
                success: true,
                message: '✅ Wallet conectada exitosamente',
                publicKey: publicKey
            };
        } catch (error) {
            console.error('❌ Error al conectar con Freighter:', error);

            let errorMessage = 'Error al conectar con Freighter';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                message: errorMessage
            };
        }
    }

    async disconnect(): Promise<void> {
        console.log('🔌 Desconectando wallet...');

        this._isConnected = false;
        this._publicKey = '';
        this._networkDetails = null;

        this.clearStorage();

        // Disparar evento de desconexión
        const event = new CustomEvent('walletDisconnected');
        window.dispatchEvent(event);

        console.log('✅ Wallet desconectada');
    }

    async sendPayment(destinationPublicKey: string, amount: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
        try {
            if (!this._publicKey) {
                return {
                    success: false,
                    error: 'Wallet no conectada. Por favor conecta tu wallet primero.'
                };
            }

            const passphrase = this._networkDetails?.networkPassphrase || 'Test SDF Network ; September 2015';
            const horizonUrl = this._networkDetails?.networkUrl || 'https://horizon-testnet.stellar.org';

            console.log('💸 Preparando pago de', amount, 'XLM a', `${destinationPublicKey.slice(0, 6)}...${destinationPublicKey.slice(-6)}`);
            console.log('🌐 Configuración actual:');
            console.log('   - Horizon URL:', horizonUrl);
            console.log('   - Passphrase:', passphrase);
            console.log('   - Emisor:', this._publicKey);
            console.log('   - Receptor:', destinationPublicKey);

            const server = new StellarSdk.Horizon.Server(horizonUrl);

            // Cargar la cuenta del usuario
            let account;
            try {
                account = await server.loadAccount(this._publicKey);
            } catch (err: any) {
                console.error('❌ Error al cargar la cuenta en Horizon:', err);
                const is404 = err.status === 404 || 
                              (err.response && err.response.status === 404) || 
                              (err.message && err.message.includes('404'));
                if (is404) {
                    throw new Error('Tu cuenta de Testnet no está activa o fondeada en la red Stellar. Por favor, ingresa a https://laboratory.stellar.org/#account-creator y fondea tu clave pública usando Friendbot antes de intentar votar.');
                }
                throw err;
            }

            console.log(`✅ Cuenta emisora cargada. Secuencia: ${account.sequence}`);

            // Construir la transacción de pago
            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: passphrase
            })
                .addOperation(
                    StellarSdk.Operation.payment({
                        destination: destinationPublicKey,
                        asset: StellarSdk.Asset.native(),
                        amount: amount
                    })
                )
                .setTimeout(180)
                .build();

            // Convertir a XDR para firmar
            const xdr = transaction.toXDR();
            console.log('📦 Transacción XDR generada:', xdr);

            console.log('✍️ Solicitando firma de transacción de pago...');

            // Firmar con Freighter
            const { signed, error } = await this.signTransaction(xdr);

            if (error || !signed) {
                throw new Error(error || 'Error al firmar la transacción');
            }

            console.log('✅ Firma recibida. Reconstruyendo transacción...');

            // Reconstruir la transacción firmada desde el XDR firmado
            const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
                signed,
                passphrase
            );

            console.log('📤 Enviando transacción firmada a la red Horizon...');

            // Enviar a la red
            let result;
            try {
                result = await server.submitTransaction(signedTransaction as any);
            } catch (submitErr: any) {
                console.error('❌ Error detallado al enviar transacción a Horizon:', submitErr);
                if (submitErr.response) {
                    console.error('   - Status:', submitErr.response.status);
                    console.error('   - Data:', submitErr.response.data);
                    if (submitErr.response.data?.extras?.result_codes) {
                        console.error('   - Result codes:', submitErr.response.data.extras.result_codes);
                        const codes = submitErr.response.data.extras.result_codes;
                        const txCode = codes.transaction;
                        const opCodes = codes.operations || [];
                        
                        if (txCode === 'tx_underfunded' || opCodes.includes('op_underfunded')) {
                            throw new Error('Balance insuficiente: Tu cuenta de Freighter no tiene suficientes Lumens (XLM) para cubrir el pago y la comisión de red.');
                        } else if (txCode === 'tx_bad_seq') {
                            throw new Error('Secuencia de transacción inválida. Por favor, recarga la página e intenta de nuevo.');
                        } else if (opCodes.includes('op_no_destination')) {
                            throw new Error('La cuenta de destino del pago no está activa en la red de pruebas (Testnet).');
                        } else if (txCode === 'tx_bad_auth' || opCodes.includes('op_bad_auth')) {
                            throw new Error('Firma de transacción no autorizada o cuenta incorrecta en Freighter.');
                        } else {
                            throw new Error(`Transacción rechazada por la red Stellar: ${txCode} (${opCodes.join(', ')})`);
                        }
                    }
                }
                throw submitErr;
            }

            console.log('✅ Pago completado exitosamente!');
            console.log('   Hash:', result.hash);

            return {
                success: true,
                transactionHash: result.hash
            };

        } catch (error) {
            console.error('❌ Error al enviar pago:', error);

            let errorMessage = 'Error al procesar el pago';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async signTransaction(xdr: string): Promise<{ signed?: string; error?: string }> {
        try {
            if (!this._publicKey) {
                return { error: 'Wallet no conectada. Por favor conecta tu wallet primero.' };
            }

            console.log('✍️ Solicitando firma de transacción...');
            const passphrase = this._networkDetails?.networkPassphrase || 'Test SDF Network ; September 2015';

            console.log('   - Usando address/account:', this._publicKey);
            console.log('   - Usando passphrase:', passphrase);

            const signedXdr = await signTransaction(xdr, {
                network: 'TESTNET',
                networkPassphrase: passphrase,
                account: this._publicKey,
                address: this._publicKey
            });

            console.log('✅ Respuesta de Freighter obtenida');
            if (typeof signedXdr === 'string') {
                return { signed: signedXdr };
            } else if (signedXdr && typeof signedXdr === 'object') {
                const casted = signedXdr as any;
                if (casted.error) {
                    return { error: casted.error };
                }
                const signedString = casted.signedTxXdr || casted.signed;
                if (!signedString) {
                    return { error: 'No se recibió la transacción firmada de Freighter.' };
                }
                return { signed: signedString };
            }

            return { error: 'Respuesta inválida al firmar la transacción.' };
        } catch (error) {
            console.error('❌ Error al firmar transacción:', error);

            let errorMessage = 'Error al firmar la transacción';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            return { error: errorMessage };
        }
    }

    async getAccountBalance(): Promise<AccountBalance | null> {
        try {
            if (!this._publicKey) {
                console.error('No hay clave pública disponible');
                return null;
            }

            console.log('💰 Obteniendo balance de la cuenta...');

            // Usar Horizon para obtener el balance
            const horizonUrl = this._networkDetails?.networkUrl || 'https://horizon-testnet.stellar.org';
            const response = await fetch(`${horizonUrl}/accounts/${this._publicKey}`);

            if (!response.ok) {
                throw new Error(`Error al obtener cuenta: ${response.status}`);
            }

            const accountData = await response.json();
            const nativeBalance = accountData.balances.find(
                (b: any) => b.asset_type === 'native'
            );

            if (nativeBalance) {
                console.log('✅ Balance obtenido:', nativeBalance.balance, 'XLM');
                return {
                    balance: nativeBalance.balance,
                    asset: 'XLM'
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Error al obtener balance:', error);
            return null;
        }
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    get publicKey(): string {
        return this._publicKey;
    }

    get networkDetails(): NetworkDetails | null {
        return this._networkDetails;
    }

    get expectedPublicKey(): string {
        return this.EXPECTED_PUBLIC_KEY;
    }
}

export const freighterService = FreighterService.getInstance();