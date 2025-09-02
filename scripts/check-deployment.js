// scripts/check-deployment.js
const hre = require("hardhat");

async function main() {
  console.log("Checking recent transactions...");
  
  // Get the latest block
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  console.log("Latest block:", latestBlock.number);
  
  // Check recent transactions
  for (let i = 0; i < latestBlock.transactions.length; i++) {
    const txHash = latestBlock.transactions[i];
    const tx = await hre.ethers.provider.getTransaction(txHash);
    const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
    
    if (receipt && receipt.contractAddress) {
      console.log("Contract deployed!");
      console.log("Contract Address:", receipt.contractAddress);
      console.log("Transaction Hash:", txHash);
      console.log("Deployed at block:", receipt.blockNumber);
      
      // Try to get the contract code to verify it's deployed
      const code = await hre.ethers.provider.getCode(receipt.contractAddress);
      console.log("Contract deployed successfully:", code !== "0x");
    }
  }
}

main().catch(console.error);