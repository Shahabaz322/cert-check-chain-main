// scripts/deploy-simple.js
const hre = require("hardhat");

async function main() {
  console.log("=== Starting deployment ===");
  
  try {
    console.log("Getting contract factory...");
    const Counter = await hre.ethers.getContractFactory("Counter");
    console.log("Contract factory obtained successfully");
    
    console.log("Deploying contract...");
    const counter = await Counter.deploy();
    console.log("Deployment transaction sent");
    
    console.log("Waiting for deployment confirmation...");
    await counter.waitForDeployment();
    console.log("Deployment confirmed!");
    
    const address = await counter.getAddress();
    console.log("\n=== DEPLOYMENT SUCCESS ===");
    console.log("Contract Address:", address);
    console.log("Transaction Hash:", counter.deploymentTransaction()?.hash);
    
    // Get deployer info
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployed by:", deployer.address);
    
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
    
    console.log("=== DEPLOYMENT COMPLETE ===\n");
    
    // Save the address for easy reference
    console.log("COPY THIS ADDRESS FOR YOUR WEB3.TS FILE:");
    console.log(address);
    
  } catch (error) {
    console.error("Deployment failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });