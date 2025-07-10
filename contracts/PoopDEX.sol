// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IShitCoin {
    function fundGasPool(bool fromFees) external payable;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PoopDEX is Ownable, ReentrancyGuard, Pausable {
    IShitCoin public shitCoin;
    
    // Trading fee: 2.5% goes to gas pool
    uint256 public constant TRADING_FEE = 250; // 2.5% in basis points (250/10000)
    
    // FIXED: Minimum swap amounts to prevent dust trades and division errors
    uint256 public constant MIN_MATIC_SWAP = 1000; // 0.000001 MATIC
    uint256 public constant MIN_SHIT_SWAP = 1000;  // 0.000001 SHIT
    
    // Liquidity pools
    uint256 public maticReserve;
    uint256 public shitCoinReserve;
    
    // Events
    event LiquidityAdded(address indexed provider, uint256 maticAmount, uint256 shitAmount);
    event LiquidityRemoved(address indexed provider, uint256 maticAmount, uint256 shitAmount);
    event TokenSwap(
        address indexed user,
        string swapType,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    );
    event FartSound(address indexed user, string soundType);
    event ReservesSynced(uint256 maticReserve, uint256 shitReserve);
    
    constructor(address _shitCoinAddress) {
        shitCoin = IShitCoin(_shitCoinAddress);
    }
    
    /**
     * @dev FIXED: Sync reserves with actual contract balances
     */
    function syncReserves() external onlyOwner {
        uint256 actualMatic = address(this).balance;
        uint256 actualShit = shitCoin.balanceOf(address(this));
        
        // Only sync if reserves are significantly off (>1% difference)
        uint256 maticDiff = actualMatic > maticReserve ? 
            actualMatic - maticReserve : maticReserve - actualMatic;
        uint256 shitDiff = actualShit > shitCoinReserve ? 
            actualShit - shitCoinReserve : shitCoinReserve - actualShit;
        
        if (maticDiff * 100 > maticReserve || shitDiff * 100 > shitCoinReserve) {
            maticReserve = actualMatic;
            shitCoinReserve = actualShit;
            emit ReservesSynced(actualMatic, actualShit);
        }
    }
    
    /**
     * @dev FIXED: Get reserve health check
     */
    function getReserveHealth() external view returns (
        uint256 maticReserveTracked,
        uint256 maticActual,
        uint256 shitReserveTracked, 
        uint256 shitActual,
        bool needsSync
    ) {
        uint256 actualMatic = address(this).balance;
        uint256 actualShit = shitCoin.balanceOf(address(this));
        
        // Check if >1% difference
        uint256 maticDiff = actualMatic > maticReserve ? 
            actualMatic - maticReserve : maticReserve - actualMatic;
        uint256 shitDiff = actualShit > shitCoinReserve ? 
            actualShit - shitCoinReserve : shitCoinReserve - actualShit;
        
        bool needsSync = (maticReserve > 0 && maticDiff * 100 > maticReserve) || 
                         (shitCoinReserve > 0 && shitDiff * 100 > shitCoinReserve);
        
        return (maticReserve, actualMatic, shitCoinReserve, actualShit, needsSync);
    }
    
    /**
     * @dev Add liquidity to the pool (owner only initially)
     */
    function addLiquidity(uint256 shitAmount) external payable onlyOwner {
        require(msg.value > 0, "Must send MATIC");
        require(shitAmount > 0, "Must send SHIT tokens");
        
        // Transfer SHIT tokens from owner
        require(
            shitCoin.transferFrom(msg.sender, address(this), shitAmount),
            "SHIT transfer failed"
        );
        
        // Update reserves
        maticReserve += msg.value;
        shitCoinReserve += shitAmount;
        
        emit LiquidityAdded(msg.sender, msg.value, shitAmount);
    }
    
    /**
     * @dev FIXED: Enhanced MATIC to SHIT swap with minimum checks
     */
    function swapMaticForShit(uint256 minShitOut) external payable whenNotPaused nonReentrant {
        require(msg.value >= MIN_MATIC_SWAP, "Swap amount too small");
        require(msg.value > 0, "Must send MATIC");
        require(maticReserve > 0 && shitCoinReserve > 0, "No liquidity");
        
        // Calculate fee
        uint256 feeAmount = (msg.value * TRADING_FEE) / 10000;
        uint256 amountAfterFee = msg.value - feeAmount;
        
        // Calculate output using constant product formula
        // (x + dx) * (y - dy) = x * y
        // dy = (y * dx) / (x + dx)
        uint256 shitOut = (shitCoinReserve * amountAfterFee) / (maticReserve + amountAfterFee);
        
        require(shitOut > 0, "Output amount too small"); // NEW: Prevent zero output
        require(shitOut >= minShitOut, "Slippage too high");
        require(shitOut <= shitCoinReserve, "Insufficient SHIT liquidity");
        
        // Update reserves
        maticReserve += amountAfterFee;
        shitCoinReserve -= shitOut;
        
        // Transfer SHIT tokens to user
        require(shitCoin.transfer(msg.sender, shitOut), "SHIT transfer failed");
        
        // Send fee to gas pool
        shitCoin.fundGasPool{value: feeAmount}(true); // true = trading fee
        
        emit TokenSwap(msg.sender, "MATIC_TO_SHIT", msg.value, shitOut, feeAmount);
        emit FartSound(msg.sender, "swap_fart");
    }
    
    /**
     * @dev FIXED: Enhanced SHIT to MATIC swap with minimum checks
     */
    function swapShitForMatic(uint256 shitAmount, uint256 minMaticOut) external whenNotPaused nonReentrant {
        require(shitAmount >= MIN_SHIT_SWAP, "Swap amount too small");
        require(shitAmount > 0, "Must send SHIT tokens");
        require(maticReserve > 0 && shitCoinReserve > 0, "No liquidity");
        
        // Transfer SHIT tokens from user
        require(
            shitCoin.transferFrom(msg.sender, address(this), shitAmount),
            "SHIT transfer failed"
        );
        
        // Calculate output using constant product formula
        uint256 maticOut = (maticReserve * shitAmount) / (shitCoinReserve + shitAmount);
        
        require(maticOut > 0, "Output amount too small"); // NEW: Prevent zero output
        
        // Calculate fee
        uint256 feeAmount = (maticOut * TRADING_FEE) / 10000;
        uint256 amountAfterFee = maticOut - feeAmount;
        
        require(amountAfterFee >= minMaticOut, "Slippage too high");
        require(amountAfterFee <= maticReserve, "Insufficient MATIC liquidity");
        
        // Update reserves
        shitCoinReserve += shitAmount;
        maticReserve -= maticOut;
        
        // Send MATIC to user
        (bool success, ) = msg.sender.call{value: amountAfterFee}("");
        require(success, "MATIC transfer failed");
        
        // Send fee to gas pool
        shitCoin.fundGasPool{value: feeAmount}(true); // true = trading fee
        
        emit TokenSwap(msg.sender, "SHIT_TO_MATIC", shitAmount, amountAfterFee, feeAmount);
        emit FartSound(msg.sender, "swap_fart");
    }
    
    /**
     * @dev Get quote for MATIC -> SHIT swap
     */
    function getMaticToShitQuote(uint256 maticAmount) external view returns (uint256 shitOut, uint256 feeAmount) {
        if (maticReserve == 0 || shitCoinReserve == 0) {
            return (0, 0);
        }
        
        feeAmount = (maticAmount * TRADING_FEE) / 10000;
        uint256 amountAfterFee = maticAmount - feeAmount;
        shitOut = (shitCoinReserve * amountAfterFee) / (maticReserve + amountAfterFee);
    }
    
    /**
     * @dev Get quote for SHIT -> MATIC swap
     */
    function getShitToMaticQuote(uint256 shitAmount) external view returns (uint256 maticOut, uint256 feeAmount) {
        if (maticReserve == 0 || shitCoinReserve == 0) {
            return (0, 0);
        }
        
        uint256 rawMaticOut = (maticReserve * shitAmount) / (shitCoinReserve + shitAmount);
        feeAmount = (rawMaticOut * TRADING_FEE) / 10000;
        maticOut = rawMaticOut - feeAmount;
    }
    
    /**
     * @dev Get current reserves
     */
    function getReserves() external view returns (uint256 matic, uint256 shit) {
        return (maticReserve, shitCoinReserve);
    }
    
    /**
     * @dev Get current price (SHIT per MATIC)
     */
    function getPrice() external view returns (uint256) {
        if (maticReserve == 0) return 0;
        return (shitCoinReserve * 1e18) / maticReserve;
    }
    
    /**
     * @dev Emergency functions (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 maticBalance = address(this).balance;
        uint256 shitBalance = shitCoin.balanceOf(address(this));
        
        if (maticBalance > 0) {
            (bool success, ) = owner().call{value: maticBalance}("");
            require(success, "MATIC withdrawal failed");
        }
        
        if (shitBalance > 0) {
            require(shitCoin.transfer(owner(), shitBalance), "SHIT withdrawal failed");
        }
        
        // Reset reserves
        maticReserve = 0;
        shitCoinReserve = 0;
    }
    
    /**
     * @dev Emergency pause all DEX operations (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Resume DEX operations (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}