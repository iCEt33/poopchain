'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Configure chains and providers (your original working setup)
const { chains, publicClient } = configureChains(
  [polygon],
  [publicProvider()]
);

// Configure wallet connectors
const { connectors } = getDefaultWallets({
  appName: 'PoopChain',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'placeholder',
  chains
});

// Create wagmi config (your original working setup)
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient
});

// Create a client for React Query (NEW - this is what's needed for wagmi v2)
const queryClient = new QueryClient();

// Custom PoopChain theme
const poopTheme = darkTheme({
  accentColor: '#8B4513', // Poop brown
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider 
          chains={chains} 
          theme={poopTheme}
          appInfo={{
            appName: 'PoopChain',
            learnMoreUrl: 'https://poopchain.lol',
          }}
        >
          {children}
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}