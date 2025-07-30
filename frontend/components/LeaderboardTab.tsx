// components/LeaderboardTab.tsx - FIXED VERSION with proper burn address handling
import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Medal, Award, TrendingUp, Flame, RefreshCw } from 'lucide-react';

interface MoralisHolder {
  owner_address: string;
  balance: string;
  balance_formatted: string;
  percentage_relative_to_total_supply: number;
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
  const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY!;

  // Function to get token balance using a different endpoint
  const getTokenBalance = async (address: string) => {
    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/${address}/erc20?chain=polygon&token_addresses=${SHITCOIN_ADDRESS}`,
        {
          headers: {
            'X-API-Key': MORALIS_API_KEY,
            'accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`💰 Balance for ${address}:`, data);
        
        // Extract balance from the data structure and format it
        if (data && data.length > 0 && data[0].balance) {
          const rawBalance = data[0].balance;
          const formattedBalance = parseFloat(rawBalance) / Math.pow(10, 18);
          console.log(`💰 Formatted balance for ${address}: ${formattedBalance} (raw: ${rawBalance})`);
          return formattedBalance;
        }
        
        return null;
      }
    } catch (err) {
      console.error(`❌ Failed to get balance for ${address}:`, err);
    }
    return null;
  };

  const fetchFromMoralis = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('🔍 Fetching holders from Moralis...');

      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/erc20/${SHITCOIN_ADDRESS}/owners?chain=polygon&limit=100&order=DESC`,
        {
          headers: {
            'X-API-Key': MORALIS_API_KEY,
            'accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Got', data.result?.length || 0, 'holders');

      // Get dead wallet balance specifically
      const deadWalletData = await getTokenBalance('0x000000000000000000000000000000000000dEaD');

      if (data.result && Array.isArray(data.result)) {
        processData(data.result, deadWalletData);
      } else {
        throw new Error('No data returned from API');
      }

    } catch (err) {
      console.error('❌ Failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const processData = (holders: MoralisHolder[], deadWalletData: any) => {
    console.log('🔄 Processing data:', holders);
    console.log('✅ Using ALL holders:', holders.length);

    // Calculate total supply from ALL holders
    const totalSupply = holders.reduce((sum, holder) => {
      return sum + parseFloat(holder.balance_formatted);
    }, 0);
    setTotalSupply(totalSupply.toFixed(0));

    // Calculate burnt tokens from regular API response
    let totalBurnt = holders
      .filter(h => BURN_ADDRESSES.includes(h.owner_address.toLowerCase()))
      .reduce((sum, h) => sum + parseFloat(h.balance_formatted), 0);

    console.log('🔥 Burnt from regular API:', totalBurnt);

    // Add dead wallet balance specifically
    if (deadWalletData && deadWalletData > 0) {
      console.log(`💰 Dead wallet balance: ${deadWalletData}`);
      console.log('🔥 Adding dead wallet balance to burnt total');
      totalBurnt += deadWalletData;
    } else {
      console.log('❌ No dead wallet balance found');
    }

    console.log('🔥 Total burnt tokens:', totalBurnt);
    setBurntTokens(totalBurnt.toFixed(0));

    // NOW filter out system addresses for the leaderboard (excluding burn addresses)
    const filtered = holders.filter(h => 
      !EXCLUDED_ADDRESSES.includes(h.owner_address.toLowerCase()) &&
      !BURN_ADDRESSES.includes(h.owner_address.toLowerCase())
    );

    setTotalHolders(filtered.length);

    // Sort by balance
    filtered.sort((a, b) => parseFloat(b.balance_formatted) - parseFloat(a.balance_formatted));

    // Create leaderboard (excluding burn addresses)
    const leaderboard: LeaderboardEntry[] = filtered.map((holder, index) => {
      const balance = parseFloat(holder.balance_formatted);
      return {
        address: holder.owner_address.toLowerCase(),
        balance: balance.toFixed(0),
        percentage: holder.percentage_relative_to_total_supply,
        rank: index + 1,
        displayName: `${holder.owner_address.slice(0, 6)}...${holder.owner_address.slice(-4)}`,
        isWhale: balance >= 10000
      };
    });

    setLeaderboard(leaderboard);
    setLastUpdate(new Date());
    setLoading(false);

    console.log('✅ Processed', leaderboard.length, 'holders for leaderboard');
    console.log('📊 Total supply:', totalSupply.toFixed(0));
    console.log('🔥 Burnt tokens:', totalBurnt.toFixed(0));
    console.log('👥 Active holders:', filtered.length);
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

  useEffect(() => {
    fetchFromMoralis();
    // Auto-refresh every 10 minutes - COMMENTED OUT
    // const interval = setInterval(fetchFromMoralis, 600000); // 10 minutes
    // return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-4xl font-bold text-amber-100 mb-4">SHIT Holders Leaderboard</h2>
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <p className="text-xl text-amber-200">Loading from Moralis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-6">❌</div>
        <h2 className="text-4xl font-bold text-amber-100 mb-4">API Error</h2>
        <p className="text-xl text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchFromMoralis}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-6xl mb-6">🏆</div>
      <h2 className="text-4xl font-bold text-amber-100 mb-8">SHIT Holders Leaderboard</h2>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-300">{Number(totalSupply).toLocaleString()}</div>
          <div className="text-amber-400">Total Supply</div>
        </div>
        
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <Flame className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-red-300">{Number(burntTokens).toLocaleString()}</div>
          <div className="text-amber-400">Burnt</div>
        </div>
        
        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-yellow-300">{totalHolders}</div>
          <div className="text-amber-400">Holders</div>
        </div>

        <div className="bg-amber-900/30 rounded-xl p-6 border border-amber-600/30">
          <RefreshCw className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <div className="text-lg font-bold text-blue-300">
            {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
          </div>
          <div className="text-amber-400">Last Update</div>
        </div>
      </div>



      {/* Leaderboard */}
      <div className="bg-amber-900/30 rounded-xl border border-amber-600/30 overflow-hidden">
        <div className="p-6 border-b border-amber-600/30">
          <h3 className="text-2xl font-bold text-amber-100 flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Top SHIT Holders
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-amber-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-amber-200 font-bold">Rank</th>
                <th className="px-6 py-4 text-left text-amber-200 font-bold">Address</th>
                <th className="px-6 py-4 text-right text-amber-200 font-bold">Balance</th>
                <th className="px-6 py-4 text-right text-amber-200 font-bold">%</th>
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
                    {getRankIcon(entry.rank)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-amber-100 font-mono text-sm">
                      {entry.displayName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-amber-100 font-bold">
                      {Number(entry.balance).toLocaleString()}
                    </span>
                    <span className="text-amber-400 text-sm ml-1">SHIT</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold ${getPercentageColor(entry.percentage)}`}>
                      {entry.percentage.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-2xl">
                      {getWhaleEmoji(Number(entry.balance))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-amber-400 text-sm">
        🔗 Powered by Moralis • Updates every 10 minutes • {totalHolders} holders found
      </div>
    </div>
  );
}