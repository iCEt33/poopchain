// components/GasPoolDashboard.tsx
import React from 'react';
import { Fuel, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { formatEther } from 'viem';
import { useGasPoolHealth, useGasPoolBreakdown } from '../hooks/useContracts';

export default function GasPoolDashboard() {
  // Get gas pool data from contracts
  const { data: healthData } = useGasPoolHealth();
  const { data: breakdownData } = useGasPoolBreakdown();
  
  // Parse the data
  const poolBalance = healthData ? Number(formatEther(healthData[0])) : 0;
  const dailyIncome = healthData ? Number(formatEther(healthData[1])) : 0;
  const dailyPayouts = healthData ? Number(formatEther(healthData[2])) : 0;
  const dynamicLimit = healthData ? Number(formatEther(healthData[3])) : 0;
  const remainingPayouts = healthData ? Number(formatEther(healthData[4])) : 0;
  const healthy = healthData ? healthData[5] : false;
  const timeUntilReset = healthData ? Number(healthData[6]) : 0;
  
  // Breakdown data
  const incomeFromFees = breakdownData ? Number(formatEther(breakdownData[1])) : 0;
  const incomeFromPayments = breakdownData ? Number(formatEther(breakdownData[2])) : 0;
  const minPoolBalance = breakdownData ? Number(formatEther(breakdownData[6])) : 0.5;
  const maxSinglePayout = breakdownData ? Number(formatEther(breakdownData[7])) : 0.01;
  
  // Determine status
  const getStatus = () => {
    if (poolBalance <= minPoolBalance) return { status: 'EMERGENCY', color: 'red', icon: AlertCircle };
    if (dynamicLimit === 0 || remainingPayouts === 0) return { status: 'PAUSED', color: 'yellow', icon: Clock };
    if (healthy) return { status: 'ACTIVE', color: 'green', icon: CheckCircle };
    return { status: 'WARNING', color: 'yellow', icon: AlertCircle };
  };
  
  const { status, color, icon: StatusIcon } = getStatus();
  
  const getStatusMessage = () => {
    switch (status) {
      case 'ACTIVE': return "Gas lottery is active! 50% chance to get your gas refunded.";
      case 'PAUSED': return "Gas lottery paused - no income today. Make a trade to restart!";
      case 'EMERGENCY': return "Emergency mode - pool at minimum reserve. Lottery suspended.";
      case 'WARNING': return "Gas lottery running with limited capacity.";
      default: return "Checking gas pool status...";
    }
  };
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };
  
  return (
    <div className="text-center">
      <div className="text-6xl mb-6">⛽</div>
      <h2 className="text-4xl font-bold text-amber-100 mb-8">Gas Pool Dashboard</h2>
      
      {/* Status Header */}
      <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Fuel className="w-8 h-8 text-amber-300" />
            <h3 className="text-2xl font-bold text-amber-100">Pool Status</h3>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            color === 'green' ? 'bg-green-500/20 border border-green-500/30' :
            color === 'yellow' ? 'bg-yellow-500/20 border border-yellow-500/30' :
            'bg-red-500/20 border border-red-500/30'
          }`}>
            <StatusIcon className={`w-5 h-5 ${
              color === 'green' ? 'text-green-400' :
              color === 'yellow' ? 'text-yellow-400' :
              'text-red-400'
            }`} />
            <span className={`font-bold ${
              color === 'green' ? 'text-green-300' :
              color === 'yellow' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              {status}
            </span>
          </div>
        </div>
        
        {/* Status Message */}
        <div className={`p-4 rounded-lg mb-6 ${
          color === 'green' ? 'bg-green-500/10 border border-green-500/20' :
          color === 'yellow' ? 'bg-yellow-500/10 border border-yellow-500/20' :
          'bg-red-500/10 border border-red-500/20'
        }`}>
          <p className="text-amber-100">{getStatusMessage()}</p>
        </div>
      </div>
      
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Pool Balance */}
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3">
            <Fuel className="w-6 h-6 text-blue-400" />
            <span className="text-amber-200 font-medium text-lg">Pool Balance</span>
          </div>
          <div className="text-3xl font-bold text-blue-300 mb-2">{poolBalance.toFixed(3)} MATIC</div>
          <div className="text-sm text-amber-400">
            {poolBalance <= minPoolBalance ? 'Emergency Reserve' : 
             poolBalance >= 2 ? 'Excellent Level' : 
             poolBalance >= 1 ? 'Good Level' : 'Low Level'}
          </div>
        </div>
        
        {/* Daily Income */}
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <span className="text-amber-200 font-medium text-lg">Daily Income</span>
          </div>
          <div className="text-3xl font-bold text-green-300 mb-2">{dailyIncome.toFixed(3)} MATIC</div>
          <div className="text-sm text-amber-400">
            From DEX + Faucet/Casino fees
          </div>
        </div>
        
        {/* Daily Payouts */}
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-6 h-6 text-red-400" />
            <span className="text-amber-200 font-medium text-lg">Daily Payouts</span>
          </div>
          <div className="text-3xl font-bold text-red-300 mb-2">{dailyPayouts.toFixed(3)} MATIC</div>
          <div className="text-sm text-amber-400">
            Gas lottery winnings paid
          </div>
        </div>
      </div>
      
      {/* Progress Bars */}
      <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30 mb-6 space-y-6">
        <h3 className="text-xl font-bold text-amber-100 mb-4">Pool Health Metrics</h3>
        
        {/* Daily Limit Progress */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-amber-200 font-medium">Daily Payout Limit</span>
            <span className="text-amber-300 text-sm">
              {dailyPayouts.toFixed(2)}/{dynamicLimit.toFixed(2)} MATIC (60% of income)
            </span>
          </div>
          <div className="w-full bg-amber-900/50 rounded-full h-4 border border-amber-600/30">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${
                dynamicLimit === 0 ? 'bg-gray-500' :
                (dailyPayouts / dynamicLimit) > 0.8 ? 'bg-red-500' :
                (dailyPayouts / dynamicLimit) > 0.6 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ 
                width: dynamicLimit === 0 ? '0%' : `${Math.min((dailyPayouts / dynamicLimit) * 100, 100)}%` 
              }}
            />
          </div>
        </div>

        {/* Bowel Health */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-amber-200 font-medium">Bowel Health</span>
            <span className="text-amber-300 text-sm">
              {poolBalance >= 2 ? 'Excellent' : 
               poolBalance >= 1 ? 'Good' :
               poolBalance > minPoolBalance ? 'Low' : 'Emergency'}
            </span>
          </div>
          <div className="w-full bg-amber-900/50 rounded-full h-4 border border-amber-600/30">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${
                poolBalance >= 2 ? 'bg-green-500' :
                poolBalance >= 1 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min((poolBalance / 5) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Income Breakdown */}
      <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30 mb-6">
        <h3 className="text-xl font-bold text-amber-100 mb-4">Income Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-300">{incomeFromFees.toFixed(3)} MATIC</div>
            <div className="text-amber-300">Trading Fees (DEX)</div>
            <div className="text-sm text-amber-400">2.5% of all swaps</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-300">{incomeFromPayments.toFixed(3)} MATIC</div>
            <div className="text-amber-300">User Payments</div>
            <div className="text-sm text-amber-400">Faucet + Casino fees</div>
          </div>
        </div>
      </div>
      
      {/* System Info */}
      <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
        <h3 className="text-xl font-bold text-amber-100 mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-amber-200">
          <div className="text-center">
            <div className="text-lg font-bold text-amber-100">Lottery Settings</div>
            <div className="text-sm space-y-1">
              <div>Win Chance: 50%</div>
              <div>Max Payout: {maxSinglePayout.toFixed(3)} MATIC</div>
              <div>Pool Reserve: {minPoolBalance.toFixed(1)} MATIC</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-100">Daily Limits</div>
            <div className="text-sm space-y-1">
              <div>Payout Budget: 60% of income</div>
              <div>Remaining: {remainingPayouts.toFixed(3)} MATIC</div>
              <div>Reset: {timeUntilReset > 0 ? formatTime(timeUntilReset) : 'Ready'}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-100">Economics</div>
            <div className="text-sm space-y-1">
              <div>Net Income: +{(dailyIncome - dailyPayouts).toFixed(3)} MATIC</div>
              <div>Growth Rate: {dailyIncome > 0 ? ((dailyIncome - dailyPayouts) / dailyIncome * 100).toFixed(1) : 0}%</div>
              <div>Status: {dailyIncome > dailyPayouts ? '📈 Growing' : '📉 Declining'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}