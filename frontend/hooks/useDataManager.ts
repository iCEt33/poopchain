// hooks/useDataManager.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface DataManagerConfig {
  rpcUrls: string[];
  cacheTTLs: {
    balances: number;
    casinoStats: number;
    faucetState: number;
    dexReserves: number;
    dexQuotes: number;
  };
  refreshIntervals: {
    balances: number;
    casinoStats: number;
    faucetState: number;
    dexReserves: number;
  };
}

class DataManager {
  private static instance: DataManager;
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, Promise<any>>();
  private subscribers = new Map<string, Set<(data: any) => void>>();
  private provider: ethers.providers.JsonRpcProvider;
  private config: DataManagerConfig;
  private refreshTimers = new Map<string, NodeJS.Timeout>();

  private constructor() {
    this.config = {
      rpcUrls: ['https://polygon.drpc.org'],
      cacheTTLs: {
        balances: 20000,      // 20 seconds - changes with transactions
        casinoStats: 45000,   // 45 seconds - changes with bets/refills
        faucetState: 120000,  // 2 minutes - predictable timing
        dexReserves: 60000,   // 1 minute - changes with swaps
        dexQuotes: 15000,     // 15 seconds - should be reasonably fresh
      },
      refreshIntervals: {
        balances: 30000,      // Every 30 seconds instead of 13
        casinoStats: 60000,   // Every 60 seconds instead of 18
        faucetState: 180000,  // Every 3 minutes instead of 10 seconds
        dexReserves: 120000,  // Every 2 minutes instead of 42 seconds
      }
    };
    
    this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrls[0]);
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  // Check if cached data is still valid
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < cached.ttl;
  }

  // Subscribe to data updates
  subscribe(key: string, callback: (data: any) => void) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
          // Stop refresh timer if no subscribers
          const timer = this.refreshTimers.get(key);
          if (timer) {
            clearInterval(timer);
            this.refreshTimers.delete(key);
          }
        }
      }
    };
  }

  // Notify subscribers
  private notifySubscribers(key: string, data: any) {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(callback => callback(data));
    }
  }

  // Generic data fetcher with caching
  private async getData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Return cached data if valid
    if (this.isCacheValid(key)) {
      console.log('💾 Using cached data for:', key);
      return this.cache.get(key)!.data;
    }

    // Return pending request if already in progress
    if (this.pendingRequests.has(key)) {
      console.log('⏳ Request already pending for:', key);
      return this.pendingRequests.get(key)!;
    }

    // Start new request
    const request = fetcher()
      .then(data => {
        // Cache the result
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          ttl
        });
        
        // Notify subscribers
        this.notifySubscribers(key, data);
        
        // Remove from pending
        this.pendingRequests.delete(key);
        
        return data;
      })
      .catch(error => {
        console.error('❌ Request failed for:', key, error);
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  // Fetch user balances (POL + SHIT)
  async fetchBalances(address: string): Promise<{ pol: string; shit: string }> {
    const key = `balances:${address}`;
    
    return this.getData(key, async () => {
      console.log('🌐 Fetching balances for:', address);
      
      const SHIT_ADDRESS = process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS!;
      
      // Batch both calls efficiently
      const [polBalance, shitBalanceHex] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.call({
          to: SHIT_ADDRESS,
          data: `0x70a08231000000000000000000000000${address.slice(2)}`
        })
      ]);

      const result = {
        pol: parseFloat(ethers.utils.formatEther(polBalance)).toFixed(4),
        shit: parseFloat(ethers.utils.formatEther(shitBalanceHex)).toFixed(0)
      };

      console.log('✅ Balances fetched:', result);
      return result;
    }, this.config.cacheTTLs.balances);
  }

  // Fetch casino stats
  async fetchCasinoStats(): Promise<{
    houseBalance: number;
    minBet: number;
    maxBet: number;
    currentMaxBet: number;
    needsRefill: boolean;
    timeUntilRefill: number;
  }> {
    const key = 'casinoStats';
    
    return this.getData(key, async () => {
      console.log('🎲 Fetching casino stats...');
      
      const CASINO_ADDRESS = process.env.NEXT_PUBLIC_CASINO_ADDRESS!;
      
      // Create contract instance
      const casinoContract = new ethers.Contract(
        CASINO_ADDRESS,
        ['function getCasinoStats() view returns (uint256 houseBalanceAmount, uint256 minBetAmount, uint256 maxBetAmount, uint256 currentMaxBet, uint256 winChance, bool refillNeeded, uint256 nextRefillTime)'],
        this.provider
      );
      
      const result = await casinoContract.getCasinoStats();
      
      const stats = {
        houseBalance: Number(ethers.utils.formatEther(result[0])),
        minBet: Number(ethers.utils.formatEther(result[1])),
        maxBet: Number(ethers.utils.formatEther(result[2])),
        currentMaxBet: Number(ethers.utils.formatEther(result[3])),
        needsRefill: result[5],
        timeUntilRefill: Number(result[6])
      };

      // Parse and log refill timing info
      const nextRefillTime = Number(result[6]); // Time in seconds until next refill
      const now = Math.floor(Date.now() / 1000);
      
      let refillStatus = '';
      if (stats.needsRefill) {
        refillStatus = '✅ READY TO REFILL';
      } else if (nextRefillTime > 0) {
        const minutes = Math.floor(nextRefillTime / 60);
        const seconds = nextRefillTime % 60;
        refillStatus = `⏰ Next refill in: ${minutes}m ${seconds}s`;
      } else {
        refillStatus = '💤 No refill needed (balance sufficient)';
      }

      console.log('✅ Casino stats fetched:', {
        ...stats,
        refillStatus,
        nextRefillSeconds: nextRefillTime
      });
      
      return stats;
    }, this.config.cacheTTLs.casinoStats);
  }

  // Fetch faucet state
  async fetchFaucetState(address: string): Promise<{
    canClaim: boolean;
    timeUntilClaim: number;
  }> {
    const key = `faucetState:${address}`;
    
    return this.getData(key, async () => {
      console.log('🚰 Fetching faucet state for:', address);
      
      const SHIT_ADDRESS = process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS!;
      
      const shitContract = new ethers.Contract(
        SHIT_ADDRESS,
        [
          'function canClaimFaucet(address user) view returns (bool)',
          'function timeUntilNextClaim(address user) view returns (uint256)'
        ],
        this.provider
      );
      
      const [canClaim, timeUntil] = await Promise.all([
        shitContract.canClaimFaucet(address),
        shitContract.timeUntilNextClaim(address)
      ]);
      
      const result = {
        canClaim,
        timeUntilClaim: Number(timeUntil)
      };

      console.log('✅ Faucet state fetched:', result);
      return result;
    }, this.config.cacheTTLs.faucetState);
  }

  // Fetch DEX reserves
  async fetchDexReserves(): Promise<{ matic: number; shit: number }> {
    const key = 'dexReserves';
    
    return this.getData(key, async () => {
      console.log('🔄 Fetching DEX reserves...');
      
      const DEX_ADDRESS = process.env.NEXT_PUBLIC_DEX_ADDRESS!;
      
      const result = await this.provider.call({
        to: DEX_ADDRESS,
        data: '0x0902f1ac' // getReserves() function selector
      });
      
      // Decode the result
      const polReserve = parseInt(result.slice(2, 66), 16) / 1e18;
      const shitReserve = parseInt(result.slice(66, 130), 16) / 1e18;
      
      const reserves = {
        matic: polReserve,
        shit: shitReserve
      };

      console.log('✅ DEX reserves fetched:', reserves);
      return reserves;
    }, this.config.cacheTTLs.dexReserves);
  }

  // Fetch DEX quote
  async fetchDexQuote(amount: string, direction: 'matic-to-shit' | 'shit-to-matic'): Promise<{
    shitOut: string;
    feeAmount: string;
  } | null> {
    if (!amount || parseFloat(amount) <= 0) return null;
    
    const key = `dexQuote:${direction}:${amount}`;
    
    return this.getData(key, async () => {
      console.log('💱 Fetching DEX quote:', { amount, direction });
      
      const DEX_ADDRESS = process.env.NEXT_PUBLIC_DEX_ADDRESS!;
      
      const dexContract = new ethers.Contract(
        DEX_ADDRESS,
        [
          'function getMaticToShitQuote(uint256 maticAmount) view returns (uint256 shitOut, uint256 feeAmount)',
          'function getShitToMaticQuote(uint256 shitAmount) view returns (uint256 maticOut, uint256 feeAmount)'
        ],
        this.provider
      );
      
      let result;
      if (direction === 'matic-to-shit') {
        result = await dexContract.getMaticToShitQuote(ethers.utils.parseEther(amount));
      } else {
        result = await dexContract.getShitToMaticQuote(ethers.utils.parseEther(amount));
      }
      
      const quote = {
        shitOut: ethers.utils.formatEther(result[0]),
        feeAmount: ethers.utils.formatEther(result[1])
      };

      console.log('✅ DEX quote fetched:', quote);
      return quote;
    }, this.config.cacheTTLs.dexQuotes);
  }

  // Start auto-refresh for a data type
  startAutoRefresh(key: string, fetcher: () => Promise<any>) {
    if (this.refreshTimers.has(key)) return; // Already running
    
    const intervalMap: Record<string, number> = {
      balances: this.config.refreshIntervals.balances,
      casinoStats: this.config.refreshIntervals.casinoStats,
      faucetState: this.config.refreshIntervals.faucetState,
      dexReserves: this.config.refreshIntervals.dexReserves,
    };
    
    const baseKey = key.split(':')[0]; // Extract base key from "balances:0x123..."
    const interval = intervalMap[baseKey] || 60000; // Default 1 minute
    
    const timer = setInterval(async () => {
      try {
        this.invalidateCache(key);
        await fetcher();
      } catch (error) {
        console.error(`Auto-refresh failed for ${key}:`, error);
      }
    }, interval);
    
    this.refreshTimers.set(key, timer);
  }

  // Invalidate cache entry
  invalidateCache(key: string) {
    this.cache.delete(key);
  }

  // Invalidate cache for transaction events
  invalidateForTransaction(txType: 'faucet' | 'casino' | 'dex', userAddress?: string) {
    switch (txType) {
      case 'faucet':
        if (userAddress) {
          this.invalidateCache(`balances:${userAddress}`);
          this.invalidateCache(`faucetState:${userAddress}`);
        }
        break;
      case 'casino':
        if (userAddress) {
          this.invalidateCache(`balances:${userAddress}`);
        }
        this.invalidateCache('casinoStats');
        break;
      case 'dex':
        if (userAddress) {
          this.invalidateCache(`balances:${userAddress}`);
        }
        this.invalidateCache('dexReserves');
        break;
    }
  }

  // Clear all cache
  clearCache() {
    this.cache.clear();
  }

  // Cleanup
  destroy() {
    this.refreshTimers.forEach(timer => clearInterval(timer));
    this.refreshTimers.clear();
    this.cache.clear();
    this.pendingRequests.clear();
    this.subscribers.clear();
  }
}

// React hooks for easy usage
export function useOptimizedBalances(address?: string) {
  const [data, setData] = useState<{ pol: string; shit: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const dataManager = DataManager.getInstance();
  
  const fetchData = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataManager.fetchBalances(address);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const refresh = useCallback(() => {
    if (!address) return;
    dataManager.invalidateCache(`balances:${address}`);
    fetchData();
  }, [address, fetchData]);

  useEffect(() => {
    if (!address) return;

    const key = `balances:${address}`;
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, setData);
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [address, fetchData]);

  return { data, loading, error, refresh };
}

export function useOptimizedCasinoStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const dataManager = DataManager.getInstance();
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataManager.fetchCasinoStats();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = 'casinoStats';
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, setData);
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [fetchData]);

  return { data, loading, error };
}

export function useOptimizedFaucetState(address?: string) {
  const [data, setData] = useState<{ canClaim: boolean; timeUntilClaim: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const dataManager = DataManager.getInstance();
  
  const fetchData = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await dataManager.fetchFaucetState(address);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;

    const key = `faucetState:${address}`;
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, setData);
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [address, fetchData]);

  return { data, loading, error };
}

export function useOptimizedDexReserves() {
  const [data, setData] = useState<{ matic: number; shit: number } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const dataManager = DataManager.getInstance();
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      const result = await dataManager.fetchDexReserves();
      setData(result);
    } catch (err) {
      console.error('DEX reserves fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    dataManager.invalidateCache('dexReserves');
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const key = 'dexReserves';
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, setData);
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [fetchData]);

  return { data, loading, refresh };
}

export function useOptimizedDexQuote(amount: string, direction: 'matic-to-shit' | 'shit-to-matic') {
  const [data, setData] = useState<{ shitOut: string; feeAmount: string } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const dataManager = DataManager.getInstance();
  
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setData(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    
    dataManager.fetchDexQuote(amount, direction)
      .then(result => {
        if (!isCancelled) {
          setData(result);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.error('DEX quote fetch failed:', err);
          setData(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [amount, direction]);

  return { data, loading };
}

// Transaction event helper
export function useTransactionEvents() {
  const dataManager = DataManager.getInstance();
  
  return useCallback((txType: 'faucet' | 'casino' | 'dex', userAddress?: string) => {
    dataManager.invalidateForTransaction(txType, userAddress);
  }, []);
}

export default DataManager;