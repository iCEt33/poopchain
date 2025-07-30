// hooks/useContracts.ts (enhanced) - FIXED transaction handling and state management
import React from 'react';
import { useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);

  const approveShit = async () => {
    if (CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      showToast('⏳ Preparing approval...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.SHITCOIN,
        [
          {
            "inputs": [
              {"name": "spender", "type": "address"},
              {"name": "amount", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        signer
      );

      console.log('🔓 Approving SHIT for casino...');

      // Send transaction
      const tx = await contract.approve(
        CONTRACT_ADDRESSES.CASINO,
        ethers.utils.parseEther('1000000'), // 1M tokens
        {
          gasLimit: 200000,
        }
      );

      console.log('✅ Approval transaction submitted:', tx.hash);
      showToast('⏳ Approval submitted! Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait(1);

      console.log('✅ Approval confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
      });

      if (receipt.status === 1) {
        showToast('✅ SHIT tokens approved! You can now place bets.');
      } else {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ Approval failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ Approval cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient POL for gas!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ Approval reverted!', 'error');
      } else {
        showToast('❌ Approval failed! Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    approveShit,
    isLoading,
  };
}

// ENHANCED: Hook to approve DEX spending with better state management
export function useApproveDex(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [isLoading, setIsLoading] = useState(false);

  const approveDex = async () => {
    if (CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      showToast('⏳ Preparing DEX approval...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.SHITCOIN,
        [
          {
            "inputs": [
              {"name": "spender", "type": "address"},
              {"name": "amount", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        signer
      );

      console.log('🔓 Approving SHIT for DEX...');

      // Send transaction
      const tx = await contract.approve(
        CONTRACT_ADDRESSES.DEX,
        ethers.utils.parseEther('1000000'), // 1M tokens
        {
          gasLimit: 200000,
        }
      );

      console.log('✅ DEX approval transaction submitted:', tx.hash);
      showToast('⏳ DEX approval submitted! Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait(1);

      console.log('✅ DEX approval confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
      });

      if (receipt.status === 1) {
        showToast('✅ SHIT approved for DEX! You can now swap.');
      } else {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ DEX approval failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ DEX approval cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient POL for gas!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ DEX approval reverted!', 'error');
      } else {
        showToast('❌ DEX approval failed! Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    approveDex,
    isLoading,
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
  const [isLoading, setIsLoading] = useState(false);

  const claimFaucet = async () => {
    if (!CONTRACT_ADDRESSES.SHITCOIN || CONTRACT_ADDRESSES.SHITCOIN === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      showToast('⏳ Preparing transaction...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.SHITCOIN,
        [
          {
            "inputs": [],
            "name": "claimFaucet",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
          }
        ],
        signer
      );

      console.log('🚰 Calling claimFaucet...');

      // Send transaction
      const tx = await contract.claimFaucet({
        value: ethers.utils.parseEther('0.01'),
        gasLimit: 300000,
      });

      console.log('✅ Transaction submitted:', tx.hash);
      showToast('⏳ Transaction submitted! Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait(1); // Wait for 1 confirmation

      console.log('✅ Transaction confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      if (receipt.status === 1) {
        showToast('💩 Faucet claimed! 1000 SHIT tokens received!');
        
        if (typeof fartSystem !== 'undefined') {
          fartSystem.playFart('faucet_fart');
        }
        
        if (onSuccess) {
          setTimeout(onSuccess, 2000);
        }
      } else {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ Faucet claim failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ Transaction cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient POL balance for gas!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ Transaction reverted! Check cooldown period.', 'error');
      } else {
        showToast('❌ Faucet claim failed! Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    claimFaucet,
    isLoading,
  };
}

// COMPLETELY REWRITTEN: Casino bet hook with bulletproof state management
// COMPLETELY REPLACE your current useCasinoBet with this pure ethers version

export function useCasinoBet(showToast: (message: string, type?: 'success' | 'error') => void, userAddress?: `0x${string}`) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [gameResult, setGameResult] = React.useState<{ 
    won: boolean; 
    result: string; 
    payout: number; 
    playerChoice: string;
    actualResult: string;
    gasLotteryWon: boolean;
  } | null>(null);

  // Event listener for GameResult - KEEP this part but simplified
  React.useEffect(() => {
    if (!userAddress || CONTRACT_ADDRESSES.CASINO === '0x0000000000000000000000000000000000000000') {
      return;
    }

    let contract: any;
    let isActive = true;

    const setupEventListener = async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider('https://polygon.drpc.org');

        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.CASINO,
          [
            'event GameResult(address indexed player, uint256 betAmount, bool playerWon, string playerChoice, string result, uint256 payout, bool gasLotteryWon)'
          ],
          provider
        );

        const eventFilter = contract.filters.GameResult(userAddress);
        let processedTxHashes = new Set<string>();
        
        const handleGameResult = (player: string, betAmount: any, playerWon: boolean, playerChoice: string, result: string, payout: any, gasLotteryWon: boolean, event: any) => {
          if (!isActive || player.toLowerCase() !== userAddress.toLowerCase()) {
            return;
          }

          if (processedTxHashes.has(event.transactionHash)) {
            return;
          }
          processedTxHashes.add(event.transactionHash);

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
          
          setIsLoading(false); // Stop loading when we get the result
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
  }, [userAddress]);

  // PURE ETHERS placeBet function - NO WAGMI
  const placeBet = async (betAmount: string, choice: number) => {
    if (CONTRACT_ADDRESSES.CASINO === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    setGameResult(null);

    try {
      showToast('⏳ Preparing bet...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.CASINO,
        [
          {
            "inputs": [
              {"name": "betAmount", "type": "uint256"},
              {"name": "choice", "type": "uint256"}
            ],
            "name": "playButtsOrTurds",
            "outputs": [],
            "stateMutability": "payable", 
            "type": "function"
          }
        ],
        signer
      );

      console.log('🎲 Placing bet:', { betAmount, choice });

      // Send transaction
      const tx = await contract.playButtsOrTurds(
        ethers.utils.parseEther(betAmount),
        choice,
        {
          value: ethers.utils.parseEther('0.005'),
          gasLimit: 500000,
        }
      );

      console.log('✅ Bet transaction submitted:', tx.hash);
      showToast('⏳ Bet placed! Waiting for result...');

      // Wait for confirmation
      const receipt = await tx.wait(1);

      console.log('✅ Bet transaction confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
      });

      if (receipt.status !== 1) {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ Bet failed:', error);
      setIsLoading(false);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ Bet cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient balance for bet!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ Bet reverted! Check allowance and limits.', 'error');
      } else {
        showToast('❌ Bet failed! Please try again.', 'error');
      }
    }
  };

  const clearGameResult = () => {
    setGameResult(null);
  };

  return {
    placeBet,
    isLoading,
    gameResult,
    clearGameResult,
  };
}

// ENHANCED: Hook for DEX swap with better state management
// REPLACE useDexSwap with this pure ethers version

export function useDexSwap(showToast: (message: string, type?: 'success' | 'error') => void) {
  const [isLoading, setIsLoading] = useState(false);

  const swapMaticForShit = async (amount: string, minOut: string = '0') => {
    if (CONTRACT_ADDRESSES.DEX === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      showToast('⏳ Preparing swap...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.DEX,
        [
          {
            "inputs": [{"name": "minShitOut", "type": "uint256"}],
            "name": "swapMaticForShit",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
          }
        ],
        signer
      );

      console.log('🔄 Swapping MATIC for SHIT:', { amount, minOut });

      // Send transaction
      const tx = await contract.swapMaticForShit(
        ethers.utils.parseEther(minOut),
        {
          value: ethers.utils.parseEther(amount),
          gasLimit: 400000,
        }
      );

      console.log('✅ Swap transaction submitted:', tx.hash);
      showToast('⏳ Swap submitted! Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait(1);

      console.log('✅ Swap confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
      });

      if (receipt.status === 1) {
        showToast('🔄 Swap completed successfully!');
        if (typeof fartSystem !== 'undefined') {
          fartSystem.playFart('swap_fart');
        }
      } else {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ MATIC swap failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ Swap cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient MATIC balance!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ Swap reverted! Check slippage.', 'error');
      } else {
        showToast('❌ Swap failed! Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const swapShitForMatic = async (amount: string, minOut: string = '0') => {
    if (CONTRACT_ADDRESSES.DEX === '0x0000000000000000000000000000000000000000') {
      showToast('Contract not deployed yet!', 'error');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      showToast('⏳ Preparing swap...');

      // Get provider and signer
      if (!(window as any).ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new ethers.providers.Web3Provider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.DEX,
        [
          {
            "inputs": [
              {"name": "shitAmount", "type": "uint256"},
              {"name": "minMaticOut", "type": "uint256"}
            ],
            "name": "swapShitForMatic", 
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        signer
      );

      console.log('🔄 Swapping SHIT for MATIC:', { amount, minOut });

      // Send transaction
      const tx = await contract.swapShitForMatic(
        ethers.utils.parseEther(amount),
        ethers.utils.parseEther(minOut),
        {
          gasLimit: 400000,
        }
      );

      console.log('✅ Swap transaction submitted:', tx.hash);
      showToast('⏳ Swap submitted! Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait(1);

      console.log('✅ Swap confirmed!', {
        hash: receipt.transactionHash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
      });

      if (receipt.status === 1) {
        showToast('🔄 Swap completed successfully!');
        if (typeof fartSystem !== 'undefined') {
          fartSystem.playFart('swap_fart');
        }
      } else {
        throw new Error('Transaction was reverted');
      }

    } catch (error: any) {
      console.error('❌ SHIT swap failed:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        showToast('❌ Swap cancelled by user.', 'error');
      } else if (error.message?.includes('insufficient funds')) {
        showToast('❌ Insufficient SHIT balance or allowance!', 'error');
      } else if (error.message?.includes('execution reverted')) {
        showToast('❌ Swap reverted! Check allowance and slippage.', 'error');
      } else {
        showToast('❌ Swap failed! Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    swapMaticForShit,
    swapShitForMatic,
    isLoading,
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