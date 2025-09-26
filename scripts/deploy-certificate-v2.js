const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Enhanced CertificateContract deployment...");
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`🌐 Connected to network: ${network.name} Chain ID: ${network.chainId}`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deploying with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  try {
    console.log("📋 Getting contract factory...");
    
    // FIXED: Use the correct contract name
    const contractFactory = await ethers.getContractFactory("EnhancedCertificateContract");
    console.log("📋 Using contract: contracts/CertificateV2.sol:EnhancedCertificateContract");
    
    console.log("🚀 Deploying contract...");
    const contract = await contractFactory.deploy();
    
    console.log("⏳ Waiting for deployment confirmation...");
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log("✅ Contract deployed successfully!");
    console.log(`📍 Contract Address: ${contractAddress}`);
    
    // Verify deployment
    const deployedCode = await ethers.provider.getCode(contractAddress);
    console.log(`🔍 Contract code length: ${deployedCode.length} characters`);
    console.log(`✅ Deployment verified: ${deployedCode !== "0x"}`);
    
    // Load and verify artifact - FIXED: Use correct artifact path
    const artifactPath = path.join(
      __dirname,
      "../artifacts/contracts/CertificateV2.sol/EnhancedCertificateContract.json"
    );
    
    console.log("📁 Loading contract artifact...");
    
    if (!fs.existsSync(artifactPath)) {
      console.log("❌ DEPLOYMENT FAILED:");
      console.log(`Error message: Artifact not found at: ${artifactPath}`);
      console.log("Run 'npx hardhat compile' first.");
      console.log("📋 Solution: Run 'npx hardhat compile' first");
      return;
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    console.log(`📋 Contract name: ${artifact.contractName}`);
    console.log(`📋 Compiler version: ${artifact.metadata ? JSON.parse(artifact.metadata).compiler.version : 'Unknown'}`);
    
    // Test basic contract functionality
    console.log("🧪 Testing basic contract functions...");
    
    try {
      const owner = await contract.owner();
      console.log(`👤 Contract owner: ${owner}`);
      
      const stats = await contract.getContractStats();
      console.log(`📊 Contract stats - Total certs: ${stats[0]}, Total institutions: ${stats[1]}`);
      
      // Test institution info (owner should be registered as admin)
      const ownerInstitution = await contract.getInstitutionInfo(deployer.address);
      console.log(`🏢 Owner institution: ${ownerInstitution.name}`);
      
      console.log("✅ Contract functionality verified!");
      
    } catch (testError) {
      console.log("⚠️  Contract deployed but functionality test failed:");
      console.log(testError.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
      contractAddress: contractAddress,
      deployerAddress: deployer.address,
      networkName: network.name,
      chainId: network.chainId.toString(),
      deploymentTimestamp: new Date().toISOString(),
      contractName: "EnhancedCertificateContract",
      artifactPath: "contracts/CertificateV2.sol:EnhancedCertificateContract"
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save deployment info
    const deploymentFile = path.join(deploymentsDir, `enhanced-certificate-${network.name}-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📝 Deployment info saved to: ${deploymentFile}`);
    
    // Update contract config for frontend
    const contractConfigPath = path.join(__dirname, "../src/lib/contract-config.json");
    let contractConfig = {};
    
    try {
      if (fs.existsSync(contractConfigPath)) {
        contractConfig = JSON.parse(fs.readFileSync(contractConfigPath, "utf8"));
      }
    } catch (error) {
      console.log("⚠️  Could not read existing contract config, creating new one");
    }
    
    contractConfig.enhancedCertificate = {
      address: contractAddress,
      network: network.name,
      chainId: network.chainId.toString(),
      deployedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(contractConfigPath, JSON.stringify(contractConfig, null, 2));
    console.log(`📝 Contract config updated at: ${contractConfigPath}`);
    
    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`👤 Deployed by: ${deployer.address}`);
    console.log(`💰 Gas used: Check transaction details`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    console.log("\n📋 Next steps:");
    console.log("1. Update your frontend to use the new contract address");
    console.log("2. Register additional institutions if needed");
    console.log("3. Test certificate issuance and verification");
    
  } catch (error) {
    console.error("❌ DEPLOYMENT FAILED:");
    console.error("Error message:", error.message);
    
    if (error.code === "INSUFFICIENT_FUNDS") {
      console.log("💡 Solution: Add more ETH to your deployer account");
    } else if (error.code === "NETWORK_ERROR") {
      console.log("💡 Solution: Check your network connection and RPC endpoint");
    } else if (error.message.includes("revert")) {
      console.log("💡 Solution: Check contract constructor requirements");
    } else {
      console.log("💡 Solution: Check the error details above and contract code");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });