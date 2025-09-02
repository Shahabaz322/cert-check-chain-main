// scripts/deploy.ts

import { ethers } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Get the contract factory
  const ContractFactory = await ethers.getContractFactory("Counter");
  
  // Deploy the contract
  console.log("Deploying Counter contract...");
  const contract = await ContractFactory.deploy(/* constructor arguments if any */);
  
  // Wait for deployment
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log("Contract deployed to:", contractAddress);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
  
  // Final account balance
  console.log("Final account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });