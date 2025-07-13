const { ethers } = require("hardhat");

async function main() {
  console.log("🎰 Deploying NEW PoopCasino...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  // Your existing ShitCoin address
  const SHITCOIN_ADDRESS = "0x1deF503C01703CC997F4493Ff59a74314e1A347C";
  
  // Deploy new casino
  const PoopCasino = await ethers.getContractFactory("PoopCasino");
  const newCasino = await PoopCasino.deploy(SHITCOIN_ADDRESS);
  await newCasino.deployed();
  
  console.log("✅ NEW PoopCasino deployed to:", newCasino.address);
  
  // Save the address
  console.log("\n🔧 Next steps:");
  console.log("1. Update .env.local with:");
  console.log(`NEXT_PUBLIC_CASINO_ADDRESS=${newCasino.address}`);
  console.log("\n2. Set casino address in ShitCoin:");
  console.log(`shitCoin.setCasinoContract("${newCasino.address}")`);
}

main().catch(console.error);