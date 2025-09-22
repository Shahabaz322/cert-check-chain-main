const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("🚀 Starting CertificateContract deployment...");
    
    // Check network
    const network = await hre.ethers.provider.getNetwork();
    console.log("🌐 Connected to network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Get signers
    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deploying with account:", deployer.address);
    
    // Get balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
    
    // FIXED: Use the correct fully qualified name based on the diagnostics
    console.log("\n📋 Getting contract factory...");
    console.log("📋 Using contract: contracts/CertificateV2.sol:CertificateContract");
    const CertificateContract = await hre.ethers.getContractFactory("contracts/CertificateV2.sol:CertificateContract");

    
    console.log("🚀 Deploying contract...");
    const certificateContract = await CertificateContract.deploy();

    console.log("⏳ Waiting for deployment confirmation...");
    await certificateContract.waitForDeployment();
    
    // Get contract address (ethers v6 compatible)
    const contractAddress = await certificateContract.getAddress();
    console.log("✅ Contract deployed successfully!");
    console.log("📍 Contract Address:", contractAddress);
    
    // Verify deployment
    const deployedCode = await hre.ethers.provider.getCode(contractAddress);
    console.log("🔍 Contract code length:", deployedCode.length, "characters");
    console.log("✅ Deployment verified:", deployedCode !== "0x");
    
    // Load artifact - FIXED: Use correct path and filename
    console.log("\n📁 Loading contract artifact...");
    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CertificateV2.sol", "CertificateContract.json");

    
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact not found at: ${artifactPath}\nRun 'npx hardhat compile' first.`);
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    console.log("📋 Contract name:", artifact.contractName);
    console.log("📋 ABI functions:", artifact.abi.length);
    
    // Create output directory
    console.log("\n📁 Preparing output directory...");
    const outputDir = path.join(__dirname, "..", "src", "lib");
    
    if (!fs.existsSync(outputDir)) {
      console.log("📁 Creating directory:", outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Test basic contract functionality
    console.log("\n🧪 Testing contract functionality...");
    try {
      const owner = await certificateContract.owner();
      const totalCertificates = await certificateContract.getTotalCertificates();
      const nextId = await certificateContract.nextCertificateId();
      
      console.log("✅ Contract owner:", owner);
      console.log("✅ Total certificates:", totalCertificates.toString());
      console.log("✅ Next certificate ID:", nextId.toString());
    } catch (testError) {
      console.log("⚠️  Warning: Could not test contract functions:", testError.message);
    }
    
    // Prepare contract configuration
    const contractConfig = {
      address: contractAddress,
      abi: artifact.abi,
      contractName: "CertificateContract",
      sourceName: artifact.sourceName,
      deploymentInfo: {
        deployer: deployer.address,
        network: network.name,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber()
      }
    };
    
    // Save configuration
    const configPath = path.join(outputDir, "contract-config.json");
    fs.writeFileSync(configPath, JSON.stringify(contractConfig, null, 2));
    
    console.log("💾 Configuration saved to:", configPath);
    
    // Verify saved file
    if (fs.existsSync(configPath)) {
      const fileSize = fs.statSync(configPath).size;
      const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      
      console.log("✅ File verification:");
      console.log("   📊 File size:", fileSize, "bytes");
      console.log("   📍 Saved address:", savedConfig.address);
      console.log("   📋 Saved ABI functions:", savedConfig.abi.length);
      console.log("   🌐 Saved network:", savedConfig.deploymentInfo.network);
    }
    
    console.log("\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("📍 Contract Address:", contractAddress);
    console.log("📁 Config File:", configPath);
    console.log("🌐 Network:", network.name);
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error("Error message:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.error("💰 Solution: Fund your account with test ETH");
    } else if (error.message.includes("network")) {
      console.error("🌐 Solution: Check your network configuration");
    } else if (error.message.includes("compile")) {
      console.error("📋 Solution: Run 'npx hardhat compile' first");
    } else if (error.message.includes("Artifact")) {
      console.error("📋 Solutions:");
      console.error("1. The contract name inside CertificateV2.sol should match what you're trying to deploy");
      console.error("2. Run 'npx hardhat clean' then 'npx hardhat compile'");
      console.error("3. Check the contract name inside the .sol file");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });