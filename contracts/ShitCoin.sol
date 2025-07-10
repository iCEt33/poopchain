// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ShitCoin is ERC20, Ownable, ReentrancyGuard {
    // Faucet settings
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18; // 1000 tokens
    uint256 public constant FAUCET_COOLDOWN = 24 hours;
    
    // Gas lottery settings - UPDATED with protection
    uint256 public gasLotteryChance = 50; // 50% chance to win
    uint256 public gasPool; // Pool of MATIC for gas refunds
    uint256 public constant MIN_POOL_BALANCE = 0.5 ether; // 0.5 MATIC minimum
    uint256 public constant MAX_SINGLE_PAYOUT = 0.01 ether; // 0.01 MATIC max per win
    uint256 public constant PAYOUT_PERCENTAGE = 60; // Can pay out 60% of daily income
    
    // Daily tracking for dynamic limits
    uint256 public dailyIncomeFromFees;      // DEX trading fees earned today
    uint256 public dailyIncomeFromPayments;  // Faucet/casino payments received today
    uint256 public dailyPayoutUsed;          // Lottery payouts made today
    uint256 public lastDayReset;
    
    // Casino minting settings
    address public casinoContract;
    uint256 public totalMintedForCasino; // Track total minted
    uint256 public maxDailyMinting = 24000 * 10**18; // 24k SHIT max per day
    uint256 public dailyMintingUsed;
    uint256 public lastMintingReset;
    
    // Mappings
    mapping(address => uint256) public lastFaucetClaim;
    mapping(address => uint256) public gasLotteryWins;
    mapping(address => uint256) public totalGasRefunded;
    
    // Events
    event FaucetClaimed(address indexed user, uint256 amount, uint256 gasPaid);
    event GasLotteryWin(address indexed user, uint256 gasRefunded);
    event GasPoolFunded(uint256 amount, bool fromFees);
    event FartSound(address indexed user, string soundType);
    event CasinoMint(uint256 amount, uint256 totalMinted);
    event CasinoContractSet(address indexed casino);
    event GasLotteryPaused(string reason);
    event DailyStatsReset(uint256 newDay);
    
    constructor() ERC20("ShitCoin", "SHIT") {
        // Mint initial supply to owner for liquidity
        _mint(msg.sender, 1000000 * 10**18); // 1M tokens
        lastDayReset = block.timestamp;
        lastMintingReset = block.timestamp;
    }
    
    /**
     * @dev Set the casino contract address (owner only)
     */
    function setCasinoContract(address _casino) external onlyOwner {
        casinoContract = _casino;
        emit CasinoContractSet(_casino);
    }
    
    /**
     * @dev Mint tokens for casino refills (casino only)
     */
    function mintForCasino(uint256 amount) external {
        require(msg.sender == casinoContract, "Only casino can mint");
        require(casinoContract != address(0), "Casino not set");
        
        // Reset daily limit if needed
        if (block.timestamp >= lastMintingReset + 1 days) {
            dailyMintingUsed = 0;
            lastMintingReset = block.timestamp;
        }
        
        // Check daily minting limit
        require(dailyMintingUsed + amount <= maxDailyMinting, "Daily mint limit exceeded");
        
        // Update tracking
        dailyMintingUsed += amount;
        totalMintedForCasino += amount;
        
        // Mint tokens to casino
        _mint(casinoContract, amount);
        
        emit CasinoMint(amount, totalMintedForCasino);
    }
    
    /**
     * @dev Get minting stats
     */
    function getMintingStats() external view returns (
        uint256 totalMinted,
        uint256 dailyUsed,
        uint256 dailyLimit,
        uint256 timeUntilReset
    ) {
        uint256 nextReset = lastMintingReset + 1 days;
        uint256 timeLeft = block.timestamp >= nextReset ? 0 : nextReset - block.timestamp;
        
        return (
            totalMintedForCasino,
            dailyMintingUsed,
            maxDailyMinting,
            timeLeft
        );
    }
    
    /**
     * @dev Reset daily counters if new day
     */
    function _resetDailyCountersIfNeeded() internal {
        if (block.timestamp >= lastDayReset + 1 days) {
            dailyIncomeFromFees = 0;
            dailyIncomeFromPayments = 0;
            dailyPayoutUsed = 0;
            lastDayReset = block.timestamp;
            emit DailyStatsReset(block.timestamp);
        }
    }
    
    /**
     * @dev FIXED: Protected gas lottery with dynamic limits
     */
    function _rollGasLottery(address user, uint256 gasAmount) internal returns (bool) {
        // Reset daily counters if needed
        _resetDailyCountersIfNeeded();
        
        // Pool health check - STOP if too low
        if (gasPool <= MIN_POOL_BALANCE) {
            emit GasLotteryPaused("Pool below minimum balance");
            return false;
        }
        
        // Calculate dynamic daily limit based on income
        uint256 totalDailyIncome = dailyIncomeFromFees + dailyIncomeFromPayments;
        uint256 dynamicDailyLimit = (totalDailyIncome * PAYOUT_PERCENTAGE) / 100;
        
        // Income check - STOP if no income or limit reached
        if (dynamicDailyLimit == 0 || dailyPayoutUsed >= dynamicDailyLimit) {
            emit GasLotteryPaused("Daily payout limit reached or no income");
            return false;
        }
        
        // Cap individual payout
        uint256 payout = gasAmount > MAX_SINGLE_PAYOUT ? MAX_SINGLE_PAYOUT : gasAmount;
        
        // Check if payout would exceed daily limit
        if (dailyPayoutUsed + payout > dynamicDailyLimit) {
            emit GasLotteryPaused("Payout would exceed daily limit");
            return false;
        }
        
        // Ensure payout won't drop pool below minimum
        if (gasPool - payout < MIN_POOL_BALANCE) {
            emit GasLotteryPaused("Payout would drain pool below minimum");
            return false;
        }
        
        // Generate pseudo-random number (50% chance)
        uint256 randomNumber = uint256(
            keccak256(abi.encodePacked(
                block.timestamp,
                block.difficulty,
                user,
                gasAmount,
                gasPool
            ))
        ) % 100;
        
        // 50% chance to win lottery
        if (randomNumber < gasLotteryChance) {
            // Update counters
            gasPool -= payout;
            dailyPayoutUsed += payout;
            gasLotteryWins[user]++;
            totalGasRefunded[user] += payout;
            
            // Send refund
            (bool success, ) = user.call{value: payout}("");
            require(success, "Gas refund failed");
            
            emit GasLotteryWin(user, payout);
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Claim daily faucet tokens
     * User pays gas, gets tokens, gas goes to pool
     */
    function claimFaucet() external payable nonReentrant {
        require(msg.value > 0, "Must pay gas fee");
        require(
            block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
            "Faucet cooldown not finished"
        );
        
        // Reset daily counters if needed
        _resetDailyCountersIfNeeded();
        
        // Update last claim time
        lastFaucetClaim[msg.sender] = block.timestamp;
        
        // Add gas payment to pool and track as income
        gasPool += msg.value;
        dailyIncomeFromPayments += msg.value;
        
        // Mint tokens to user
        _mint(msg.sender, FAUCET_AMOUNT);
        
        // Try gas lottery
        bool wonLottery = _rollGasLottery(msg.sender, msg.value);
        
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT, msg.value);
        
        if (!wonLottery) {
            // Guaranteed fart sound on gas payment
            emit FartSound(msg.sender, "faucet_fart");
        }
    }
    
    /**
     * @dev Add funds to gas pool (called by DEX and casino)
     * @param fromFees true if from trading fees, false if from user payments
     */
    function fundGasPool(bool fromFees) external payable {
        // Reset daily counters if needed
        _resetDailyCountersIfNeeded();
        
        gasPool += msg.value;
        
        if (fromFees) {
            dailyIncomeFromFees += msg.value;
        } else {
            dailyIncomeFromPayments += msg.value;
        }
        
        emit GasPoolFunded(msg.value, fromFees);
    }
    
    /**
     * @dev Get gas pool health and statistics
     */
    function getGasPoolHealth() external view returns (
        uint256 poolBalance,
        uint256 dailyIncome,
        uint256 dailyPayouts,
        uint256 dynamicLimit,
        uint256 remainingPayouts,
        bool healthy,
        uint256 timeUntilReset
    ) {
        uint256 totalIncome = dailyIncomeFromFees + dailyIncomeFromPayments;
        uint256 dynamicLimit = (totalIncome * PAYOUT_PERCENTAGE) / 100;
        uint256 remaining = dynamicLimit > dailyPayoutUsed ? dynamicLimit - dailyPayoutUsed : 0;
        bool healthy = gasPool > MIN_POOL_BALANCE && (dynamicLimit == 0 || remaining > 0);
        
        uint256 nextReset = lastDayReset + 1 days;
        uint256 timeLeft = block.timestamp >= nextReset ? 0 : nextReset - block.timestamp;
        
        return (
            gasPool,
            totalIncome,
            dailyPayoutUsed,
            dynamicLimit,
            remaining,
            healthy,
            timeLeft
        );
    }
    
    /**
     * @dev Get detailed gas pool breakdown
     */
    function getGasPoolBreakdown() external view returns (
        uint256 poolBalance,
        uint256 incomeFromFees,
        uint256 incomeFromPayments,
        uint256 totalIncome,
        uint256 payoutsUsed,
        uint256 maxPayouts,
        uint256 minPoolBalance,
        uint256 maxSinglePayout
    ) {
        uint256 totalIncome = dailyIncomeFromFees + dailyIncomeFromPayments;
        uint256 maxPayouts = (totalIncome * PAYOUT_PERCENTAGE) / 100;
        
        return (
            gasPool,
            dailyIncomeFromFees,
            dailyIncomeFromPayments,
            totalIncome,
            dailyPayoutUsed,
            maxPayouts,
            MIN_POOL_BALANCE,
            MAX_SINGLE_PAYOUT
        );
    }
    
    /**
     * @dev Burn tokens (used by casino when users lose)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    /**
     * @dev Burn tokens from specific address (casino only)
     */
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }
    
    /**
     * @dev REMOVED: Transfer lottery (too exploitable)
     * Transfers now work normally without gas lottery
     */
    
    /**
     * @dev Check if user can claim faucet
     */
    function canClaimFaucet(address user) external view returns (bool) {
        return block.timestamp >= lastFaucetClaim[user] + FAUCET_COOLDOWN;
    }
    
    /**
     * @dev Get time until next faucet claim
     */
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaim = lastFaucetClaim[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaim) {
            return 0;
        }
        return nextClaim - block.timestamp;
    }
    
    /**
     * @dev Get user's lottery stats
     */
    function getLotteryStats(address user) external view returns (
        uint256 wins,
        uint256 totalRefunded,
        uint256 currentPoolSize
    ) {
        return (
            gasLotteryWins[user],
            totalGasRefunded[user],
            gasPool
        );
    }
    
    /**
     * @dev Owner can adjust lottery chance (emergency only)
     */
    function setGasLotteryChance(uint256 newChance) external onlyOwner {
        require(newChance <= 100, "Chance cannot exceed 100%");
        gasLotteryChance = newChance;
    }
    
    /**
     * @dev Owner can adjust daily minting limit
     */
    function setDailyMintingLimit(uint256 newLimit) external onlyOwner {
        maxDailyMinting = newLimit;
    }
    
    /**
     * @dev Owner can withdraw excess funds (emergency only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > gasPool, "No excess funds");
        
        uint256 excess = balance - gasPool;
        (bool success, ) = owner().call{value: excess}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get contract's MATIC balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}