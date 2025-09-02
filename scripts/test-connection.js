// scripts/test-connection.js
const hre = require("hardhat");

async function main() {
  console.log("Testing connection to Ganache...");
  
  try {
    // Test basic connection
    const provider = hre.ethers.provider;
    console.log("Provider created successfully");
    
    // Get network info
    const network = await provider.getNetwork();
    console.log("Connected to network:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    
    // Get latest block number
    const blockNumber = await provider.getBlockNumber();
    console.log("Latest block number:", blockNumber);
    
    // Get accounts
    const accounts = await hre.ethers.getSigners();
    console.log("Available accounts:", accounts.length);
    console.log("First account:", accounts[0].address);
    
    // Get balance
    const balance = await provider.getBalance(accounts[0].address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
    
    console.log("✅ Connection test successful!");
    
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.log("\nTroubleshooting steps:");
    console.log("1. Make sure Ganache is running on http://127.0.0.1:7545");
    console.log("2. Check that the private key in hardhat.config.ts matches a Ganache account");
    console.log("3. Verify the chainId is 1337 in Ganache settings");
  }
}

main().catch(console.error);