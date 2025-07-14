// components/LeaderboardTab.tsx - Using Covalent API
import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Medal, Award, TrendingUp, Flame, RefreshCw } from 'lucide-react';

interface CovalentHolder {
  address: string;
  balance: string;
  balance_quote: number;
}

interface LeaderboardEntry {
  address: string;
  balance: string;
  percentage: number;
  rank: number;
  displayName?: string;
  isWhale?: boolean;
}

const EXCLUDED_ADDRESSES = [
  '0x98645a85C21F6C319f572C1B073248e9EB348A3f', // Deployer
  '0xe7BaF820910CF4A8FC049cf180E6D691CB4054FB', // DEX
  '0xE8632693D152d17F81FCFf915B806159b3489b21', // Casino
].map(addr => addr.toLowerCase());

const BURN_ADDRESSES = [
  '0x5434946A92e95AD75b1b18A9de23D947eBc7BD27',
  '0x000000000000000000000000000000000000dEaD'
].map(addr => addr.toLowerCase());

export default function LeaderboardTab() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalSupply, setTotalSupply] = useState<string>('0');
  const [totalHolders, setTotalHolders] = useState<number>(0);
  const [burntTokens, setBurntTokens] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const SHITCOIN_ADDRESS = process.env.NEXT_PUBLIC_SHITCOIN_ADDRESS!;
  const COVALENT_API_KEY = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY || 'cqt_rQ7tqp7cmwV6HTD7cFqKKJ9JTwvx';

  const fetchFromCovalent = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔍 Fetching holders from Covalent API...');

      // Covalent API endpoint for token holders
      const holdersUrl = `https://api.covalenthq.com/v1/137/tokens/${SHITCOIN_ADDRESS}/token_holders/?quote-currency=USD&format=JSON&page-size=100&key=${COVALENT_API_KEY}`;
      
      const response = await fetch(holdersUrl);
      const data = await response.json();

      console.log('📊 Covalent Response:', data);

      if (data.error) {
        throw new Error(`Covalent API error: ${data.error_message}`);
      }

      if (data.data && data.data.items) {
        console.log('✅ Got holders data:', data.data.items.length, 'holders');
        processCovalentData(data.data.items, data.data.total_supply || '0');
      } else {
        throw new Error('No holder data in response');
      }

    } catch (apiError) {
      console.error('❌ Covalent API failed:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error occurred';
      setError(`Failed to load from Covalent API: ${errorMessage}`);
      setLoading(false);
    }
  };

  const processCovalentData = (holders: CovalentHolder[], totalSupplyFromAPI: string) => {
    console.log('🔄 Processing Covalent data...');

    // Calculate total supply by summing ALL holder balances (including burns and contracts)
    const calculatedTotalSupply = holders.reduce((total, holder) => {
      return total + (Number(holder.balance) / 1e18);
    }, 0);
    
    setTotalSupply(calculatedTotalSupply.toFixed(0));

    // Calculate burnt tokens from burn addresses
    const burntAmount = holders
      .filter(holder => BURN_ADDRESSES.includes(holder.address.toLowerCase()))
      .reduce((acc, holder) => {
        return acc + (Number(holder.balance) / 1e18);
      }, 0);
    
    setBurntTokens(burntAmount.toFixed(0));

    // Filter out excluded addresses for the leaderboard display
    const filteredHolders = holders.filter(holder => 
      !EXCLUDED_ADDRESSES.includes(holder.address.toLowerCase()) &&
      !BURN_ADDRESSES.includes(holder.address.toLowerCase())
    );

    // Set actual holder count (excluding system addresses and burns)
    setTotalHolders(filteredHolders.length);

    // Sort by balance (Covalent usually returns sorted data, but ensuring)
    filteredHolders.sort((a, b) => {
      const balanceA = Number(a.balance);
      const balanceB = Number(b.balance);
      return balanceB - balanceA;
    });

    // Create leaderboard entries with proper percentage calculation
    const leaderboardData: LeaderboardEntry[] = filteredHolders.map((holder, index) => {
      const balanceInTokens = Number(holder.balance) / 1e18;
      return {
        address: holder.address.toLowerCase(),
        balance: balanceInTokens.toFixed(0),
        percentage: (balanceInTokens / calculatedTotalSupply) * 100, // Use calculated total supply
        rank: index + 1,
        displayName: getDisplayName(holder.address),
        isWhale: balanceInTokens >= 10000
      };
    });

    setLeaderboard(leaderboardData);
    setLastUpdate(new Date());
    setLoading(false);

    console.log('✅ Leaderboard processed:', leaderboardData.length, 'entries');
    console.log('📊 Total Supply (calculated):', calculatedTotalSupply.toFixed(0));
    console.log('🔥 Burnt Tokens:', burntAmount.toFixed(0));
    console.log('👥 Actual Holders:', filteredHolders.length);
  };

  const getDisplayName = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-8 h-8 text-yellow-400" />;
      case 2: return <Medal className="w-8 h-8 text-gray-400" />;
      case 3: return <Award className="w-8 h-8 text-amber-600" />;
      default: return <span className="w-8 h-8 flex items-center justify-center text-amber-300 font-bold text-lg">#{rank}</span>;
    }
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 10) return 'text-red-400 font-bold';
    if (percentage >= 5) return 'text-orange-400';
    if (percentage >= 1) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getWhaleEmoji = (balance: number) => {
    if (balance >= 100000) return '🐳';
    if (balance >= 50000) return '🐋';
    if (balance >= 20000) return '🦈';
    if (balance >= 10000) return '🐬';
    if (balance >= 5000) return '🐟';
    return '🦐';
  };

  const openInPolygonScan = (address: string) => {
    window.open(`https://polygonscan.com/address/${address}`, '_blank');
  };

  useEffect(() => {
    fetchFromCovalent();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchFromCovalent, 600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-4xl font-bold text-amber-100 mb-4">SHIT Holders Leaderboard</h2>
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <p className="text-xl text-amber-200">Loading from Covalent API...</p>
        </div>
        <p className="text-amber-400 text-sm mt-2">Getting all token holders automatically...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-6">❌</div>
        <h2 className="text-4xl font-bold text-amber-100 mb-4">Error</h2>
        <p className="text-xl text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchFromCovalent}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold"
        >
          Try Again
        </button>
        <div className="mt-4 text-amber-400 text-sm">
          <p>💡 Tip: Get a free Covalent API key from <a href="https://www.covalenthq.com/" target="_blank" className="underline">covalenthq.com</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🏆</div>
      <h2 className="text-4xl font-bold text-amber-100 mb-8">SHIT Holders Leaderboard</h2>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <TrendingUp className="w-6 h-6 text-green-400" />
            <span className="text-amber-200 font-medium text-lg">Total Supply</span>
          </div>
          <div className="text-3xl font-bold text-green-300">{Number(totalSupply).toLocaleString()}</div>
          <div className="text-sm text-amber-400">SHIT Tokens</div>
        </div>
        
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <Flame className="w-6 h-6 text-red-400" />
            <span className="text-amber-200 font-medium text-lg">Burnt Tokens</span>
          </div>
          <div className="text-3xl font-bold text-red-300">{Number(burntTokens).toLocaleString()}</div>
          <div className="text-sm text-amber-400">Forever Gone 🔥</div>
        </div>
        
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span className="text-amber-200 font-medium text-lg">Total Holders</span>
          </div>
          <div className="text-3xl font-bold text-yellow-300">{totalHolders.toLocaleString()}</div>
          <div className="text-sm text-amber-400">All Addresses</div>
        </div>

        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <div className="flex items-center gap-2 mb-3 justify-center">
            <RefreshCw className="w-6 h-6 text-blue-400" />
            <span className="text-amber-200 font-medium text-lg">Last Update</span>
          </div>
          <div className="text-lg font-bold text-blue-300">
            {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
          </div>
          <div className="text-sm text-amber-400">Via Covalent API</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-amber-900/30 rounded-xl border border-amber-600/30 overflow-hidden">
        <div className="p-6 border-b border-amber-600/30">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-amber-100 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Top SHIT Holders
            </h3>
            <div className="flex items-center gap-4">
              <span className="text-amber-400 text-sm">
                🔗 Powered by Covalent
              </span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-amber-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-amber-200 font-bold">Rank</th>
                <th className="px-6 py-4 text-left text-amber-200 font-bold">Address</th>
                <th className="px-6 py-4 text-right text-amber-200 font-bold">Balance</th>
                <th className="px-6 py-4 text-right text-amber-200 font-bold">% of Supply</th>
                <th className="px-6 py-4 text-center text-amber-200 font-bold">Type</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 50).map((entry, index) => (
                <tr 
                  key={entry.address}
                  className={`border-b border-amber-600/20 hover:bg-amber-900/20 transition-colors ${
                    index < 3 ? 'bg-amber-900/10' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getRankIcon(entry.rank)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-amber-100 font-mono text-sm">
                        {entry.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-amber-100 font-bold text-lg">
                      {Number(entry.balance).toLocaleString()}
                    </span>
                    <span className="text-amber-400 text-sm ml-1">SHIT</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-lg ${getPercentageColor(entry.percentage)}`}>
                      {entry.percentage.toFixed(4)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-2xl" title={entry.isWhale ? 'Whale' : 'Regular holder'}>
                      {getWhaleEmoji(Number(entry.balance))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {leaderboard.length === 0 && (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🤷‍♂️</div>
            <p className="text-amber-300 text-lg">No holder data available</p>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="mt-6 text-center">
        <p className="text-amber-400 text-sm">
          🔗 Data from Covalent API • 🚫 System addresses excluded • 🔥 Burn addresses tracked separately
        </p>
        <p className="text-amber-500 text-xs mt-1">
          Updates every 10 minutes • Live blockchain data • Shows all token holders automatically
        </p>
      </div>
    </div>
  );
}