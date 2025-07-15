// hooks/useDataManager.ts - Enhanced with better refresh management
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
  private forceRefreshQueue = new Set<string>();

  private constructor() {
    this.config = {
      rpcUrls: ['https://polygon.drpc.org'],
      cacheTTLs: {
        balances: 15000,      // 15 seconds - changes with transactions
        casinoStats: 30000,   // 30 seconds - changes with bets/refills
        faucetState: 60000,   // 1 minute - predictable timing
        dexReserves: 45000,   // 45 seconds - changes with swaps
        dexQuotes: 10000,     // 10 seconds - should be reasonably fresh
      },
      refreshIntervals: {
        balances: 20000,      // Every 20 seconds
        casinoStats: 35000,   // Every 35 seconds
        faucetState: 120000,  // Every 2 minutes
        dexReserves: 60000,   // Every 1 minute
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

  // Enhanced cache validity check with force refresh support
  private isCacheValid(key: string): boolean {
    if (this.forceRefreshQueue.has(key)) {
      this.forceRefreshQueue.delete(key);
      return false;
    }
    
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < cached.ttl;
  }

  // Force refresh for specific keys
  forceRefresh(key: string) {
    console.log('🔄 Force refresh requested for:', key);
    this.forceRefreshQueue.add(key);
    this.invalidateCache(key);
    
    // Trigger immediate refresh for subscribers
    const subs = this.subscribers.get(key);
    if (subs && subs.size > 0) {
      // Get the fetcher function from the key type
      const baseKey = key.split(':')[0];
      this.triggerImmediateRefresh(key, baseKey);
    }
  }

  // Trigger immediate refresh for a specific key
  private async triggerImmediateRefresh(key: string, baseKey: string) {
    try {
      let fetcher: (() => Promise<any>) | null = null;
      
      if (baseKey === 'balances') {
        const address = key.split(':')[1];
        if (address) {
          fetcher = () => this.fetchBalances(address);
        }
      } else if (baseKey === 'casinoStats') {
        fetcher = () => this.fetchCasinoStats();
      } else if (baseKey === 'faucetState') {
        const address = key.split(':')[1];
        if (address) {
          fetcher = () => this.fetchFaucetState(address);
        }
      } else if (baseKey === 'dexReserves') {
        fetcher = () => this.fetchDexReserves();
      }
      
      if (fetcher) {
        await fetcher();
      }
    } catch (error) {
      console.error(`❌ Force refresh failed for ${key}:`, error);
    }
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
      subs.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('❌ Subscriber callback error:', error);
        }
      });
    }
  }

  // Enhanced data fetcher with better error handling and retry logic
  private async getData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
    retryCount: number = 0
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

    // Start new request with retry logic
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
        console.error(`❌ Request failed for ${key} (attempt ${retryCount + 1}):`, error);
        this.pendingRequests.delete(key);
        
        // Retry logic for network errors
        if (retryCount < 2 && (error.code === 'NETWORK_ERROR' || error.message.includes('network'))) {
          console.log(`🔄 Retrying request for ${key} in 1 second...`);
          return new Promise<T>((resolve, reject) => {
            setTimeout(() => {
              this.getData(key, fetcher, ttl, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, 1000);
          });
        }
        
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  // Fetch user balances (POL + SHIT) with enhanced error handling
  async fetchBalances(address: string): Promise<{ pol: string; shit: string }> {
    const key = `balances:${address}`;
    
    return this.getData(key, async () => {
      console.log('🌐 Fetching balances for:', address);
      
      const SHIT_ADDRESS = process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS!;
      
      try {
        // Batch both calls efficiently with timeout
        const balancePromises = Promise.all([
          this.provider.getBalance(address),
          this.provider.call({
            to: SHIT_ADDRESS,
            data: `0x70a08231000000000000000000000000${address.slice(2)}`
          })
        ]);

        // Add timeout to prevent hanging requests
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );

        const [polBalance, shitBalanceHex] = await Promise.race([balancePromises, timeoutPromise]);

        const result = {
          pol: parseFloat(ethers.utils.formatEther(polBalance)).toFixed(4),
          shit: parseFloat(ethers.utils.formatEther(shitBalanceHex)).toFixed(0)
        };

        console.log('✅ Balances fetched:', result);
        return result;
      } catch (error) {
        console.error('❌ Balance fetch error:', error);
        // Return cached data if available, otherwise throw
        const cached = this.cache.get(key);
        if (cached) {
          console.log('🔄 Using stale cached balance data');
          return cached.data;
        }
        throw error;
      }
    }, this.config.cacheTTLs.balances);
  }

  // Fetch casino stats with enhanced reliability
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
      
      try {
        // Create contract instance with timeout
        const casinoContract = new ethers.Contract(
          CASINO_ADDRESS,
          ['function getCasinoStats() view returns (uint256 houseBalanceAmount, uint256 minBetAmount, uint256 maxBetAmount, uint256 currentMaxBet, uint256 winChance, bool refillNeeded, uint256 nextRefillTime)'],
          this.provider
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Casino stats timeout')), 8000)
        );

        const result = await Promise.race([casinoContract.getCasinoStats(), timeoutPromise]);
        
        const stats = {
          houseBalance: Number(ethers.utils.formatEther(result[0])),
          minBet: Number(ethers.utils.formatEther(result[1])),
          maxBet: Number(ethers.utils.formatEther(result[2])),
          currentMaxBet: Number(ethers.utils.formatEther(result[3])),
          needsRefill: result[5],
          timeUntilRefill: Number(result[6])
        };

        console.log('✅ Casino stats fetched:', stats);
        return stats;
      } catch (error) {
        console.error('❌ Casino stats fetch error:', error);
        const cached = this.cache.get(key);
        if (cached) {
          console.log('🔄 Using stale cached casino data');
          return cached.data;
        }
        throw error;
      }
    }, this.config.cacheTTLs.casinoStats);
  }

  // Fetch faucet state with better error handling
  async fetchFaucetState(address: string): Promise<{
    canClaim: boolean;
    timeUntilClaim: number;
  }> {
    const key = `faucetState:${address}`;
    
    return this.getData(key, async () => {
      console.log('🚰 Fetching faucet state for:', address);
      
      const SHIT_ADDRESS = process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS!;
      
      try {
        const shitContract = new ethers.Contract(
          SHIT_ADDRESS,
          [
            'function canClaimFaucet(address user) view returns (bool)',
            'function timeUntilNextClaim(address user) view returns (uint256)'
          ],
          this.provider
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Faucet state timeout')), 8000)
        );

        const [canClaim, timeUntil] = await Promise.race([
          Promise.all([
            shitContract.canClaimFaucet(address),
            shitContract.timeUntilNextClaim(address)
          ]),
          timeoutPromise
        ]);
        
        const result = {
          canClaim,
          timeUntilClaim: Number(timeUntil)
        };

        console.log('✅ Faucet state fetched:', result);
        return result;
      } catch (error) {
        console.error('❌ Faucet state fetch error:', error);
        const cached = this.cache.get(key);
        if (cached) {
          console.log('🔄 Using stale cached faucet data');
          return cached.data;
        }
        throw error;
      }
    }, this.config.cacheTTLs.faucetState);
  }

  // Fetch DEX reserves with timeout protection
  async fetchDexReserves(): Promise<{ matic: number; shit: number }> {
    const key = 'dexReserves';
    
    return this.getData(key, async () => {
      console.log('🔄 Fetching DEX reserves...');
      
      const DEX_ADDRESS = process.env.NEXT_PUBLIC_DEX_ADDRESS!;
      
      try {
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('DEX reserves timeout')), 8000)
        );

        const result = await Promise.race([
          this.provider.call({
            to: DEX_ADDRESS,
            data: '0x0902f1ac' // getReserves() function selector
          }),
          timeoutPromise
        ]);
        
        // Decode the result
        const polReserve = parseInt(result.slice(2, 66), 16) / 1e18;
        const shitReserve = parseInt(result.slice(66, 130), 16) / 1e18;
        
        const reserves = {
          matic: polReserve,
          shit: shitReserve
        };

        console.log('✅ DEX reserves fetched:', reserves);
        return reserves;
      } catch (error) {
        console.error('❌ DEX reserves fetch error:', error);
        const cached = this.cache.get(key);
        if (cached) {
          console.log('🔄 Using stale cached DEX data');
          return cached.data;
        }
        throw error;
      }
    }, this.config.cacheTTLs.dexReserves);
  }

  // Fetch DEX quote with validation
  async fetchDexQuote(amount: string, direction: 'matic-to-shit' | 'shit-to-matic'): Promise<{
    shitOut: string;
    feeAmount: string;
  } | null> {
    if (!amount || parseFloat(amount) <= 0) return null;
    
    const key = `dexQuote:${direction}:${amount}`;
    
    return this.getData(key, async () => {
      console.log('💱 Fetching DEX quote:', { amount, direction });
      
      const DEX_ADDRESS = process.env.NEXT_PUBLIC_DEX_ADDRESS!;
      
      try {
        const dexContract = new ethers.Contract(
          DEX_ADDRESS,
          [
            'function getMaticToShitQuote(uint256 maticAmount) view returns (uint256 shitOut, uint256 feeAmount)',
            'function getShitToMaticQuote(uint256 shitAmount) view returns (uint256 maticOut, uint256 feeAmount)'
          ],
          this.provider
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('DEX quote timeout')), 5000)
        );

        let result;
        if (direction === 'matic-to-shit') {
          result = await Promise.race([
            dexContract.getMaticToShitQuote(ethers.utils.parseEther(amount)),
            timeoutPromise
          ]);
        } else {
          result = await Promise.race([
            dexContract.getShitToMaticQuote(ethers.utils.parseEther(amount)),
            timeoutPromise
          ]);
        }
        
        const quote = {
          shitOut: ethers.utils.formatEther(result[0]),
          feeAmount: ethers.utils.formatEther(result[1])
        };

        console.log('✅ DEX quote fetched:', quote);
        return quote;
      } catch (error) {
        console.error('❌ DEX quote fetch error:', error);
        return null; // Return null for quote errors instead of cached data
      }
    }, this.config.cacheTTLs.dexQuotes);
  }

  // Enhanced auto-refresh with better timing
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
        // Only refresh if we have subscribers
        const subs = this.subscribers.get(key);
        if (!subs || subs.size === 0) {
          console.log('🛑 No subscribers for', key, '- stopping auto-refresh');
          clearInterval(timer);
          this.refreshTimers.delete(key);
          return;
        }
        
        this.invalidateCache(key);
        await fetcher();
      } catch (error) {
        console.error(`Auto-refresh failed for ${key}:`, error);
      }
    }, interval);
    
    this.refreshTimers.set(key, timer);
    console.log(`🔄 Auto-refresh started for ${key} (${interval}ms)`);
  }

  // Enhanced invalidation for transaction events
  invalidateForTransaction(txType: 'faucet' | 'casino' | 'dex', userAddress?: string) {
    console.log('🔄 Invalidating data for transaction:', txType, userAddress);
    
    switch (txType) {
      case 'faucet':
        if (userAddress) {
          this.forceRefresh(`balances:${userAddress}`);
          this.forceRefresh(`faucetState:${userAddress}`);
        }
        break;
      case 'casino':
        if (userAddress) {
          this.forceRefresh(`balances:${userAddress}`);
        }
        this.forceRefresh('casinoStats');
        break;
      case 'dex':
        if (userAddress) {
          this.forceRefresh(`balances:${userAddress}`);
        }
        this.forceRefresh('dexReserves');
        // Clear all DEX quotes as they may now be stale
        const cacheKeys = Array.from(this.cache.keys());
        for (const key of cacheKeys) {
          if (key.startsWith('dexQuote:')) {
            this.invalidateCache(key);
          }
        }
        break;
    }
  }

  // Invalidate cache entry
  invalidateCache(key: string) {
    this.cache.delete(key);
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

// Enhanced React hooks with better refresh management
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
    console.log('🔄 Manual refresh requested for balances');
    dataManager.forceRefresh(`balances:${address}`);
  }, [address, dataManager]);

  useEffect(() => {
    if (!address) return;

    const key = `balances:${address}`;
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, (newData) => {
      setData(newData);
      setError(null);
    });
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [address, fetchData, dataManager]);

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

  const refresh = useCallback(() => {
    console.log('🔄 Manual refresh requested for casino stats');
    dataManager.forceRefresh('casinoStats');
  }, [dataManager]);

  useEffect(() => {
    const key = 'casinoStats';
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, (newData) => {
      setData(newData);
      setError(null);
    });
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [fetchData, dataManager]);

  return { data, loading, error, refresh };
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

  const refresh = useCallback(() => {
    if (!address) return;
    console.log('🔄 Manual refresh requested for faucet state');
    dataManager.forceRefresh(`faucetState:${address}`);
  }, [address, dataManager]);

  useEffect(() => {
    if (!address) return;

    const key = `faucetState:${address}`;
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, (newData) => {
      setData(newData);
      setError(null);
    });
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [address, fetchData, dataManager]);

  return { data, loading, error, refresh };
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
    console.log('🔄 Manual refresh requested for DEX reserves');
    dataManager.forceRefresh('dexReserves');
  }, [dataManager]);

  useEffect(() => {
    const key = 'dexReserves';
    
    // Subscribe to updates
    const unsubscribe = dataManager.subscribe(key, (newData) => {
      setData(newData);
    });
    
    // Start auto-refresh
    dataManager.startAutoRefresh(key, fetchData);
    
    // Initial fetch
    fetchData();
    
    return unsubscribe;
  }, [fetchData, dataManager]);

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
  }, [amount, direction, dataManager]);

  return { data, loading };
}

// Enhanced transaction event helper
export function useTransactionEvents() {
  const dataManager = DataManager.getInstance();
  
  return useCallback((txType: 'faucet' | 'casino' | 'dex', userAddress?: string) => {
    dataManager.invalidateForTransaction(txType, userAddress);
  }, [dataManager]);
}

export default DataManager;