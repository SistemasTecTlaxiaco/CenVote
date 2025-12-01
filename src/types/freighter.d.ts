declare global {
  interface Window {
    freighter?: boolean;
    freighterApi?: {
      isConnected: () => Promise<boolean>;
      isAllowed: () => Promise<{ isAllowed: boolean }>;
      requestAccess: () => Promise<boolean | { error?: { message: string } }>;
      getNetworkDetails: () => Promise<{
        network: string;
        networkUrl: string;
        networkPassphrase: string;
        sorobanRpcUrl?: string;
      }>;
      getAddress: () => Promise<{ address: string }>;
      signTransaction: (
        xdr: string,
        opts?: { networkPassphrase?: string }
      ) => Promise<{ signedXDR: string }>;
      signAndSubmitTransaction?: (signedXDR: string) => Promise<any>;
      getTransaction?: (params: {
        network: string;
        source: string;
        contractId?: string;
        method?: string;
        args?: any[];
      }) => Promise<string>;
    };
  }
}

export {};
