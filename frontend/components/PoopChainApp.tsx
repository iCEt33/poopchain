'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Coins, Gamepad2, RefreshCw, Volume2, Wallet, Fuel } from 'lucide-react';
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

const Toast = ({ toast, onClose }: { toast: any, onClose: () => void }) => (
  <div className={`fixed top-4 right-4 p-8 rounded-lg shadow-lg z-50 transition-all duration-1000 transform text-2xl ${
    toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
  } text-white ${
    toast.isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
  }`}>
    <div className="flex items-center justify-between">
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-4 text-white/80 hover:text-white text-3xl">×</button>
    </div>
  </div>
);

export default function PoopChainApp() {
  const { address, isConnected } = useAccount();
  
  // ✅ NEW: Optimized data fetching with smart caching
  const { data: balances, loading: balancesLoading, refresh: refreshBalances } = useOptimizedBalances(address);
  const { data: casinoStats, loading: casinoLoading } = useOptimizedCasinoStats();
  const { data: faucetState, loading: faucetStateLoading } = useOptimizedFaucetState(address);
  const { data: dexReserves, loading: dexReservesLoading, refresh: refreshDexReserves } = useOptimizedDexReserves();
  
  // Component state
  const [isMounted, setIsMounted] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();
  const [selectedTab, setSelectedTab] = useState('faucet');
  const [betAmount, setBetAmount] = useState('10');
  const [betChoice, setBetChoice] = useState(0);
  const [swapAmount, setSwapAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState<'matic-to-shit' | 'shit-to-matic'>('matic-to-shit');
  
  // DEX quote with optimized fetching
  const { data: dexQuote, loading: isLoadingQuote } = useOptimizedDexQuote(swapAmount, swapDirection);
  
  // Transaction event handler
  const invalidateTransactionData = useTransactionEvents();
  
  // Casino state
  const [casinoState, setCasinoState] = useState<{
    isFlipping: boolean;
    gameActive: boolean;
    lastTxHash: string | null;
  }>({
    isFlipping: false,
    gameActive: false,
    lastTxHash: null,
  });

  // Create stable callbacks for transaction success
  const handleFaucetSuccess = useCallback(() => {
    // Invalidate data after successful faucet claim
    invalidateTransactionData('faucet', address);
  }, [invalidateTransactionData, address]);

  const handleSwapSuccess = useCallback(() => {
    // Invalidate data after successful swap
    invalidateTransactionData('dex', address);
  }, [invalidateTransactionData, address]);

  // Contract hooks
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
    if (!betAmount || parseFloat(betAmount) <= 0) return true;
    if (!shitAllowance) return false;
    const allowanceAmount = Number(formatEther(shitAllowance));
    const betAmountNum = parseFloat(betAmount);
    return allowanceAmount >= betAmountNum && allowanceAmount > 0;
  }, [shitAllowance, betAmount]);

  const hasEnoughDexAllowance = useMemo(() => {
    if (swapDirection === 'matic-to-shit') return true;
    if (!swapAmount || parseFloat(swapAmount) <= 0) return true;
    if (!shitDexAllowance) return false;
    return Number(formatEther(shitDexAllowance)) >= parseFloat(swapAmount);
  }, [shitDexAllowance, swapAmount, swapDirection]);

  // Action handlers
  const handleClaimFaucet = useCallback(() => {
    if (!faucetLoading) {
      claimFaucet();
    }
  }, [claimFaucet, faucetLoading]);

  const handlePlaceBet = useCallback(() => {
    if (!hasEnoughAllowance) {
      showToast('❌ Please approve SHIT tokens first!', 'error');
      return;
    }
    
    if (contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) {
      return;
    }
    
    const betAmountNum = parseFloat(betAmount);
    if (!betAmount || betAmountNum < minBet || betAmountNum > currentMaxBet) {
      showToast('❌ Invalid bet amount!', 'error');
      return;
    }
    
    clearGameResult();
    setCasinoState(prev => ({ ...prev, gameActive: true }));
    contractPlaceBet(betAmount, betChoice);
  }, [contractPlaceBet, betAmount, betChoice, contractCasinoLoading, casinoState.isFlipping, casinoState.gameActive, hasEnoughAllowance, minBet, currentMaxBet, showToast, clearGameResult]);

  const handleSwap = useCallback(() => {
    if (!swapLoading && swapAmount && parseFloat(swapAmount) > 0) {
      if (swapDirection === 'matic-to-shit') {
        swapMaticForShit(swapAmount, '0');
      } else {
        swapShitForMatic(swapAmount, '0');
      }
      // Invalidate data after successful swap - will be handled by the swap hook's success callback
      setTimeout(handleSwapSuccess, 2000);
    }
  }, [swapLoading, swapAmount, swapDirection, swapMaticForShit, swapShitForMatic, handleSwapSuccess]);

  // Casino game result handler
  useEffect(() => {
    if (gameResult && !contractCasinoLoading && casinoState.gameActive && !casinoState.isFlipping) {
      console.log('🎲 Starting casino animation with result:', gameResult);
      
      const result = { ...gameResult };
      
      setCasinoState(prev => ({ 
        ...prev, 
        isFlipping: true,
        gameActive: false
      }));
      
      clearGameResult();
      
      setTimeout(() => {
        if (result.won) {
          console.log('🔊 Playing win fart');
          fartSystem.playFart('win_fart');
          const message = result.gasLotteryWon 
            ? `🎉 JACKPOT! Won ${result.payout} SHIT + Gas Refund!`
            : `🎉 You won ${result.payout} SHIT!`;
          showToast(message);
        } else {
          console.log('🔊 Playing lose fart');
          fartSystem.playFart('lose_fart');
          const message = result.gasLotteryWon
            ? '💸 Lost the bet, but won gas refund!'
            : '💸 You lost! Better luck next time!';
          showToast(message, result.gasLotteryWon ? 'success' : 'error');
        }
        
        setCasinoState({
          isFlipping: false,
          gameActive: false,
          lastTxHash: null,
        });
        
        // Invalidate casino and balance data
        invalidateTransactionData('casino', address);
      }, 3000);
    }
  }, [gameResult, contractCasinoLoading, casinoState.gameActive, casinoState.isFlipping, clearGameResult, showToast, invalidateTransactionData, address]);

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
    if (!dexQuote || !swapAmount || parseFloat(swapAmount) <= 0) return '0.0';
    
    const outputAmount = Number(dexQuote.shitOut);
    return swapDirection === 'matic-to-shit' 
      ? outputAmount.toFixed(0) 
      : outputAmount.toFixed(4);
  }, [swapAmount, dexQuote, swapDirection]);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Loading state
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 flex items-center justify-center">
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-3xl p-12 text-center border border-amber-600/30">
          <div className="text-6xl mb-6">💩</div>
          <h1 className="text-4xl font-bold text-amber-100 mb-4">PoopChain</h1>
          <p className="text-xl text-amber-200">Loading...</p>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 flex items-center justify-center">
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-3xl p-12 text-center border border-amber-600/30">
          <div className="text-9xl mb-12">💩</div>
          <h1 className="text-8xl font-bold text-amber-100 mb-8">PoopChain</h1>
          <p className="text-2xl text-amber-200 mb-16">From Polygon to Poopygon - we made it shittier!</p>
          <div className="flex justify-center">
            <div 
              className="orange-connect-button"
              style={{
                '--orange-bg': '#ea580c',
                '--orange-hover': '#dc2626'
              } as React.CSSProperties}
            >
              <ConnectButton />
            </div>
          </div>
          <style dangerouslySetInnerHTML={{
            __html: `
              .orange-connect-button button,
              .orange-connect-button [role="button"] {
                background: var(--orange-bg) !important;
                background-color: var(--orange-bg) !important;
                border-color: var(--orange-bg) !important;
                color: white !important;
                font-weight: bold !important;
                padding: 12px 32px !important;
                border-radius: 12px !important;
                font-size: 18px !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                text-align: center !important;
              }
              .orange-connect-button button:hover,
              .orange-connect-button [role="button"]:hover {
                background: var(--orange-hover) !important;
                background-color: var(--orange-hover) !important;
                border-color: var(--orange-hover) !important;
                transform: scale(1.05) !important;
              }
              .orange-connect-button button span,
              .orange-connect-button [role="button"] span {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
              }
              .orange-connect-button * {
                color: white !important;
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
      
      {/* Header */}
      <div className="bg-amber-800/30 backdrop-blur-lg border-b border-amber-600/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="text-8xl">💩</div>
            <div>
              <h1 className="text-4xl font-bold text-amber-100">PoopChain</h1>
              <p className="text-lg text-amber-300">Poopygon Exclusive</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Optimized balance display */}
            <div className="text-right text-lg">
              <div className="text-amber-200 flex items-center gap-2">
                POL: <span className="font-mono">{polBalance}</span>
                <button 
                  onClick={refreshBalances}
                  className="text-amber-400 hover:text-amber-100 text-sm ml-1 transition-colors"
                  title="Refresh balances"
                  disabled={balancesLoading}
                >
                  {balancesLoading ? '⏳' : '🔄'}
                </button>
              </div>
              <div className="text-amber-200 flex items-center gap-2">
                SHIT: <span className="font-mono">{shitBalance}</span>
              </div>
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-4 mb-8">
          {[
            { id: 'faucet', label: 'Faucet', icon: Coins },
            { id: 'casino', label: 'Casino', icon: Gamepad2 },
            { id: 'dex', label: 'DEX', icon: RefreshCw },
            { id: 'gaspool', label: 'Gas Pool', icon: Fuel },
          ].map(({ id, label, icon }) => {
            const Icon = icon as React.ElementType;
            return (
              <button
                key={id}
                onClick={() => setSelectedTab(id)}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-xl transition-all ${
                  selectedTab === id
                    ? 'bg-amber-600 text-white shadow-lg'
                    : 'bg-amber-800/20 text-amber-200 hover:bg-amber-700/30'
                }`}
              >
                <Icon size={24} />
                {label}
              </button>
            );
          })}
        </div>
        
        {/* Content */}
        <div className="bg-amber-800/20 backdrop-blur-lg rounded-3xl p-6 border border-amber-600/30">
          
          {/* Faucet Tab */}
          {selectedTab === 'faucet' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🚰</div>
              <h2 className="text-4xl font-bold text-amber-100 mb-4">Daily Shitcoin Faucet</h2>
              <p className="text-xl text-amber-200 mb-8">Claim 1000 free SHIT tokens every 24 hours!</p>
              
              {canClaimFaucet ? (
                <div>
                  <p className="text-green-400 mb-4 text-xl">✅ Ready to claim!</p>
                  <button
                    onClick={handleClaimFaucet}
                    disabled={faucetLoading}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-6 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
                  >
                    {faucetLoading ? 'Claiming...' : 'Claim 1000 SHIT 💨'}
                  </button>
                  <p className="text-base text-amber-300 mt-4">
                    Cost: 0.01 POL (helps fund gas lottery!)
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-orange-400 mb-4 text-xl">⏰ Next claim available in:</p>
                  <div className="text-3xl font-mono text-amber-100 mb-4">
                    {formatTimeRemaining(displayTime)}
                  </div>
                  <button
                    disabled
                    className="bg-gray-600 text-gray-300 px-12 py-6 rounded-xl font-bold text-xl cursor-not-allowed"
                  >
                    Faucet on Cooldown
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Casino Tab */}
          {selectedTab === 'casino' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🎲</div>
              <h2 className="text-4xl font-bold text-amber-100 mb-4">Butts or Turds</h2>
              <p className="text-xl text-amber-200 mb-4">50/50 coinflip game - Double or nothing!</p>
              <div className="bg-amber-900/30 rounded-lg p-3 mb-6 border border-amber-600/30">
                <p className="text-amber-300 text-base">🚧 More casino games coming soon!</p>
              </div>
              
              <div className="max-w-lg mx-auto space-y-6">
                <div>
                  <label className="block text-amber-200 mb-2 text-xl">Bet Amount (SHIT)</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min={minBet}
                    max={currentMaxBet}
                    disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                    className="w-full px-6 py-4 rounded-xl bg-amber-900/50 border border-amber-600/50 text-amber-100 text-center text-xl focus:outline-none focus:border-amber-400 disabled:opacity-50"
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
                  <label className="block text-amber-200 mb-4 text-xl">Choose Your Side:</label>
                  <div className="h-64">
                    {casinoState.isFlipping ? (
                      <div className="flex items-center justify-center h-full">
                        <img 
                          src="/coin-flip.gif" 
                          alt="Coin flipping" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-6 h-full">
                        <button
                          onClick={() => setBetChoice(0)}
                          disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                          className={`p-8 rounded-xl border-4 transition-all transform hover:scale-105 ${
                            betChoice === 0
                              ? 'border-pink-400 bg-pink-400/20 text-pink-200 shadow-lg'
                              : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:border-pink-400/50'
                          } ${(contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="text-6xl mb-2">🍑</div>
                          <div className="font-bold text-xl">BUTTS</div>
                        </button>
                        
                        <button
                          onClick={() => setBetChoice(1)}
                          disabled={contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive}
                          className={`p-8 rounded-xl border-4 transition-all transform hover:scale-105 ${
                            betChoice === 1
                              ? 'border-amber-600 bg-amber-600/20 text-amber-200 shadow-lg'
                              : 'border-amber-600/50 bg-amber-900/30 text-amber-300 hover:border-amber-600/70'
                          } ${(contractCasinoLoading || casinoState.isFlipping || casinoState.gameActive) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="text-6xl mb-2">💩</div>
                          <div className="font-bold text-xl">TURDS</div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {!hasEnoughAllowance ? (
                  <button
                    onClick={approveShit}
                    disabled={approvalLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-6 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
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
                      !betAmount || 
                      parseFloat(betAmount) < minBet || 
                      parseFloat(betAmount) > currentMaxBet
                    }
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-6 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
                  >
                    {contractCasinoLoading ? 'Processing...' : 
                    casinoState.isFlipping ? 'Flipping...' : 
                    `Bet ${betAmount} SHIT on ${betChoice === 0 ? 'BUTTS' : 'TURDS'} 💨`}
                  </button>
                )}
                
                <p className="text-base text-amber-300">
                  {!hasEnoughAllowance 
                    ? 'One-time approval needed to bet SHIT tokens'
                    : 'Cost: 0.005 POL (enters gas lottery!)'
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* DEX Tab */}
          {selectedTab === 'dex' && (
            <div className="text-center">
              <div className="text-6xl mb-6">🔄</div>
              <h2 className="text-4xl font-bold text-amber-100 mb-4">PoopDEX</h2>
              <p className="text-xl text-amber-200 mb-8">Swap POL ↔ SHITCOIN</p>
              
              <div className="max-w-lg mx-auto space-y-6">
                <div className="bg-amber-900/50 rounded-xl p-8 border border-amber-600/50">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-amber-200 text-xl">From:</span>
                    <button
                      onClick={() => setSwapDirection(swapDirection === 'matic-to-shit' ? 'shit-to-matic' : 'matic-to-shit')}
                      className="text-amber-400 hover:text-amber-100 transition-colors text-xl"
                      disabled={swapLoading}
                    >
                      🔄 Flip
                    </button>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl">{swapDirection === 'matic-to-shit' ? '🟣' : '💩'}</div>
                      <span className="text-amber-100 font-bold text-xl">
                        {swapDirection === 'matic-to-shit' ? 'POL' : 'SHIT'}
                      </span>
                    </div>
                    <input
                      type="number"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      disabled={swapLoading}
                      className="w-full px-6 py-4 rounded-lg bg-amber-900/70 border border-amber-600/50 text-amber-100 text-xl focus:outline-none focus:border-amber-400 disabled:opacity-50"
                      placeholder="0.0"
                    />
                  </div>
                  
                  <div className="text-center text-amber-400 text-3xl mb-6">⬇️</div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl">{swapDirection === 'matic-to-shit' ? '💩' : '🟣'}</div>
                      <span className="text-amber-100 font-bold text-xl">
                        {swapDirection === 'matic-to-shit' ? 'SHIT' : 'POL'}
                      </span>
                    </div>
                    <div className="w-full px-6 py-4 rounded-lg bg-amber-900/30 border border-amber-600/30 text-amber-300 text-xl font-mono">
                      {getSwapOutput}
                    </div>
                    {dexQuote && swapAmount && parseFloat(swapAmount) > 0 && (
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
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-6 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
                  >
                    {dexApprovalLoading ? 'Approving...' : 'Approve SHIT for DEX First 🔓'}
                  </button>
                ) : (
                  <button
                    onClick={handleSwap}
                    disabled={swapLoading || !swapAmount || parseFloat(swapAmount) <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-6 rounded-xl font-bold text-xl transition-all transform hover:scale-105"
                  >
                    {swapLoading ? 'Swapping...' : `Swap ${swapDirection === 'matic-to-shit' ? 'POL → SHIT' : 'SHIT → POL'} 💨`}
                  </button>
                )}
                
                {/* Owner controls */}
                {isOwner && (
                  <div className="mb-6">
                    <button
                      onClick={() => syncReserves?.()}
                      disabled={syncLoading}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold"
                    >
                      {syncLoading ? 'Syncing...' : 'Sync Reserves 🔄'}
                    </button>
                  </div>
                )}
                
                {/* Optimized liquidity display */}
                {dexReserves && (
                  <div className="bg-amber-900/30 rounded-lg p-4 mb-6 border border-amber-600/30">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-amber-100 font-bold">💧 Liquidity Pool</h4>
                      <button 
                        onClick={refreshDexReserves}
                        className="text-amber-400 hover:text-amber-100 text-sm"
                        title="Refresh reserves"
                        disabled={dexReservesLoading}
                      >
                        {dexReservesLoading ? '⏳' : '🔄'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-blue-300 font-bold text-lg">{dexReserves.matic.toFixed(2)} POL</div>
                        <div className="text-amber-400 text-sm">POL Reserve</div>
                      </div>
                      <div>
                        <div className="text-orange-300 font-bold text-lg">{dexReserves.shit.toFixed(0)} SHIT</div>
                        <div className="text-amber-400 text-sm">SHIT Reserve</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-base text-amber-300">
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
        </div>
        
        {/* Stats Section - Only show on faucet tab */}
        {selectedTab === 'faucet' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
              <div className="text-2xl mb-1">⛽</div>
              <div className="text-amber-100 font-bold text-lg">Gas Lottery</div>
              <div className="text-amber-300 text-sm">50% chance of refund</div>
            </div>
            
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
              <div className="text-2xl mb-1">🔥</div>
              <div className="text-amber-100 font-bold text-lg">Deflationary</div>
              <div className="text-amber-300 text-sm">Lost bets burn tokens</div>
            </div>
            
            <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
              <div className="text-2xl mb-1">💨</div>
              <div className="text-amber-100 font-bold text-lg">Fart Sounds</div>
              <div className="text-amber-300 text-sm">
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

        {/* Minting & Economics Stats - Show on faucet tab */}
        {selectedTab === 'faucet' && (
          <div className="mt-6">
            <h3 className="text-2xl font-bold text-amber-100 mb-4 text-center">Token Economics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
                <div className="text-2xl mb-1">🏭</div>
                <div className="text-amber-100 font-bold text-lg">Auto-Minting</div>
                <div className="text-amber-300 text-sm">{totalMinted.toFixed(0)} total minted</div>
                <div className="text-amber-400 text-xs">{dailyMintingUsed.toFixed(0)}/{dailyMintingLimit.toFixed(0)} today</div>
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
                <div className="text-2xl mb-1">🏦</div>
                <div className="text-amber-100 font-bold text-lg">House Balance</div>
                <div className="text-amber-300 text-sm">{houseBalance.toFixed(0)} SHIT</div>
                <div className="text-amber-400 text-xs">Max bet: {currentMaxBet.toFixed(0)}</div>
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
                <div className="text-2xl mb-1">🤖</div>
                <div className="text-amber-100 font-bold text-lg">Auto-Refill</div>
                <div className={`text-sm ${needsRefill ? 'text-green-300' : 'text-amber-300'}`}>
                  {needsRefill ? 'Ready!' : 'Monitoring'}
                </div>
                {/* Show countdown timer when monitoring */}
                {!needsRefill && displayRefillTime > 0 && (
                  <div className="text-xs text-amber-400 mt-1 font-mono">
                    {formatTimeRemaining(displayRefillTime)}
                  </div>
                )}
              </div>
              
              <div className="bg-amber-800/20 backdrop-blur-lg rounded-xl p-4 border border-amber-600/30 text-center">
                <div className="text-2xl mb-1">♾️</div>
                <div className="text-amber-100 font-bold text-lg">Sustainable</div>
                <div className="text-amber-300 text-sm">Unlimited operation</div>
                <div className="text-amber-400 text-xs">Self-balancing supply</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export fart system for use in hooks
export { fartSystem };