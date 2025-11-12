/**
 * Servicio oficial de Freighter Wallet para CenVote
 * Basado en patrones oficiales de @stellar/freighter-api
 * 
 * Métodos disponibles:
 * - isConnected(): Verifica si Freighter está instalado
 * - requestAccess(): Solicita acceso a la wallet
 * - getAddress(): Obtiene la dirección pública del usuario
 * - getNetwork(): Obtiene la red actual
 * - getNetworkDetails(): Obtiene detalles de la red (RPC, etc)
 * - signTransaction(): Firma una transacción XDR
 * - watchWalletChanges(): Observa cambios en la wallet
 */

import { 
  isConnected as freighterIsConnected,
  requestAccess,
  getAddress,
  getNetwork,
  getNetworkDetails,
  signTransaction as freighterSignTransaction,
  WatchWalletChanges
} from "@stellar/freighter-api";

interface FreighterResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface WalletInfo {
  address: string;
  network: string;
  networkPassphrase: string;
}

class FreighterService {
  private static instance: FreighterService;
  private walletInfo: WalletInfo | null = null;
  private isWatching: boolean = false;
  private watcher: WatchWalletChanges | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  private constructor() {
    this.initializeListeners();
  }

  static getInstance(): FreighterService {
    if (!FreighterService.instance) {
      FreighterService.instance = new FreighterService();
    }
    return FreighterService.instance;
  }

  private initializeListeners(): void {
    this.listeners.set("connected", new Set());
    this.listeners.set("disconnected", new Set());
    this.listeners.set("networkChanged", new Set());
    this.listeners.set("addressChanged", new Set());
  }

  /**
   * Verifica si Freighter está instalado
   */
  async checkInstallation(): Promise<FreighterResponse<boolean>> {
    try {
      const result = await freighterIsConnected();
      if (result.error) {
        return {
          success: false,
          error: "Freighter no está instalado"
        };
      }
      return {
        success: true,
        data: result.isConnected
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error verificando Freighter"
      };
    }
  }

  /**
   * Solicita acceso a la wallet del usuario
   */
  async connect(): Promise<FreighterResponse<WalletInfo>> {
    try {
      // Solicitar acceso
      const accessResult = await requestAccess();
      if (accessResult.error) {
        return {
          success: false,
          error: accessResult.error
        };
      }

      // Obtener dirección
      const addressResult = await getAddress();
      if (addressResult.error) {
        return {
          success: false,
          error: addressResult.error
        };
      }

      // Obtener detalles de red
      const networkDetailsResult = await getNetworkDetails();
      if (networkDetailsResult.error) {
        return {
          success: false,
          error: networkDetailsResult.error
        };
      }

      this.walletInfo = {
        address: addressResult.address,
        network: networkDetailsResult.network || "unknown",
        networkPassphrase: networkDetailsResult.networkPassphrase || ""
      };

      // Iniciar observador de cambios
      this.startWatching();

      // Notificar a los listeners
      this.emit("connected", this.walletInfo);

      return {
        success: true,
        data: this.walletInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error conectando wallet"
      };
    }
  }

  /**
   * Obtiene la dirección pública actual
   */
  async getCurrentAddress(): Promise<FreighterResponse<string>> {
    try {
      const result = await getAddress();
      if (result.error) {
        return {
          success: false,
          error: result.error
        };
      }
      return {
        success: true,
        data: result.address
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error obteniendo dirección"
      };
    }
  }

  /**
   * Obtiene la red actual
   */
  async getCurrentNetwork(): Promise<FreighterResponse<string>> {
    try {
      const result = await getNetwork();
      if (result.error) {
        return {
          success: false,
          error: result.error
        };
      }
      return {
        success: true,
        data: result.network
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error obteniendo red"
      };
    }
  }

  /**
   * Obtiene detalles completos de la red
   */
  async getNetworkInfo(): Promise<FreighterResponse<WalletInfo>> {
    try {
      const addressResult = await getAddress();
      const networkDetailsResult = await getNetworkDetails();

      if (addressResult.error || networkDetailsResult.error) {
        return {
          success: false,
          error: addressResult.error || networkDetailsResult.error
        };
      }

      const info: WalletInfo = {
        address: addressResult.address,
        network: networkDetailsResult.network || "unknown",
        networkPassphrase: networkDetailsResult.networkPassphrase || ""
      };

      return {
        success: true,
        data: info
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error obteniendo info de red"
      };
    }
  }

  /**
   * Firma una transacción XDR
   */
  async sign(transactionXdr: string): Promise<FreighterResponse<string>> {
    try {
      if (!this.walletInfo) {
        return {
          success: false,
          error: "Wallet no conectada. Por favor conecta primero."
        };
      }

      const result = await freighterSignTransaction(
        transactionXdr,
        {
          networkPassphrase: this.walletInfo.networkPassphrase
        }
      );

      if (result.error) {
        return {
          success: false,
          error: result.error as string
        };
      }

      return {
        success: true,
        data: result.signedTxXdr
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error firmando transacción"
      };
    }
  }

  /**
   * Inicia la observación de cambios en la wallet
   */
  private startWatching(): void {
    if (this.isWatching) return;

    this.watcher = new WatchWalletChanges(2000); // Verificar cada 2 segundos
    this.isWatching = true;

    this.watcher.watch((result) => {
      const previousInfo = this.walletInfo;

      this.walletInfo = {
        address: result.address,
        network: result.network,
        networkPassphrase: result.networkPassphrase
      };

      // Detectar cambios
      if (previousInfo?.address !== result.address) {
        this.emit("addressChanged", result.address);
      }

      if (previousInfo?.network !== result.network) {
        this.emit("networkChanged", result.network);
      }
    });
  }

  /**
   * Detiene la observación de cambios
   */
  stopWatching(): void {
    if (this.watcher && this.isWatching) {
      this.watcher.stop();
      this.isWatching = false;
    }
  }

  /**
   * Desconecta la wallet
   */
  disconnect(): void {
    this.stopWatching();
    this.walletInfo = null;
    this.emit("disconnected");
  }

  /**
   * Obtiene la información actual de la wallet
   */
  getWalletInfo(): WalletInfo | null {
    return this.walletInfo;
  }

  /**
   * Verifica si la wallet está conectada
   */
  isConnected(): boolean {
    return this.walletInfo !== null;
  }

  /**
   * Obtiene la dirección actual (shortcut)
   */
  getAddress(): string | null {
    return this.walletInfo?.address || null;
  }

  /**
   * Suscribe a eventos
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Desuscribe de eventos
   */
  off(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emite un evento
   */
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}

// Exportar instancia única
const freighterService = FreighterService.getInstance();
export { FreighterService };
export type { WalletInfo, FreighterResponse };
export default freighterService;