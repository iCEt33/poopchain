// hooks/useContracts.ts (enhanced) - FIXED transaction handling and state management
import React from 'react';
import { useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ethers } from 'ethers';

// Contract ABIs - UPDATED with GameResult event
const SHITCOIN_ABI = [
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "canClaimFaucet", 
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "timeUntilNextClaim",
    "outputs": [{"name": "", "type": "uint256"}], 
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimFaucet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMintingStats",
    "outputs": [
      {"name": "totalMinted", "type": "uint256"},
      {"name": "dailyUsed", "type": "uint256"},
      {"name": "dailyLimit", "type": "uint256"},
      {"name": "timeUntilReset", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGasPoolHealth",
    "outputs": [
      {"name": "poolBalance", "type": "uint256"},
      {"name": "dailyIncome", "type": "uint256"},
      {"name": "dailyPayouts", "type": "uint256"},
      {"name": "dynamicLimit", "type": "uint256"},
      {"name": "remainingPayouts", "type": "uint256"},
      {"name": "healthy", "type": "bool"},
      {"name": "timeUntilReset", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGasPoolBreakdown",
    "outputs": [
      {"name": "poolBalance", "type": "uint256"},
      {"name": "incomeFromFees", "type": "uint256"},
      {"name": "incomeFromPayments", "type": "uint256"},
      {"name": "totalIncome", "type": "uint256"},
      {"name": "payoutsUsed", "type": "uint256"},
      {"name": "maxPayouts", "type": "uint256"},
      {"name": "minPoolBalance", "type": "uint256"},
      {"name": "maxSinglePayout", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const CASINO_ABI = [
  {
    "inputs": [
      {"name": "betAmount", "type": "uint256"},
      {"name": "choice", "type": "uint256"}
    ],
    "name": "playButtsOrTurds",
    "outputs": [],
    "stateMutability": "payable", 
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCasinoStats",
    "outputs": [
      {"name": "houseBalanceAmount", "type": "uint256"},
      {"name": "minBetAmount", "type": "uint256"},
      {"name": "maxBetAmount", "type": "uint256"},
      {"name": "currentMaxBet", "type": "uint256"},
      {"name": "winChance", "type": "uint256"},
      {"name": "needsRefill", "type": "bool"},
      {"name": "timeUntilRefill", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "triggerRefill",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // GameResult event ABI
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "player", "type": "address"},
      {"indexed": false, "name": "betAmount", "type": "uint256"},
      {"indexed": false, "name": "playerWon", "type": "bool"},
      {"indexed": false, "name": "playerChoice", "type": "string"},
      {"indexed": false, "name": "result", "type": "string"},
      {"indexed": false, "name": "payout", "type": "uint256"},
      {"indexed": false, "name": "gasLotteryWon", "type": "bool"}
    ],
    "name": "GameResult",
    "type": "event"
  }
] as const;

const DEX_ABI = [
  {
    "inputs": [{"name": "minShitOut", "type": "uint256"}],
    "name": "swapMaticForShit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "shitAmount", "type": "uint256"},
      {"name": "minMaticOut", "type": "uint256"}
    ],
    "name": "swapShitForMatic", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "maticAmount", "type": "uint256"}],
    "name": "getMaticToShitQuote",
    "outputs": [
      {"name": "shitOut", "type": "uint256"},
      {"name": "feeAmount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "shitAmount", "type": "uint256"}],
    "name": "getShitToMaticQuote", 
    "outputs": [
      {"name": "maticOut", "type": "uint256"},
      {"name": "feeAmount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner", 
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "syncReserves",
    "outputs": [],
    "stateMutability": "nonpayable", 
    "type": "function"
  }
] as const;

const CONTRACT_ADDRESSES = {
  SHITCOIN: (process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  CASINO: (process.env.NEXT_PUBLIC_CASINO_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
  DEX: (process.env.NEXT_PUBLIC_DEX_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};

// Import fart system
declare const fartSystem: any;

// Hook for SHIT token balance
export function useShitBalance(address?: `0x${string}`) {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    enabled: !!address && CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
    watch: true,
    cacheTime: 0,
    staleTime: 0,
  });
}

// Hook for minting stats
export function useMintingStats() {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'getMintingStats',
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
  });
}

// Hook for gas pool health
export function useGasPoolHealth() {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'getGasPoolHealth',
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
    watch: true,
  });
}

// Hook for detailed gas pool breakdown
export function useGasPoolBreakdown() {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'getGasPoolBreakdown',
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
    watch: true,
  });
}

// Hook for casino stats
export function useCasinoStats() {
  return useContractRead({
    address: CONTRACT_ADDRESSES.CASINO,
    abi: CASINO_ABI,
    functionName: 'getCasinoStats',
    enabled: CONTRACT_ADDRESSES.CASINO !== '0x0000000000000000000000000000000000000000',
  });
}

// Hook to check current allowance for CASINO
export function useShitAllowance(address?: `0x${string}`) {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.CASINO] : undefined,
    enabled: !!address && CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
    watch: true,
  });
}

// Hook to check DEX allowance
export function useShitDexAllowance(address?: `0x${string}`) {
  return useContractRead({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESSES.DEX] : undefined,
    enabled: !!address && CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
    watch: true,
  });
}

// ENHANCED: Hook to approve SHIT spending for CASINO with better state management
export function useApproveShit(showToast: (message: string, type?: 'success' | 'error') => void) {
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.CASINO, parseEther('1000000')],
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
  });

  const { write, data, error, isLoading } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error('❌ Approval error:', error);
      showToast('❌ Approval failed! Please try again.', 'error');
    },
  });
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      showToast('✅ SHIT tokens approved! You can now place bets.');
    },
    onError: () => {
      showToast('❌ Approval transaction failed!', 'error');
    },
  });

  const approveShit = () => {
    if (CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    write?.();
  };

  return {
    approveShit,
    isLoading: isLoading || isConfirming,
  };
}

// ENHANCED: Hook to approve DEX spending with better state management
export function useApproveDex(showToast: (message: string, type?: 'success' | 'error') => void) {
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.DEX, parseEther('1000000')],
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
  });

  const { write, data, error, isLoading } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error('❌ DEX approval error:', error);
      showToast('❌ DEX approval failed! Please try again.', 'error');
    },
  });
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      showToast('✅ SHIT approved for DEX! You can now swap.');
    },
    onError: () => {
      showToast('❌ DEX approval transaction failed!', 'error');
    },
  });

  const approveDex = () => {
    if (CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    write?.();
  };

  return {
    approveDex,
    isLoading: isLoading || isConfirming,
  };
}

// Hook for manual refill trigger
export function useManualRefill(showToast: (message: string, type?: 'success' | 'error') => void) {
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.CASINO,
    abi: CASINO_ABI,
    functionName: 'triggerRefill',
    enabled: CONTRACT_ADDRESSES.CASINO !== '0x0000000000000000000000000000000000000000',
  });

  const { write, data, error, isLoading } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error('❌ Refill error:', error);
      showToast('❌ Refill failed! Casino may not need refilling yet.', 'error');
    },
  });
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      showToast('🤖 Casino auto-refilled! 1000 SHIT tokens minted.');
    },
    onError: () => {
      showToast('❌ Refill transaction failed!', 'error');
    },
  });

  const triggerRefill = () => {
    if (CONTRACT_ADDRESSES.CASINO === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    write?.();
  };

  return {
    triggerRefill,
    isLoading: isLoading || isConfirming,
  };
}

// ENHANCED: Hook for faucet claim with better state management
export function useClaimFaucet(
  showToast: (message: string, type?: 'success' | 'error') => void,
  onSuccess?: () => void
) {
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.SHITCOIN,
    abi: SHITCOIN_ABI,
    functionName: 'claimFaucet',
    value: parseEther('0.01'),
    enabled: CONTRACT_ADDRESSES.SHITCOIN !== '0x0000000000000000000000000000000000000000',
  });

  const { write, data, error, isLoading } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error('❌ Faucet claim error:', error);
      showToast('❌ Faucet claim failed! Please try again.', 'error');
    },
  });
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      showToast('💩 Faucet claimed! 1000 SHIT tokens received!');
      if (typeof fartSystem !== 'undefined') {
        fartSystem.playFart('faucet_fart');
      }
      // Call the success callback to refresh data
      if (onSuccess) {
        setTimeout(onSuccess, 1000); // Small delay to ensure blockchain state is updated
      }
    },
    onError: () => {
      showToast('❌ Faucet claim transaction failed!', 'error');
    },
  });

  const claimFaucet = () => {
    if (CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    write?.();
  };

  return {
    claimFaucet,
    isLoading: isLoading || isConfirming,
  };
}

// COMPLETELY REWRITTEN: Casino bet hook with bulletproof state management
export function useCasinoBet(showToast: (message: string, type?: 'success' | 'error') => void, userAddress?: `0x${string}`) {
  const [betParams, setBetParams] = React.useState<{ betAmount: string; choice: number } | null>(null);
  const [gameResult, setGameResult] = React.useState<{ 
    won: boolean; 
    result: string; 
    payout: number; 
    playerChoice: string;
    actualResult: string;
    gasLotteryWon: boolean;
  } | null>(null);
  
  // Enhanced state tracking
  const [transactionState, setTransactionState] = React.useState<'idle' | 'preparing' | 'waiting' | 'confirming' | 'complete' | 'failed'>('idle');
  const [lastProcessedTxHash, setLastProcessedTxHash] = React.useState<string | null>(null);

  const { config, error: prepareError } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.CASINO,
    abi: CASINO_ABI,
    functionName: 'playButtsOrTurds',
    args: betParams ? [parseEther(betParams.betAmount), BigInt(betParams.choice)] : undefined,
    value: parseEther('0.005'),
    enabled: !!betParams && CONTRACT_ADDRESSES.CASINO !== '0x0000000000000000000000000000000000000000',
  });

  const { write, data, error, isLoading } = useContractWrite({
    ...config,
    onSuccess: (data) => {
      setTransactionState('confirming');
      setLastProcessedTxHash(data.hash);
    },
    onError: (error) => {
      setTransactionState('failed');
      // Reset everything on error
      setBetParams(null);
      setGameResult(null);
      setLastProcessedTxHash(null);
      showToast('❌ Transaction failed! Please try again.', 'error');
    },
  });
  
  const { isLoading: isConfirming, isSuccess, isError } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      setTransactionState('complete');
      // Don't reset state here - let the event handler do it
    },
    onError: () => {
      setTransactionState('failed');
      setBetParams(null);
      setGameResult(null);
      setLastProcessedTxHash(null);
      showToast('❌ Transaction failed! Please try again.', 'error');
    },
  });

  // Enhanced event listener with better error handling
  React.useEffect(() => {
    if (!userAddress || CONTRACT_ADDRESSES.CASINO === '0x0000000000000000000000000000000000000000') {
      return;
    }

    let contract: any;
    let isActive = true;

    const setupEventListener = async () => {
      try {
        // Use ethers v5 syntax
        const provider = new ethers.providers.JsonRpcProvider('https://polygon.drpc.org');

        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.CASINO,
          [
            'event GameResult(address indexed player, uint256 betAmount, bool playerWon, string playerChoice, string result, uint256 payout, bool gasLotteryWon)'
          ],
          provider
        );

        // Listen for GameResult events for this user
        const eventFilter = contract.filters.GameResult(userAddress);

        let processedTxHashes = new Set<string>();
        
        const handleGameResult = (player: string, betAmount: any, playerWon: boolean, playerChoice: string, result: string, payout: any, gasLotteryWon: boolean, event: any) => {
          if (!isActive) return;
          
          if (player.toLowerCase() !== userAddress.toLowerCase()) {
            return;
          }

          // Only process events for our current transaction
          if (lastProcessedTxHash && event.transactionHash.toLowerCase() !== lastProcessedTxHash.toLowerCase()) {
            return;
          }

          // Prevent duplicate processing
          if (processedTxHashes.has(event.transactionHash)) {
            return;
          }
          processedTxHashes.add(event.transactionHash);

          // Handle ethers v5 syntax
          const localFormatEther = ethers.utils.formatEther;
          const payoutFormatted = Number(localFormatEther(payout));
          
          setGameResult({
            won: playerWon,
            result: playerWon ? "You won!" : "You lost!",
            payout: payoutFormatted,
            playerChoice: playerChoice,
            actualResult: result,
            gasLotteryWon: gasLotteryWon
          });
          
          // Clean up state immediately
          setBetParams(null);
          setTransactionState('idle');
          setLastProcessedTxHash(null);
        };

        contract.on(eventFilter, handleGameResult);
        
        return () => {
          isActive = false;
          if (contract) {
            contract.removeAllListeners();
          }
        };
        
      } catch (error) {
        return null;
      }
    };

    let cleanup: Promise<(() => void) | null>;
    setupEventListener().then(cleanupFn => {
      cleanup = Promise.resolve(cleanupFn);
    });

    return () => {
      isActive = false;
      if (cleanup) {
        cleanup.then(cleanupFn => cleanupFn?.());
      }
    };
  }, [userAddress, lastProcessedTxHash]);

  const placeBet = (betAmount: string, choice: number) => {
    if (CONTRACT_ADDRESSES.CASINO === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    
    // Clear any previous state
    setGameResult(null);
    setTransactionState('preparing');
    setLastProcessedTxHash(null);
    setBetParams({ betAmount, choice });
  };

  // Enhanced write trigger with better error handling
  React.useEffect(() => {
    if (betParams && config && write && transactionState === 'preparing' && !isLoading && !isConfirming) {
      setTransactionState('waiting');
      try {
        write();
      } catch (err) {
        showToast('❌ Transaction preparation failed!', 'error');
        setBetParams(null);
        setTransactionState('idle');
        setLastProcessedTxHash(null);
      }
    }
  }, [betParams, config, write, transactionState, isLoading, isConfirming]);

  // FIXED: Handle the case where transaction is submitted but confirmation is taking time
  React.useEffect(() => {
    if (data?.hash && transactionState === 'waiting') {
      setTransactionState('confirming');
      setLastProcessedTxHash(data.hash);
    }
  }, [data?.hash, transactionState]);

  // Handle preparation errors
  React.useEffect(() => {
    if (prepareError && transactionState === 'preparing') {
      showToast('❌ Contract preparation failed! Check your token balance and allowance.', 'error');
      setBetParams(null);
      setTransactionState('idle');
      setLastProcessedTxHash(null);
    }
  }, [prepareError, transactionState]);

  // Handle user cancellation or transaction failure
  React.useEffect(() => {
    if (error && (transactionState === 'waiting' || transactionState === 'preparing')) {
      setBetParams(null);
      setTransactionState('idle');
      setLastProcessedTxHash(null);
    }
  }, [error, transactionState]);

  // Auto-reset on failed state
  React.useEffect(() => {
    if (transactionState === 'failed') {
      const timer = setTimeout(() => {
        setTransactionState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [transactionState]);

  const clearGameResult = () => {
    setGameResult(null);
    setBetParams(null);
    setTransactionState('idle');
    setLastProcessedTxHash(null);
  };

  // Enhanced loading state that properly reflects the transaction lifecycle
  const isReallyLoading = transactionState === 'preparing' || 
                          transactionState === 'waiting' || 
                          transactionState === 'confirming';

  return {
    placeBet,
    isLoading: isReallyLoading,
    gameResult,
    clearGameResult,
  };
}

// ENHANCED: Hook for DEX swap with better state management
export function useDexSwap(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [swapParams, setSwapParams] = React.useState<{ amount: string; direction: string; minOut: string } | null>(null);

  const { config: maticConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.DEX,
    abi: DEX_ABI,
    functionName: 'swapMaticForShit',
    args: swapParams?.direction === 'matic-to-shit' ? [parseEther(swapParams.minOut)] : undefined,
    value: swapParams?.direction === 'matic-to-shit' ? parseEther(swapParams.amount) : undefined,
    enabled: swapParams?.direction === 'matic-to-shit' && CONTRACT_ADDRESSES.DEX !== '0x0000000000000000000000000000000000000000',
  });

  const { config: shitConfig } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.DEX,
    abi: DEX_ABI,
    functionName: 'swapShitForMatic',
    args: swapParams?.direction === 'shit-to-matic' ? [parseEther(swapParams.amount), parseEther(swapParams.minOut)] : undefined,
    enabled: swapParams?.direction === 'shit-to-matic' && CONTRACT_ADDRESSES.DEX !== '0x0000000000000000000000000000000000000000',
  });

  const { write: writeMaticSwap, data: maticData, error: maticError, isLoading: maticLoading } = useContractWrite({
    ...maticConfig,
    onError: (error) => {
      console.error('❌ MATIC swap error:', error);
      showToast('❌ Swap failed! Please try again.', 'error');
      setSwapParams(null);
    },
  });

  const { write: writeShitSwap, data: shitData, error: shitError, isLoading: shitLoading } = useContractWrite({
    ...shitConfig,
    onError: (error) => {
      console.error('❌ SHIT swap error:', error);
      showToast('❌ Swap failed! Please try again.', 'error');
      setSwapParams(null);
    },
  });
  
  const { isLoading: isMaticConfirming, isSuccess: isMaticSuccess } = useWaitForTransaction({
    hash: maticData?.hash,
    onSuccess: () => {
      showToast('🔄 Swap completed successfully!');
      if (typeof fartSystem !== 'undefined') {
        fartSystem.playFart('swap_fart');
      }
      setSwapParams(null);
    },
    onError: () => {
      showToast('❌ Swap transaction failed!', 'error');
      setSwapParams(null);
    },
  });

  const { isLoading: isShitConfirming, isSuccess: isShitSuccess } = useWaitForTransaction({
    hash: shitData?.hash,
    onSuccess: () => {
      showToast('🔄 Swap completed successfully!');
      if (typeof fartSystem !== 'undefined') {
        fartSystem.playFart('swap_fart');
      }
      setSwapParams(null);
    },
    onError: () => {
      showToast('❌ Swap transaction failed!', 'error');
      setSwapParams(null);
    },
  });

  const swapMaticForShit = (amount: string, minOut: string = '0') => {
    if (CONTRACT_ADDRESSES.DEX === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    setSwapParams({ amount, direction: 'matic-to-shit', minOut });
    setTimeout(() => writeMaticSwap?.(), 100);
  };

  const swapShitForMatic = (amount: string, minOut: string = '0') => {
    if (CONTRACT_ADDRESSES.DEX === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }
    setSwapParams({ amount, direction: 'shit-to-matic', minOut });
    setTimeout(() => writeShitSwap?.(), 100);
  };

  return {
    swapMaticForShit,
    swapShitForMatic,
    isLoading: maticLoading || shitLoading || isMaticConfirming || isShitConfirming,
  };
}

// Check who owns the DEX
export function useDexOwner() {
  return useContractRead({
    address: CONTRACT_ADDRESSES.DEX,
    abi: DEX_ABI,
    functionName: 'owner',
    enabled: CONTRACT_ADDRESSES.DEX !== '0x0000000000000000000000000000000000000000',
  });
}

// Sync reserves (owner only)
export function useSyncReserves(showToast: (message: string, type?: 'success' | 'error') => void) {
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESSES.DEX,
    abi: DEX_ABI,
    functionName: 'syncReserves',
  });

  const { write, data, isLoading } = useContractWrite({
    ...config,
    onError: (error) => {
      console.error('❌ Sync reserves error:', error);
      showToast('❌ Sync failed!', 'error');
    },
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: () => {
      showToast('✅ Reserves synced!');
    },
    onError: () => {
      showToast('❌ Sync transaction failed!', 'error');
    },
  });

  return {
    syncReserves: write,
    isLoading: isLoading || isConfirming,
  };
}