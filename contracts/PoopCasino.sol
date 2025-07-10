// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IShitCoin {
    function fundGasPool(bool fromFees) external payable;
    function burnFrom(address account, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function mintForCasino(uint256 amount) external;
}

contract PoopCasino is Ownable, ReentrancyGuard, Pausable {
    IShitCoin public shitCoin;
    
    // TRUE 50% chance - no house edge!
    uint256 public constant WIN_CHANCE = 5000; // 50% in basis points
    
    // Game settings
    uint256 public minBet = 10 * 10**18; // 10 SHIT tokens
    uint256 public maxBet = 1000 * 10**18; // 1000 SHIT tokens
    uint256 public houseBalance; // Casino's SHIT token balance
    
    // Auto-refill settings
    uint256 public constant REFILL_AMOUNT = 1000 * 10**18; // 1000 SHIT
    uint256 public constant REFILL_COOLDOWN = 1 hours; // 1 hour between refills
    uint256 public constant CRITICAL_BALANCE = 2000 * 10**18; // 2000 SHIT trigger
    uint256 public constant MAX_HOUSE_BALANCE = 10000 * 10**18; // 10k SHIT max
    uint256 public lastRefillTime;
    bool public autoRefillEnabled = true;
    
    // FIXED: Add refill race condition protection
    bool private _refilling;
    
    // Game tracking
    mapping(address => uint256) public totalWins;
    mapping(address => uint256) public totalLosses;
    mapping(address => uint256) public biggestWin;
    mapping(address => uint256) public currentStreak;
    mapping(address => bool) public lastGameWon;
    
    // Events
    event GameResult(
        address indexed player,
        uint256 betAmount,
        bool playerWon,
        string playerChoice,
        string result,
        uint256 payout,
        bool gasLotteryWon
    );
    event BigWin(address indexed player, uint256 amount);
    event LosingStreak(address indexed player, uint256 streakLength);
    event FartSound(address indexed player, string soundType);
    event HouseFunded(uint256 amount);
    event GasLotteryWin(address indexed player, uint256 gasRefunded);
    event CasinoAutoRefilled(uint256 amount, uint256 newBalance);
    event HouseBalanceSynced(uint256 newBalance);
    event RefillFailed(string reason);
    
    constructor(address _shitCoinAddress) {
        shitCoin = IShitCoin(_shitCoinAddress);
    }
    
    /**
     * @dev FIXED: Sync house balance with actual token balance
     */
    function syncHouseBalance() public {
        uint256 actualBalance = shitCoin.balanceOf(address(this));
        houseBalance = actualBalance;
        emit HouseBalanceSynced(actualBalance);
    }
    
    /**
     * @dev FIXED: Check if casino needs refilling with race condition protection
     */
    function shouldRefill() public view returns (bool) {
        return !_refilling && // Prevent concurrent refills
               autoRefillEnabled &&
               houseBalance < CRITICAL_BALANCE &&
               block.timestamp >= lastRefillTime + REFILL_COOLDOWN &&
               houseBalance < MAX_HOUSE_BALANCE;
    }
    
    /**
     * @dev FIXED: Enhanced auto-refill with proper error handling
     */
    function _performAutoRefill() internal {
        uint256 refillAmount = REFILL_AMOUNT;
        
        // Don't exceed max house balance
        if (houseBalance + refillAmount > MAX_HOUSE_BALANCE) {
            refillAmount = MAX_HOUSE_BALANCE - houseBalance;
        }
        
        if (refillAmount > 0) {
            uint256 balanceBefore = shitCoin.balanceOf(address(this));
            
            try shitCoin.mintForCasino(refillAmount) {
                // Verify tokens were actually received
                uint256 balanceAfter = shitCoin.balanceOf(address(this));
                uint256 actualReceived = balanceAfter - balanceBefore;
                
                if (actualReceived > 0) {
                    houseBalance = balanceAfter; // Sync with actual balance
                    lastRefillTime = block.timestamp;
                    emit CasinoAutoRefilled(actualReceived, houseBalance);
                } else {
                    emit RefillFailed("No tokens received");
                }
            } catch Error(string memory reason) {
                emit RefillFailed(reason);
            } catch {
                emit RefillFailed("Unknown minting error");
            }
        }
    }
    
    /**
     * @dev FIXED: Protected auto-refill modifier with reentrancy protection
     */
    modifier autoRefill() {
        if (shouldRefill() && !_refilling) {
            _refilling = true;
            _performAutoRefill();
            _refilling = false;
        }
        _;
    }
    
    /**
     * @dev Manual refill trigger (anyone can call if conditions met)
     */
    function triggerRefill() external whenNotPaused {
        require(shouldRefill(), "Refill not needed");
        _refilling = true;
        _performAutoRefill();
        _refilling = false;
    }
    
    /**
     * @dev Emergency pause all casino operations (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Resume casino operations (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Owner can enable/disable auto-refill
     */
    function setAutoRefillEnabled(bool enabled) external onlyOwner {
        autoRefillEnabled = enabled;
    }
    
    /**
     * @dev Fund the casino with SHIT tokens (owner only)
     */
    function fundCasino(uint256 amount) external onlyOwner {
        require(
            shitCoin.transferFrom(msg.sender, address(this), amount),
            "SHIT transfer failed"
        );
        houseBalance += amount;
        emit HouseFunded(amount);
    }
    
    /**
     * @dev Play Butts or Turds - TRUE 50/50 coinflip game with auto-refill
     * @param betAmount Amount of SHIT tokens to bet
     * @param choice 0 = Butts, 1 = Turds
     */
    function playButtsOrTurds(uint256 betAmount, uint256 choice) external payable whenNotPaused autoRefill nonReentrant {
        require(choice == 0 || choice == 1, "Invalid choice: 0=Butts, 1=Turds");
        require(betAmount >= minBet, "Bet too small");
        
        // Dynamic max bet based on house balance
        uint256 dynamicMaxBet = houseBalance / 10; // House can cover 10 max bets
        if (dynamicMaxBet < minBet) {
            dynamicMaxBet = minBet; // Always allow minimum bet
        }
        if (dynamicMaxBet > maxBet) {
            dynamicMaxBet = maxBet; // Don't exceed owner-set maximum
        }
        
        require(betAmount <= dynamicMaxBet, "Bet too large for current house balance");
        require(houseBalance >= betAmount, "House cannot cover bet");
        
        // Transfer bet from player
        require(
            shitCoin.transferFrom(msg.sender, address(this), betAmount),
            "SHIT transfer failed"
        );
        
        // Generate random number (TRUE 50/50)
        uint256 randomNumber = uint256(
            keccak256(abi.encodePacked(
                block.timestamp,
                block.difficulty,
                msg.sender,
                betAmount,
                choice,
                blockhash(block.number - 1)
            ))
        ) % 10000;
        
        // TRUE 50% chance for player
        bool playerWon = randomNumber < WIN_CHANCE;
        
        string memory playerChoice = choice == 0 ? "Butts" : "Turds";
        string memory result = (randomNumber % 2 == 0) ? "Butts" : "Turds";
        
        uint256 payout = 0;
        bool gasLotteryWon = false;
        
        if (playerWon) {
            // Player wins - get double their bet
            payout = betAmount * 2;
            houseBalance -= betAmount; // House loses the bet amount
            
            // Update player stats
            totalWins[msg.sender]++;
            if (betAmount > biggestWin[msg.sender]) {
                biggestWin[msg.sender] = betAmount;
            }
            
            // Check for big win (>100 SHIT)
            if (betAmount >= 100 * 10**18) {
                emit BigWin(msg.sender, betAmount);
            }
            
            // Reset losing streak
            currentStreak[msg.sender] = 0;
            lastGameWon[msg.sender] = true;
            
            // Transfer winnings
            require(shitCoin.transfer(msg.sender, payout), "Payout failed");
            
        } else {
            // Player loses - house keeps the bet
            houseBalance += betAmount;
            
            // Update player stats
            totalLosses[msg.sender]++;
            
            // Update losing streak
            if (!lastGameWon[msg.sender]) {
                currentStreak[msg.sender]++;
            } else {
                currentStreak[msg.sender] = 1;
            }
            lastGameWon[msg.sender] = false;
            
            // Check for losing streak (5+ losses)
            if (currentStreak[msg.sender] >= 5) {
                emit LosingStreak(msg.sender, currentStreak[msg.sender]);
                
                // Consolation: try to refund some gas
                if (msg.value > 0) {
                    // Send a portion of the gas fee to the gas pool
                    shitCoin.fundGasPool{value: msg.value / 2}(false); // false = user payment
                    
                    // Refund the other half to player
                    (bool success, ) = msg.sender.call{value: msg.value / 2}("");
                    if (success) {
                        gasLotteryWon = true;
                        emit GasLotteryWin(msg.sender, msg.value / 2);
                    }
                }
            }
            
            // Burn the lost tokens (deflationary)
            // Send to dead address (effectively burning)
            require(shitCoin.transfer(address(0x000000000000000000000000000000000000dEaD), betAmount), "Burn transfer failed");
        }
        
        // Try gas lottery if gas was sent (and no consolation refund)
        if (msg.value > 0 && !gasLotteryWon) {
            gasLotteryWon = _rollGasLottery(msg.sender, msg.value);
            if (!gasLotteryWon) {
                // Send gas fee to gas pool if lottery not won
                shitCoin.fundGasPool{value: msg.value}(false); // false = user payment
            }
        }
        
        emit GameResult(
            msg.sender,
            betAmount,
            playerWon,
            playerChoice,
            result,
            payout,
            gasLotteryWon
        );
    }
    
    /**
     * @dev Internal gas lottery function (50% chance)
     */
    function _rollGasLottery(address user, uint256 gasAmount) internal returns (bool) {
        uint256 randomNumber = uint256(
            keccak256(abi.encodePacked(
                block.timestamp,
                block.difficulty,
                user,
                gasAmount,
                "lottery"
            ))
        ) % 100;
        
        // 50% chance to win gas lottery
        if (randomNumber < 50) {
            // Refund gas
            (bool success, ) = user.call{value: gasAmount}("");
            if (success) {
                emit GasLotteryWin(user, gasAmount);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Get current dynamic max bet based on house balance
     */
    function getCurrentMaxBet() external view returns (uint256) {
        uint256 dynamicMaxBet = houseBalance / 10; // House can cover 10 max bets
        if (dynamicMaxBet < minBet) {
            return minBet; // Always allow minimum bet
        }
        if (dynamicMaxBet > maxBet) {
            return maxBet; // Don't exceed owner-set maximum
        }
        return dynamicMaxBet;
    }
    
    /**
     * @dev Get player stats
     */
    function getPlayerStats(address player) external view returns (
        uint256 wins,
        uint256 losses,
        uint256 biggestWinAmount,
        uint256 streak,
        bool lastWon
    ) {
        return (
            totalWins[player],
            totalLosses[player],
            biggestWin[player],
            currentStreak[player],
            lastGameWon[player]
        );
    }
    
    /**
     * @dev Get casino stats including auto-refill info
     */
    function getCasinoStats() external view returns (
        uint256 houseBalanceAmount,
        uint256 minBetAmount,
        uint256 maxBetAmount,
        uint256 currentMaxBet,
        uint256 winChance,
        bool needsRefill,
        uint256 timeUntilRefill
    ) {
        uint256 dynamicMaxBet = houseBalance / 10;
        if (dynamicMaxBet < minBet) {
            dynamicMaxBet = minBet;
        }
        if (dynamicMaxBet > maxBet) {
            dynamicMaxBet = maxBet;
        }
        
        bool needsRefill = shouldRefill();
        uint256 timeUntilRefill = 0;
        if (!needsRefill && lastRefillTime > 0) {
            uint256 nextRefill = lastRefillTime + REFILL_COOLDOWN;
            timeUntilRefill = block.timestamp >= nextRefill ? 0 : nextRefill - block.timestamp;
        }
        
        return (
            houseBalance,
            minBet,
            maxBet,
            dynamicMaxBet,
            WIN_CHANCE,
            needsRefill,
            timeUntilRefill
        );
    }
    
    /**
     * @dev Owner can adjust bet limits
     */
    function setBetLimits(uint256 newMinBet, uint256 newMaxBet) external onlyOwner {
        require(newMinBet < newMaxBet, "Min bet must be less than max bet");
        minBet = newMinBet;
        maxBet = newMaxBet;
    }
    
    /**
     * @dev Owner can withdraw house profits
     */
    function withdrawHouseProfits(uint256 amount) external onlyOwner {
        require(amount <= houseBalance, "Insufficient house balance");
        houseBalance -= amount;
        require(shitCoin.transfer(owner(), amount), "Withdrawal failed");
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = shitCoin.balanceOf(address(this));
        if (balance > 0) {
            require(shitCoin.transfer(owner(), balance), "Emergency withdrawal failed");
        }
        
        uint256 maticBalance = address(this).balance;
        if (maticBalance > 0) {
            (bool success, ) = owner().call{value: maticBalance}("");
            require(success, "MATIC withdrawal failed");
        }
        
        houseBalance = 0;
    }
}