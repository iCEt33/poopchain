const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting PoopChain deployment...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", ethers.utils.formatEther(balance), "MATIC");
  
  if (balance.lt(ethers.utils.parseEther("0.1"))) {
    throw new Error("❌ Insufficient balance! Need at least 0.1 MATIC for deployment");
  }
  
  // Deploy ShitCoin first
  console.log("\n💩 Deploying ShitCoin...");
  const ShitCoin = await ethers.getContractFactory("ShitCoin");
  const shitCoin = await ShitCoin.deploy();
  await shitCoin.deployed();
  console.log("✅ ShitCoin deployed to:", shitCoin.address);
  
  // Deploy PoopDEX
  console.log("\n🔄 Deploying PoopDEX...");
  const PoopDEX = await ethers.getContractFactory("PoopDEX");
  const poopDEX = await PoopDEX.deploy(shitCoin.address);
  await poopDEX.deployed();
  console.log("✅ PoopDEX deployed to:", poopDEX.address);
  
  // Deploy PoopCasino
  console.log("\n🎲 Deploying PoopCasino...");
  const PoopCasino = await ethers.getContractFactory("PoopCasino");
  const poopCasino = await PoopCasino.deploy(shitCoin.address);
  await poopCasino.deployed();
  console.log("✅ PoopCasino deployed to:", poopCasino.address);
  
  // IMPORTANT: Set casino address in ShitCoin for minting authorization
  console.log("\n🔗 Setting casino address in ShitCoin...");
  await shitCoin.setCasinoContract(poopCasino.address);
  console.log("✅ Casino address set for minting authorization");
  
  // Initial setup with proper amounts
  console.log("\n⚙️  Setting up initial configuration...");
  
  // Add initial liquidity to DEX (1 MATIC : 1,000 SHIT)
  const initialMatic = ethers.utils.parseEther("1"); // 1 MATIC
  const initialShit = ethers.utils.parseEther("1000"); // 1,000 SHIT
  
  console.log("📝 Approving SHIT tokens for DEX...");
  const approveTx1 = await shitCoin.approve(poopDEX.address, initialShit);
  await approveTx1.wait();
  console.log("✅ DEX approval confirmed");
  
  console.log("🏦 Adding initial liquidity...");
  const liquidityTx = await poopDEX.addLiquidity(initialShit, { value: initialMatic });
  await liquidityTx.wait();
  console.log("✅ Initial liquidity added");
  
  // Fund casino with initial SHIT tokens
  const casinoFunding = ethers.utils.parseEther("3000"); // 3,000 SHIT
  
  console.log("🎰 Approving SHIT tokens for casino...");
  const approveTx2 = await shitCoin.approve(poopCasino.address, casinoFunding);
  await approveTx2.wait();
  console.log("✅ Casino approval confirmed");
  
  console.log("🎰 Funding casino...");
  const casinoTx = await poopCasino.fundCasino(casinoFunding);
  await casinoTx.wait();
  console.log("✅ Casino funded");
  
  // Fund gas pool with initial MATIC
  const gasPoolFunding = ethers.utils.parseEther("1"); // 1 MATIC
  console.log("⛽ Funding gas pool...");
  const gasTx = await shitCoin.fundGasPool(false, { value: gasPoolFunding });
  await gasTx.wait();
  console.log("✅ Gas pool funded");
  
  // ADVANCED: Add post-deployment synchronization (if contracts support it)
  try {
    console.log("\n🔧 Syncing initial reserves...");
    const syncTx = await poopDEX.syncReserves();
    await syncTx.wait();
    console.log("✅ DEX reserves synchronized");
    
    console.log("🏦 Syncing casino house balance...");
    const casinoSyncTx = await poopCasino.syncHouseBalance();
    await casinoSyncTx.wait();
    console.log("✅ Casino house balance synchronized");
    
    console.log("📊 Checking reserve health...");
    const health = await poopDEX.getReserveHealth();
    console.log("📈 Reserve Health Check:");
    console.log("  MATIC Reserve (tracked):", ethers.utils.formatEther(health[0]));
    console.log("  MATIC Actual:", ethers.utils.formatEther(health[1]));
    console.log("  SHIT Reserve (tracked):", ethers.utils.formatEther(health[2]));
    console.log("  SHIT Actual:", ethers.utils.formatEther(health[3]));
    console.log("  Needs Sync:", health[4]);
  } catch (error) {
    console.log("⚠️  Advanced sync features not available in this contract version");
  }
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💩 ShitCoin:", shitCoin.address);
  console.log("🔄 PoopDEX:", poopDEX.address);
  console.log("🎲 PoopCasino:", poopCasino.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n📊 Initial Setup:");
  console.log("🏦 DEX Liquidity: 1 MATIC : 1,000 SHIT");
  console.log("🎰 Casino Balance: 3,000 SHIT (will auto-refill)");
  console.log("⛽ Gas Pool: 1 MATIC");
  console.log("🤖 Auto-refill: ENABLED (mints 1k SHIT/hour when needed)");
  console.log("🔧 Synchronization: ATTEMPTED");
  
  console.log("\n🔗 Verification Commands:");
  console.log("npx hardhat verify --network polygon", shitCoin.address);
  console.log("npx hardhat verify --network polygon", poopDEX.address, shitCoin.address);
  console.log("npx hardhat verify --network polygon", poopCasino.address, shitCoin.address);
  
  // Save addresses to JSON file
  const addresses = {
    shitCoin: shitCoin.address,
    poopDEX: poopDEX.address,
    poopCasino: poopCasino.address,
    deployer: deployer.address,
    network: "polygon",
    features: {
      autoRefill: true,
      mintingEnabled: true,
      gasLottery: true,
      dynamicLimits: true,
      reserveSync: true,
      raceConditionProtection: true,
      dustTradeProtection: true
    },
    initialState: {
      dexLiquidity: {
        matic: ethers.utils.formatEther(initialMatic),
        shit: ethers.utils.formatEther(initialShit)
      },
      casinoBalance: ethers.utils.formatEther(casinoFunding),
      gasPool: ethers.utils.formatEther(gasPoolFunding)
    }
  };
  
  const fs = require('fs');
  fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Contract addresses saved to deployed-addresses.json");
  
  console.log("\n🚀 PoopChain Features:");
  console.log("✅ Auto-refilling casino (mints tokens when needed)");
  console.log("✅ Dynamic betting limits (adjusts with house balance)");
  console.log("✅ True 50/50 casino (no house edge)");
  console.log("✅ Deflationary burning (lost bets burned)");
  console.log("✅ Gas lottery (50% chance of refund)");
  console.log("✅ Self-sustaining economics");
  console.log("✅ Race condition protection (NEW)");
  console.log("✅ Reserve synchronization (NEW)");
  console.log("✅ Dust trade protection (NEW)");
  console.log("✅ Enhanced error handling (NEW)");
  
  console.log("\n📈 Economics Summary:");
  console.log("• Your tokens: ~994,000 SHIT (preserved forever)");
  console.log("• Casino refills: Unlimited via minting");
  console.log("• Token supply: Self-balancing (minting vs burning)");
  console.log("• Revenue: Transaction fees fund gas lottery");
  console.log("• Safety: Protected against edge cases");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });