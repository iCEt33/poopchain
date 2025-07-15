'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Coins, Gamepad2, RefreshCw, Volume2, Wallet, Fuel, Trophy, Menu, X } from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { 
  useClaimFaucet, 
  useCasinoBet,
  useDexSwap,
  useMintingStats,
  useManualRefill,
  useShitAllowance,
  useApproveShit,
  useShitDexAllowance,
  useApproveDex,
  useDexOwner,
  useSyncReserves,
} from '../hooks/useContracts';

// Import optimized data hooks
import {
  useOptimizedBalances,
  useOptimizedCasinoStats,
  useOptimizedFaucetState,
  useOptimizedDexReserves,
  useOptimizedDexQuote,
  useTransactionEvents
} from '../hooks/useDataManager';

// Import the new component
import GasPoolDashboard from './GasPoolDashboard';
import LeaderboardTab from './LeaderboardTab';

// FIXED: Global fart system - make it actually work
class FartSoundSystem {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private isInitialized = false;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSounds();
    }
  }
  
  private initializeSounds() {
    const sounds = {
      'faucet_fart': '/faucet-fart.mp3',
      'win_fart': '/win-fart.mp3',
      'lose_fart': '/lose-fart.mp3',
      'swap_fart': '/swap-fart.mp3',
      'default': '/default-fart.mp3'
    };

    Object.entries(sounds).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = 0.5;
      this.audioCache.set(key, audio);
    });
    
    this.isInitialized = true;
    console.log('🔊 Fart system initialized with', this.audioCache.size, 'sounds');
  }
  
  async playFart(type: string = 'default') {
    if (!this.isInitialized) {
      console.log('🔇 Fart system not initialized');
      return;
    }

    console.log('🔊 Playing fart:', type);
    
    try {
      const audio = this.audioCache.get(type);
      if (!audio) {
        console.log(`🔇 Fart sound "${type}" not found`);
        return;
      }

      audio.currentTime = 0;
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Fart played successfully:', type);
      }
    } catch (error) {
      console.log('❌ Fart failed:', error);
      // Fallback beep
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        console.log('✅ Fallback beep played');
      } catch (fallbackError) {
        console.log('❌ Even fallback beep failed:', fallbackError);
      }
    }
  }
}

// Create global instance
const fartSystem = new FartSoundSystem();

// Make it globally available for hooks
if (typeof window !== 'undefined') {
  (window as any).fartSystem = fartSystem;
}

// Mobile Navigation Component
const MobileNav = ({ 
  selectedTab, 
  setSelectedTab, 
  isOpen, 
  setIsOpen 
}: {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => {
  const tabs = [
    { id: 'faucet', label: 'Faucet', icon: Coins, emoji: '🚰' },
    { id: 'casino', label: 'Casino', icon: Gamepad2, emoji: '🎲' },
    { id: 'dex', label: 'DEX', icon: RefreshCw, emoji: '🔄' },
    { id: 'gaspool', label: 'Gas Pool', icon: Fuel, emoji: '⛽' },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, emoji: '🏆' },
  ];

  return (
    <>
      {/* Mobile menu overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Mobile menu */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-amber-900/95 backdrop-blur-lg 
        border-l border-amber-600/30 z-50 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} md:hidden
      `}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-amber-100">Navigation</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-amber-300 hover:text-amber-100 p-2"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-2">
            {tabs.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => {
                  setSelectedTab(id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-left transition-all ${
                  selectedTab === id
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'bg-amber-800/20 text-amber-200 hover:bg-amber-700/30'
                }`}
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-lg">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// Toast system
const useToast = () => {
  const [toasts, setToasts] = useState<Array<{id: number, message: string, type: 'success' | 'error', isExiting: boolean}>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    console.log('📢 Toast:', message, type);
    
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, isExiting: false }]);
    
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, isExiting: true } : t));
    }, 2000);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, isExiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  }, []);

  return { toasts, showToast, dismissToast };
};

// Mobile-optimized Toast component
const Toast = ({ toast, onClose }: { toast: any, onClose: () => void }) => (
  <div className={`
    fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-auto p-4 md:p-8 
    rounded-lg shadow-lg z-50 transition-all duration-1000 transform text-lg md:text-2xl
    ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white 
    ${toast.isExiting ? 'opacity-0 translate-x-full md:translate-y-[-100%]' : 'opacity-100 translate-x-0 md:translate-y-0'}
  `}>
    <div className="flex items-center justify-between">
      <span className="leading-tight">{toast.message}</span>
      <button 
        onClick={onClose} 
        className="ml-4 text-white/80 hover:text-white text-2xl md:text-3xl leading-none"
      >
        ×
      </button>
    </div>
  </div>
);

export default function PoopChainApp() {
  const { address, isConnected } = useAccount();
  
  // ✅ ENHANCED: Optimized data fetching with smart caching
  const { data: balances, loading: balancesLoading, refresh: refreshBalances } = useOptimizedBalances(address);
  const { data: casinoStats, loading: casinoLoading } = useOptimizedCasinoStats();
  const { data: faucetState, loading: faucetStateLoading } = useOptimizedFaucetState(address);
  const { data: dexReserves, loading: dexReservesLoading, refresh: refreshDexReserves } = useOptimizedDexReserves();
  
  // Component state
  const [isMounted, setIsMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile menu state
  const { toasts, showToast, dismissToast } = useToast();
  const [selectedTab, setSelectedTab] = useState('faucet');
  
  // FIXED: Keep input state separate from displayed values
  const [betAmountInput, setBetAmountInput] = useState('10');
  const [betChoice, setBetChoice] = useState(0);
  const [swapAmountInput, setSwapAmountInput] = useState('');
  const [swapDirection, setSwapDirection] = useState<'matic-to-shit' | 'shit-to-matic'>('matic-to-shit');
  
  // DEX quote with optimized fetching
  const { data: dexQuote, loading: isLoadingQuote } = useOptimizedDexQuote(swapAmountInput, swapDirection);
  
  // Transaction event handler
  const invalidateTransactionData = useTransactionEvents();
  
  // FIXED: Simplified casino state management
  const [casinoState, setCasinoState] = useState<{
    isFlipping: boolean;
    gameActive: boolean;
  }>({
    isFlipping: false,
    gameActive: false,
  });

  // FIXED: Enhanced refresh callbacks with proper data invalidation
  const handleFaucetSuccess = useCallback(() => {
    console.log('✅ Faucet claimed successfully - refreshing data');
    // Invalidate data after successful faucet claim
    invalidateTransactionData('faucet', address);
    // Force immediate refresh of balances and faucet state
    setTimeout(() => {
      refreshBalances();
    }, 1000);
  }, [invalidateTransactionData, address, refreshBalances]);

  const handleSwapSuccess = useCallback(() => {
    console.log('✅ Swap completed successfully - refreshing data');
    // Invalidate data after successful swap
    invalidateTransactionData('dex', address);
    // Force immediate refresh of balances and DEX reserves
    setTimeout(() => {
      refreshBalances();
      refreshDexReserves();
    }, 1000);
  }, [invalidateTransactionData, address, refreshBalances, refreshDexReserves]);

  const handleCasinoSuccess = useCallback(() => {
    console.log('✅ Casino bet completed - refreshing data');
    // Invalidate data after casino bet
    invalidateTransactionData('casino', address);
    // Force immediate refresh of balances and casino stats
    setTimeout(() => {
      refreshBalances();
    }, 1000);
  }, [invalidateTransactionData, address, refreshBalances]);

  // ENHANCED: Contract hooks with enhanced callbacks
  const { claimFaucet, isLoading: faucetLoading } = useClaimFaucet(showToast, handleFaucetSuccess);
  const { placeBet: contractPlaceBet, isLoading: contractCasinoLoading, gameResult, clearGameResult } = useCasinoBet(showToast, address);
  const { swapMaticForShit, swapShitForMatic, isLoading: swapLoading } = useDexSwap(showToast);

  // Approval hooks
  const { data: shitAllowance } = useShitAllowance(address);
  const { approveShit, isLoading: approvalLoading } = useApproveShit(showToast);
  const { data: shitDexAllowance } = useShitDexAllowance(address);
  const { approveDex, isLoading: dexApprovalLoading } = useApproveDex(showToast);
  
  // Other hooks
  const { data: mintingStats } = useMintingStats();
  const { triggerRefill, isLoading: refillLoading } = useManualRefill(showToast);
  const { data: dexOwner } = useDexOwner();
  const { syncReserves, isLoading: syncLoading } = useSyncReserves(showToast);

  // Check if current user is the owner
  const isOwner = address && dexOwner && address.toLowerCase() === dexOwner.toLowerCase();

  // Extract values with fallbacks
  const polBalance = balances?.pol || '0.0000';
  const shitBalance = balances?.shit || '0';
  const currentMaxBet = casinoStats?.currentMaxBet || 1000;
  const houseBalance = casinoStats?.houseBalance || 0;
  const minBet = casinoStats?.minBet || 10;
  const needsRefill = casinoStats?.needsRefill || false;
  const timeUntilRefill = casinoStats?.timeUntilRefill || 0;
  const canClaimFaucet = faucetState?.canClaim || false;
  const timeUntilClaim = faucetState?.timeUntilClaim || 0;
  
  const totalMinted = mintingStats ? Number(formatEther(mintingStats[0])) : 0;
  const dailyMintingUsed = mintingStats ? Number(formatEther(mintingStats[1])) : 0;
  const dailyMintingLimit = mintingStats ? Number(formatEther(mintingStats[2])) : 24000;

  // Approval logic
  const hasEnoughAllowance = useMemo(() => {
    if (!betAmountInput || parseFloat(betAmountInput) <= 0) return true;
    if (!shitAllowance) return false;
    const allowanceAmount = Number(formatEther(shitAllowance));
    const betAmountNum = parseFloat(betAmountInput);
    return allowanceAmount >= betAmountNum && allowanceAmount > 0;
  }, [shitAllowance, betAmountInput]);

  const hasEnoughDexAllowance = useMemo(() => {
    if (swapDirection === 'matic-to-shit') return true;
    if (!swapAmountInput || parseFloat(swapAmountInput) <= 0) return true;
    if (!shitDexAllowance) return false;
    return Number(formatEther(shitDexAllowance)) >= parseFloat(swapAmountInput);
  }, [shitDexAllowance, swapAmountInput, swapDirection]);

  // Action handlers
  const handleClaimFaucet = useCallback(() => {
    if (!faucetLoading) {
      claimFaucet();
    }
  }, [claimFaucet, faucetLoading]);

  // FIXED: Enhanced casino bet handler with proper error handling
  const handlePlaceBet = useCallback(() => {
    if (!hasEnoughAllowance) {
      showToast('❌ Please approve SHIT tokens first!', 'error');
      return;
    }
    
    if (contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) {
      return;
    }
    
    const betAmountNum = parseFloat(betAmountInput);
    if (!betAmountInput || betAmountNum < minBet || betAmountNum > currentMaxBet) {
      showToast('❌ Invalid bet amount!', 'error');
      return;
    }
    
    clearGameResult();
    setCasinoState({ isFlipping: false, gameActive: true });
    contractPlaceBet(betAmountInput, betChoice);
  }, [contractPlaceBet, betAmountInput, betChoice, contractCasinoLoading, casinoState.isFlipping, casinoState.gameActive, hasEnoughAllowance, minBet, currentMaxBet, showToast, clearGameResult]);

  // FIXED: Enhanced swap handler
  const handleSwap = useCallback(() => {
    if (!swapLoading && swapAmountInput && parseFloat(swapAmountInput) > 0) {
      if (swapDirection === 'matic-to-shit') {
        swapMaticForShit(swapAmountInput, '0');
      } else {
        swapShitForMatic(swapAmountInput, '0');
      }
      // The handleSwapSuccess callback will be triggered by the hook's success handler
    }
  }, [swapLoading, swapAmountInput, swapDirection, swapMaticForShit, swapShitForMatic]);

  // FIXED: Enhanced casino game result handler with proper state management
  useEffect(() => {
    if (gameResult && !contractCasinoLoading && casinoState.gameActive && !casinoState.isFlipping) {
      const result = { ...gameResult };
      
      setCasinoState({ 
        isFlipping: true,
        gameActive: false
      });
      
      clearGameResult();
      
      setTimeout(() => {
        if (result.won) {
          fartSystem.playFart('win_fart');
          const message = result.gasLotteryWon 
            ? `🎉 JACKPOT! Won ${result.payout} SHIT + Gas Refund!`
            : `🎉 You won ${result.payout} SHIT!`;
          showToast(message);
        } else {
          fartSystem.playFart('lose_fart');
          const message = result.gasLotteryWon
            ? '💸 Lost the bet, but won gas refund!'
            : '💸 You lost! Better luck next time!';
          showToast(message, result.gasLotteryWon ? 'success' : 'error');
        }
        
        // Reset casino state
        setCasinoState({
          isFlipping: false,
          gameActive: false,
        });
        
        // Trigger data refresh
        handleCasinoSuccess();
      }, 3000);
    }
  }, [gameResult, contractCasinoLoading, casinoState.gameActive, casinoState.isFlipping, clearGameResult, showToast, handleCasinoSuccess]);

  // FIXED: Handle transaction cancellation/failure for casino
  useEffect(() => {
    // If we're waiting for a transaction but it's no longer loading and there's no result,
    // and no transaction is in progress, the user probably cancelled or the transaction failed
    if (casinoState.gameActive && !contractCasinoLoading && !gameResult) {
      // Add a small delay to avoid premature state reset
      const timeoutId = setTimeout(() => {
        if (casinoState.gameActive && !contractCasinoLoading && !gameResult) {
          setCasinoState({
            isFlipping: false,
            gameActive: false,
          });
        }
      }, 3000); // Wait 3 seconds before resetting to avoid premature resets

      return () => clearTimeout(timeoutId);
    }
  }, [casinoState.gameActive, contractCasinoLoading, gameResult]);

  // Timer state for faucet countdown
  const [displayTime, setDisplayTime] = useState(timeUntilClaim);

  // Timer state for refill countdown
  const [displayRefillTime, setDisplayRefillTime] = useState(timeUntilRefill);

  useEffect(() => {
    setDisplayTime(timeUntilClaim);
  }, [timeUntilClaim]);

  useEffect(() => {
    setDisplayRefillTime(timeUntilRefill);
  }, [timeUntilRefill]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayTime((prev: number) => prev > 0 ? prev - 1 : 0);
      setDisplayRefillTime((prev: number) => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // DEX output calculation
  const getSwapOutput = useMemo(() => {
    if (!dexQuote || !swapAmountInput || parseFloat(swapAmountInput) <= 0) return '0.0';
    
    const outputAmount = Number(dexQuote.shitOut);
    return swapDirection === 'matic-to-shit' 
      ? outputAmount.toFixed(0) 
      : outputAmount.toFixed(4);
  }, [swapAmountInput, dexQuote, swapDirection]);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close mobile menu when tab changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [selectedTab]);

  // Loading state - mobile-friendly
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 flex items-center justify-center p-4">
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-3xl p-8 md:p-12 text-center border border-amber-600/30 w-full max-w-md">
          <div className="text-4xl md:text-6xl mb-4 md:mb-6">💩</div>
          <h1 className="text-2xl md:text-4xl font-bold text-amber-100 mb-2 md:mb-4">PoopChain</h1>
          <p className="text-lg md:text-xl text-amber-200">Loading...</p>
        </div>
      </div>
    );
  }

  // Not connected state - mobile-friendly
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 flex items-center justify-center p-4">
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-3xl p-8 md:p-12 text-center border border-amber-600/30 w-full max-w-md md:max-w-none md:w-auto">
          <div className="text-6xl md:text-9xl mb-6 md:mb-12">💩</div>
          <h1 className="text-4xl md:text-8xl font-bold text-amber-100 mb-4 md:mb-8">PoopChain</h1>
          <p className="text-lg md:text-2xl text-amber-200 mb-8 md:mb-16 md:whitespace-nowrap">From Polygon to Poopygon - we made it shittier!</p>
          <div className="flex justify-center">
            <div className="orange-connect-button">
              <ConnectButton />
            </div>
          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
              .orange-connect-button button,
              .orange-connect-button [role="button"] {
                background: #ea580c !important;
                background-color: #ea580c !important;
                border-color: #ea580c !important;
                color: white !important;
                font-weight: bold !important;
                padding: 12px 24px !important;
                border-radius: 12px !important;
                font-size: 16px !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
              }
              .orange-connect-button button:hover,
              .orange-connect-button [role="button"]:hover {
                background: #dc2626 !important;
                background-color: #dc2626 !important;
                border-color: #dc2626 !important;
                transform: scale(1.05) !important;
              }
              .orange-connect-button * {
                color: white !important;
              }
              @media (max-width: 768px) {
                .orange-connect-button button,
                .orange-connect-button [role="button"] {
                  padding: 10px 20px !important;
                  font-size: 14px !important;
                }
              }
            `
          }} />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900">
      {/* Toast notifications */}
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          toast={toast} 
          onClose={() => dismissToast(toast.id)} 
        />
      ))}
      
      {/* Mobile Navigation */}
      <MobileNav 
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />
      
      {/* Header - Mobile-friendly */}
      <div className="bg-amber-800/30 backdrop-blur-lg border-b border-amber-600/30 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="text-4xl md:text-8xl">💩</div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-amber-100">PoopChain</h1>
              <p className="text-sm md:text-lg text-amber-300">Poopygon Exclusive</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile-optimized balance display */}
            <div className="text-right text-sm md:text-lg">
              <div className="text-amber-200 flex items-center gap-1 md:gap-2">
                <span className="hidden sm:inline">POL:</span>
                <span className="sm:hidden">🟣</span>
                <span className="font-mono text-xs md:text-base">{polBalance}</span>
                <button 
                  onClick={refreshBalances}
                  className="text-amber-400 hover:text-amber-100 text-xs transition-colors"
                  title="Refresh balances"
                  disabled={balancesLoading}
                >
                  {balancesLoading ? '⏳' : '🔄'}
                </button>
              </div>
              <div className="text-amber-200 flex items-center gap-1 md:gap-2">
                <span className="hidden sm:inline">SHIT:</span>
                <span className="sm:hidden">💩</span>
                <span className="font-mono text-xs md:text-base">{shitBalance}</span>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-amber-300 hover:text-amber-100 p-2"
            >
              <Menu size={24} />
            </button>
            
            {/* Desktop ConnectButton */}
            <div className="hidden md:block">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation - Desktop only */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="hidden md:flex gap-4 mb-8">
          {[
            { id: 'faucet', label: 'Faucet', icon: Coins },
            { id: 'casino', label: 'Casino', icon: Gamepad2 },
            { id: 'dex', label: 'DEX', icon: RefreshCw },
            { id: 'gaspool', label: 'Gas Pool', icon: Fuel },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          ].map(({ id, label, icon }) => {
            const Icon = icon as React.ElementType;
            return (
              <button
                key={id}
                onClick={() => setSelectedTab(id)}
                className={`flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-xl font-medium text-lg md:text-xl transition-all ${
                  selectedTab === id
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'bg-amber-800/20 text-amber-200 hover:bg-amber-700/30'
                }`}
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
        </div>
        
        {/* Content - Mobile-friendly */}
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-2xl md:rounded-3xl p-4 md:p-6 border border-amber-600/30">
          
          {/* Faucet Tab - Mobile-friendly */}
          {selectedTab === 'faucet' && (
            <div className="text-center">
              <div className="text-4xl md:text-6xl mb-4 md:mb-6">🚰</div>
              <h2 className="text-2xl md:text-4xl font-bold text-amber-100 mb-3 md:mb-4">Daily Shitcoin Faucet</h2>
              <p className="text-lg md:text-xl text-amber-200 mb-6 md:mb-8">Claim 1000 free SHIT tokens every 24 hours!</p>
              
              {canClaimFaucet ? (
                <div>
                  <p className="text-green-400 mb-4 text-lg md:text-xl">✅ Ready to claim!</p>
                  <button
                    onClick={handleClaimFaucet}
                    disabled={faucetLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl transition-all transform active:scale-95 md:hover:scale-105 w-full sm:w-auto"
                  >
                    {faucetLoading ? 'Claiming...' : 'Claim 1000 SHIT 💨'}
                  </button>
                  <p className="text-sm md:text-base text-amber-300 mt-3 md:mt-4">
                    Cost: 0.01 POL (helps fund gas lottery!)
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-orange-400 mb-4 text-lg md:text-xl">⏰ Next claim available in:</p>
                  <div className="text-2xl md:text-3xl font-mono text-amber-100 mb-4">
                    {formatTimeRemaining(displayTime)}
                  </div>
                  <button
                    disabled
                    className="bg-gray-600 text-gray-300 px-8 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl cursor-not-allowed w-full sm:w-auto"
                  >
                    Faucet on Cooldown
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Casino Tab - Mobile-friendly */}
          {selectedTab === 'casino' && (
            <div className="text-center">
              <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎲</div>
              <h2 className="text-2xl md:text-4xl font-bold text-amber-100 mb-3 md:mb-4">Butts or Turds</h2>
              <p className="text-lg md:text-xl text-amber-200 mb-3 md:mb-4">50/50 coinflip game - Double or nothing!</p>
              <div className="bg-amber-900/30 rounded-lg p-3 mb-4 md:mb-6 border border-amber-600/30">
                <p className="text-amber-300 text-sm md:text-base">🚧 More casino games coming soon!</p>
              </div>
              
              <div className="max-w-lg mx-auto space-y-4 md:space-y-6">
                <div>
                  <label className="block text-amber-200 mb-2 text-lg md:text-xl">Bet Amount (SHIT)</label>
                  <input
                    type="number"
                    value={betAmountInput}
                    onChange={(e) => setBetAmountInput(e.target.value)}
                    min={minBet}
                    max={currentMaxBet}
                    disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                    className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl bg-amber-900/50 border border-amber-600/50 text-amber-100 text-center text-lg md:text-xl focus:outline-none focus:border-amber-400 disabled:opacity-50"
                    placeholder={`${minBet} - ${currentMaxBet}`}
                  />
                  
                  <div className="mt-2 text-center">
                    <p className="text-amber-300 text-sm">
                      Limits: {minBet} - {currentMaxBet} SHIT
                    </p>
                    <p className="text-amber-400 text-xs">
                      House Balance: {houseBalance.toFixed(0)} SHIT
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-amber-200 mb-4 text-lg md:text-xl">Choose Your Side:</label>
                  <div className="h-48 md:h-64">
                    {casinoState.isFlipping ? (
                      <div className="flex items-center justify-center h-full">
                        <img 
                          src="/coin-flip.gif" 
                          alt="Coin flipping" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:gap-6 h-full">
                        <button
                          onClick={() => setBetChoice(0)}
                          disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                          className={`p-4 md:p-8 rounded-xl border-4 transition-all transform active:scale-95 md:hover:scale-105 ${
                            betChoice === 0
                              ? 'border-pink-400 bg-pink-400/20 text-pink-200 shadow-lg'
                              : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:border-pink-400/50'
                          } ${(contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="text-4xl md:text-6xl mb-1 md:mb-2">🍑</div>
                          <div className="font-bold text-lg md:text-xl">BUTTS</div>
                        </button>
                        
                        <button
                          onClick={() => setBetChoice(1)}
                          disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                          className={`p-4 md:p-8 rounded-xl border-4 transition-all transform active:scale-95 md:hover:scale-105 ${
                            betChoice === 1
                              ? 'border-amber-600 bg-amber-600/20 text-amber-200 shadow-lg'
                              : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:border-amber-600/70'
                          } ${(contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="text-4xl md:text-6xl mb-1 md:mb-2">💩</div>
                          <div className="font-bold text-lg md:text-xl">TURDS</div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {!hasEnoughAllowance ? (
                  <button
                    onClick={approveShit}
                    disabled={approvalLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl transition-all transform active:scale-95 md:hover:scale-105"
                  >
                    {approvalLoading ? 'Approving...' : 'Approve SHIT Tokens First 🔓'}
                  </button>
                ) : (
                  <button
                    onClick={handlePlaceBet}
                    disabled={
                      contractCasinoLoading || 
                      casinoState.isFlipping || 
                      casinoState.gameActive ||
                      !betAmountInput || 
                      parseFloat(betAmountInput) < minBet || 
                      parseFloat(betAmountInput) > currentMaxBet
                    }
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl transition-all transform active:scale-95 md:hover:scale-105"
                  >
                    {(() => {
                      // Enhanced button text with better state indication
                      if (contractCasinoLoading) return 'Processing Transaction...';
                      if (casinoState.isFlipping) return 'Flipping Coin...';
                      if (casinoState.gameActive) return 'Waiting for Confirmation...';
                      return `Bet ${betAmountInput} SHIT on ${betChoice === 0 ? 'BUTTS' : 'TURDS'} 💨`;
                    })()}
                  </button>
                )}
                
                <p className="text-sm md:text-base text-amber-300">
                  {!hasEnoughAllowance 
                    ? 'One-time approval needed to bet SHIT tokens'
                    : 'Cost: 0.005 POL (enters gas lottery!)'
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* DEX Tab - Mobile-friendly */}
          {selectedTab === 'dex' && (
            <div className="text-center">
              <div className="text-4xl md:text-6xl mb-4 md:mb-6">🔄</div>
              <h2 className="text-2xl md:text-4xl font-bold text-amber-100 mb-3 md:mb-4">PoopDEX</h2>
              <p className="text-lg md:text-xl text-amber-200 mb-6 md:mb-8">Swap POL ↔ SHITCOIN</p>
              
              <div className="max-w-lg mx-auto space-y-4 md:space-y-6">
                <div className="bg-amber-900/50 rounded-xl p-4 md:p-8 border border-amber-600/50">
                  <div className="flex justify-between items-center mb-4 md:mb-6">
                    <span className="text-amber-200 text-lg md:text-xl">From:</span>
                    <button
                      onClick={() => setSwapDirection(swapDirection === 'matic-to-shit' ? 'shit-to-matic' : 'matic-to-shit')}
                      className="text-amber-400 hover:text-amber-100 transition-colors text-lg md:text-xl"
                      disabled={swapLoading}
                    >
                      🔄 Flip
                    </button>
                  </div>
                  
                  <div className="mb-4 md:mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl md:text-3xl">{swapDirection === 'matic-to-shit' ? '🟣' : '💩'}</div>
                      <span className="text-amber-100 font-bold text-lg md:text-xl">
                        {swapDirection === 'matic-to-shit' ? 'POL' : 'SHIT'}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={swapAmountInput}
                      onChange={(e) => setSwapAmountInput(e.target.value)}
                      disabled={swapLoading}
                      className="w-full px-4 md:px-6 py-3 md:py-4 rounded-lg bg-amber-900/70 border border-amber-600/50 text-amber-100 text-lg md:text-xl focus:outline-none focus:border-amber-400 disabled:opacity-50"
                      placeholder="0.0"
                    />
                  </div>
                  
                  <div className="text-center text-amber-400 text-2xl md:text-3xl mb-4 md:mb-6">⬇️</div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-2xl md:text-3xl">{swapDirection === 'matic-to-shit' ? '💩' : '🟣'}</div>
                      <span className="text-amber-100 font-bold text-lg md:text-xl">
                        {swapDirection === 'matic-to-shit' ? 'SHIT' : 'POL'}
                      </span>
                    </div>
                    <div className="w-full px-4 md:px-6 py-3 md:py-4 rounded-lg bg-amber-900/30 border border-amber-600/30 text-amber-300 text-lg md:text-xl font-mono">
                      {getSwapOutput}
                    </div>
                    {dexQuote && swapAmountInput && parseFloat(swapAmountInput) > 0 && (
                      <div className="mt-2 text-center space-y-1">
                        <div className="text-amber-400 text-sm">
                          Fee: {Number(dexQuote.feeAmount).toFixed(swapDirection === 'matic-to-shit' ? 4 : 0)} {swapDirection === 'matic-to-shit' ? 'POL' : 'SHIT'}
                        </div>
                        {swapDirection === 'shit-to-matic' && (
                          <div className="text-amber-500 text-xs">
                            Allowance: {shitDexAllowance ? Number(formatEther(shitDexAllowance)).toFixed(0) : '0'} SHIT
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {swapDirection === 'shit-to-matic' && !hasEnoughDexAllowance ? (
                  <button
                    onClick={approveDex}
                    disabled={dexApprovalLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl transition-all transform active:scale-95 md:hover:scale-105"
                  >
                    {dexApprovalLoading ? 'Approving...' : 'Approve SHIT for DEX First 🔓'}
                  </button>
                ) : (
                  <button
                    onClick={handleSwap}
                    disabled={swapLoading || !swapAmountInput || parseFloat(swapAmountInput) <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 md:px-12 py-4 md:py-6 rounded-xl font-bold text-lg md:text-xl transition-all transform active:scale-95 md:hover:scale-105"
                  >
                    {swapLoading ? 'Swapping...' : `Swap ${swapDirection === 'matic-to-shit' ? 'POL → SHIT' : 'SHIT → POL'} 💨`}
                  </button>
                )}
                
                {/* Owner controls */}
                {isOwner && (
                  <div className="mb-4 md:mb-6">
                    <button
                      onClick={() => syncReserves?.()}
                      disabled={syncLoading}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg font-bold text-sm md:text-base"
                    >
                      {syncLoading ? 'Syncing...' : 'Sync Reserves 🔄'}
                    </button>
                  </div>
                )}
                
                {/* Mobile-optimized liquidity display */}
                {dexReserves && (
                  <div className="bg-amber-900/30 rounded-lg p-3 md:p-4 mb-4 md:mb-6 border border-amber-600/30">
                    <div className="flex justify-between items-center mb-2 md:mb-3">
                      <h4 className="text-amber-100 font-bold text-sm md:text-base">💧 Liquidity Pool</h4>
                      <button 
                        onClick={refreshDexReserves}
                        className="text-amber-400 hover:text-amber-100 text-xs md:text-sm"
                        title="Refresh reserves"
                        disabled={dexReservesLoading}
                      >
                        {dexReservesLoading ? '⏳' : '🔄'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-4 text-center">
                      <div>
                        <div className="text-blue-300 font-bold text-sm md:text-lg">{dexReserves.matic.toFixed(2)} POL</div>
                        <div className="text-amber-400 text-xs md:text-sm">POL Reserve</div>
                      </div>
                      <div>
                        <div className="text-orange-300 font-bold text-sm md:text-lg">{dexReserves.shit.toFixed(0)} SHIT</div>
                        <div className="text-amber-400 text-xs md:text-sm">SHIT Reserve</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-sm md:text-base text-amber-300">
                  {swapDirection === 'shit-to-matic' && !hasEnoughDexAllowance
                    ? 'One-time approval needed to swap SHIT tokens'
                    : 'Fee: 2.5% (goes to gas lottery pool!)'
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* Gas Pool Tab */}
          {selectedTab === 'gaspool' && (
            <GasPoolDashboard />
          )}

          {/* Leaderboard Tab */}
          {selectedTab === 'leaderboard' && (
            <LeaderboardTab />
          )}
        </div>
        
        {/* Mobile-optimized Stats Section - Only show on faucet tab */}
        {selectedTab === 'faucet' && (
          <div className="mt-4 md:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
              <div className="text-xl md:text-2xl mb-1">⛽</div>
              <div className="text-amber-100 font-bold text-sm md:text-lg">Gas Lottery</div>
              <div className="text-amber-300 text-xs md:text-sm">50% chance of refund</div>
            </div>
            
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
              <div className="text-xl md:text-2xl mb-1">🔥</div>
              <div className="text-amber-100 font-bold text-sm md:text-lg">Deflationary</div>
              <div className="text-amber-300 text-xs md:text-sm">Lost bets burn tokens</div>
            </div>
            
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
              <div className="text-xl md:text-2xl mb-1">💨</div>
              <div className="text-amber-100 font-bold text-sm md:text-lg">Fart Sounds</div>
              <div className="text-amber-300 text-xs md:text-sm">
                <button 
                  onClick={() => {
                    console.log('🔊 Test fart button clicked');
                    fartSystem.playFart('default');
                  }}
                  className="text-amber-300 hover:text-amber-100 underline transition-colors"
                >
                  Click to test!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-optimized Economics Stats - Show on faucet tab */}
        {selectedTab === 'faucet' && (
          <div className="mt-4 md:mt-6">
            <h3 className="text-xl md:text-2xl font-bold text-amber-100 mb-3 md:mb-4 text-center">Token Economics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
                <div className="text-lg md:text-2xl mb-1">🏭</div>
                <div className="text-amber-100 font-bold text-sm md:text-lg">Auto-Minting</div>
                <div className="text-amber-300 text-xs md:text-sm">{totalMinted.toFixed(0)} total minted</div>
                <div className="text-amber-400 text-xs">{dailyMintingUsed.toFixed(0)}/{dailyMintingLimit.toFixed(0)} today</div>
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
                <div className="text-lg md:text-2xl mb-1">🏦</div>
                <div className="text-amber-100 font-bold text-sm md:text-lg">House Balance</div>
                <div className="text-amber-300 text-xs md:text-sm">{houseBalance.toFixed(0)} SHIT</div>
                <div className="text-amber-400 text-xs">Max bet: {currentMaxBet.toFixed(0)}</div>
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
                <div className="text-lg md:text-2xl mb-1">🤖</div>
                <div className="text-amber-100 font-bold text-sm md:text-lg">Auto-Refill</div>
                <div className={`text-xs md:text-sm ${needsRefill ? 'text-green-300' : 'text-amber-300'}`}>
                  {needsRefill ? 'Ready!' : 'Monitoring'}
                </div>
                {/* Show countdown timer when monitoring */}
                {!needsRefill && displayRefillTime > 0 && (
                  <div className="text-xs text-amber-400 mt-1 font-mono">
                    {formatTimeRemaining(displayRefillTime)}
                  </div>
                )}
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-3 md:p-4 border border-amber-600/30 text-center">
                <div className="text-lg md:text-2xl mb-1">♾️</div>
                <div className="text-amber-100 font-bold text-sm md:text-lg">Sustainable</div>
                <div className="text-amber-300 text-xs md:text-sm">Unlimited operation</div>
                <div className="text-amber-400 text-xs">Self-balancing supply</div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile ConnectButton at bottom */}
        <div className="md:hidden mt-6 text-center">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}

// Export fart system for use in hooks
export { fartSystem };