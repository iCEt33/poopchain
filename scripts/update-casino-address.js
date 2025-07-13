const { ethers } = require("hardhat");

async function main() {
  const SHITCOIN_ADDRESS = "0x1deF503C01703CC997F4493Ff59a74314e1A347C";
  const NEW_CASINO_ADDRESS = "0xE8632693D152d17F81FCFf915B806159b3489b21";  
  
  const [deployer] = await ethers.getSigners();
  
  // Connect to ShitCoin
  const ShitCoin = await ethers.getContractFactory("ShitCoin");
  const shitCoin = ShitCoin.attach(SHITCOIN_ADDRESS);
  
  console.log("🔧 Setting new casino address in ShitCoin...");
  const tx = await shitCoin.setCasinoContract(NEW_CASINO_ADDRESS);
  await tx.wait();
  
  console.log("✅ Casino address updated!");
  console.log("🎰 New casino can now mint tokens");
}

main().catch(console.error);