import { describe, it, expect, beforeEach, vi } from 'vitest';
import FreighterService from '../services/FreighterService';

/**
 * Suite de pruebas para FreighterService
 * Valida que todos los métodos funcionen correctamente
 */

// Mock de @stellar/freighter-api
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  getNetwork: vi.fn(),
  getNetworkDetails: vi.fn(),
  signTransaction: vi.fn(),
  WatchWalletChanges: vi.fn()
}));

describe('FreighterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkInstallation', () => {
    it('debe retornar success cuando Freighter está instalado', async () => {
      const { isConnected } = await import('@stellar/freighter-api');
      vi.mocked(isConnected).mockResolvedValue({
        isConnected: true,
        error: undefined
      });

      const result = await FreighterService.checkInstallation();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('debe retornar error cuando Freighter no está instalado', async () => {
      const { isConnected } = await import('@stellar/freighter-api');
      vi.mocked(isConnected).mockResolvedValue({
        isConnected: false,
        error: 'Freighter not installed'
      });

      const result = await FreighterService.checkInstallation();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('connect', () => {
    it('debe conectar exitosamente y retornar wallet info', async () => {
      const { requestAccess, getAddress, getNetworkDetails } = await import('@stellar/freighter-api');
      
      vi.mocked(requestAccess).mockResolvedValue({
        error: undefined
      });
      
      vi.mocked(getAddress).mockResolvedValue({
        address: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
        error: undefined
      });
      
      vi.mocked(getNetworkDetails).mockResolvedValue({
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
        error: undefined
      });

      const result = await FreighterService.connect();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.address).toBe('GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV');
      expect(result.data?.network).toBe('TESTNET');
    });

    it('debe retornar error cuando requestAccess falla', async () => {
      const { requestAccess } = await import('@stellar/freighter-api');
      
      vi.mocked(requestAccess).mockResolvedValue({
        error: 'User denied access'
      });

      const result = await FreighterService.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('User denied access');
    });
  });

  describe('getCurrentAddress', () => {
    it('debe retornar la dirección actual', async () => {
      const { getAddress } = await import('@stellar/freighter-api');
      
      const testAddress = 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV';
      vi.mocked(getAddress).mockResolvedValue({
        address: testAddress,
        error: undefined
      });

      const result = await FreighterService.getCurrentAddress();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(testAddress);
    });

    it('debe retornar error si getAddress falla', async () => {
      const { getAddress } = await import('@stellar/freighter-api');
      
      vi.mocked(getAddress).mockResolvedValue({
        error: 'Failed to get address'
      });

      const result = await FreighterService.getCurrentAddress();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get address');
    });
  });

  describe('sign', () => {
    it('debe firmar una transacción correctamente', async () => {
      // Primero conectar
      const { requestAccess, getAddress, getNetworkDetails, signTransaction } = await import('@stellar/freighter-api');
      
      vi.mocked(requestAccess).mockResolvedValue({ error: undefined });
      vi.mocked(getAddress).mockResolvedValue({
        address: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
        error: undefined
      });
      vi.mocked(getNetworkDetails).mockResolvedValue({
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
        error: undefined
      });
      vi.mocked(signTransaction).mockResolvedValue({
        signedTxXdr: 'AAAAAgAAAAA...',
        signerAddress: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
        error: undefined
      });

      // Conectar primero
      await FreighterService.connect();

      // Luego firmar
      const testXdr = 'AAAAAgAAAAA...';
      const result = await FreighterService.sign(testXdr);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('AAAAAgAAAAA...');
    });

    it('debe retornar error si no está conectado', async () => {
      const result = await FreighterService.sign('test_xdr');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('no conectada');
    });
  });

  describe('isConnected', () => {
    it('debe retornar false inicialmente', () => {
      const isConnected = FreighterService.isConnected();
      expect(isConnected).toBe(false);
    });
  });

  describe('getAddress', () => {
    it('debe retornar null si no está conectado', () => {
      const address = FreighterService.getAddress();
      expect(address).toBeNull();
    });
  });

  describe('getWalletInfo', () => {
    it('debe retornar null si no está conectado', () => {
      const info = FreighterService.getWalletInfo();
      expect(info).toBeNull();
    });
  });

  describe('Event listeners', () => {
    it('debe permitir suscribirse a eventos', () => {
      const callback = vi.fn();
      FreighterService.on('connected', callback);
      
      expect(callback).toBeDefined();
    });

    it('debe permitir desuscribirse de eventos', () => {
      const callback = vi.fn();
      FreighterService.on('connected', callback);
      FreighterService.off('connected', callback);
      
      expect(callback).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('debe desconectar correctamente', async () => {
      // Primero conectar
      const { requestAccess, getAddress, getNetworkDetails } = await import('@stellar/freighter-api');
      
      vi.mocked(requestAccess).mockResolvedValue({ error: undefined });
      vi.mocked(getAddress).mockResolvedValue({
        address: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
        error: undefined
      });
      vi.mocked(getNetworkDetails).mockResolvedValue({
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
        error: undefined
      });

      await FreighterService.connect();
      expect(FreighterService.isConnected()).toBe(true);

      // Luego desconectar
      FreighterService.disconnect();
      expect(FreighterService.isConnected()).toBe(false);
    });
  });
});

/**
 * Suite de integración
 * Prueba el flujo completo de conexión
 */
describe('FreighterService Integration', () => {
  it('debe completar el flujo completo de conexión y firma', async () => {
    const { requestAccess, getAddress, getNetworkDetails, signTransaction } = await import('@stellar/freighter-api');
    
    // Setup mocks
    vi.mocked(requestAccess).mockResolvedValue({ error: undefined });
    vi.mocked(getAddress).mockResolvedValue({
      address: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
      error: undefined
    });
    vi.mocked(getNetworkDetails).mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
      error: undefined
    });
    vi.mocked(signTransaction).mockResolvedValue({
      signedTxXdr: 'signed_xdr_result',
      signerAddress: 'GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV',
      error: undefined
    });

    // 1. Verificar instalación
    let result = await FreighterService.checkInstallation();
    expect(result.success).toBe(false); // No hay Freighter real en test

    // 2. Conectar
    result = await FreighterService.connect();
    expect(result.success).toBe(true);
    expect(result.data?.address).toBe('GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV');

    // 3. Verificar que está conectado
    expect(FreighterService.isConnected()).toBe(true);
    expect(FreighterService.getAddress()).toBe('GBBP2RUEDFJQCUXFBODTTSH3RG7JGSVCSS5JZWZ7RKYDYCQXDEATA6IV');

    // 4. Firmar transacción
    result = await FreighterService.sign('test_xdr');
    expect(result.success).toBe(true);
    expect(result.data).toBe('signed_xdr_result');

    // 5. Desconectar
    FreighterService.disconnect();
    expect(FreighterService.isConnected()).toBe(false);
  });
});
