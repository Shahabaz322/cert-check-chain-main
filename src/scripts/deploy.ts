// scripts/deploy.ts
import hre from "hardhat";

async function main() {
  // Type assertion to access ethers
  const ethers = (hre as any).ethers;
  
  // Get the contract factory
  const ContractFactory = await ethers.getContractFactory("Counter");
  
  // Deploy the contract
  console.log("Deploying contract...");
  const contract = await ContractFactory.deploy(/* constructor arguments */);
  
  // Wait for deployment
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log("Contract deployed to:", contractAddress);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
  
  // Get account that deployed
  const [deployer] = await ethers.getSigners();
  console.log("Deployed by:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during deployment:", error);
    process.exit(1);
  });