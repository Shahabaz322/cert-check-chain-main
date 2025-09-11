import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  try {
    console.log("🚀 Deploying CertificateContract...");
    
    // Deploy the contract
    const CertificateContract = await ethers.getContractFactory("CertificateContract");
    const certificate = await CertificateContract.deploy();
    
    // Wait for deployment to complete
    await certificate.waitForDeployment();
    
    // Get contract address
    const contractAddress = await certificate.getAddress();
    
    console.log("✅ CertificateContract deployed successfully!");
    console.log("📍 Contract Address:", contractAddress);
    
    // Verify address is valid
    if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Invalid contract address received");
    }
    
    // Get ABI from artifacts - fix path resolution
    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CertificateContract.sol", "CertificateContract.json");
    
    // Check if artifact file exists
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact file not found at: ${artifactPath}`);
    }
    
    console.log("📁 Reading artifact from:", artifactPath);
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    // Verify ABI exists
    if (!artifact.abi) {
      throw new Error("ABI not found in artifact");
    }
    
    console.log("📋 ABI loaded successfully, methods count:", artifact.abi.length);
    
    // Ensure frontend directory exists
    const frontendDir = path.join(__dirname, "..", "src", "lib");
    if (!fs.existsSync(frontendDir)) {
      console.log("📁 Creating frontend directory:", frontendDir);
      fs.mkdirSync(frontendDir, { recursive: true });
    }
    
    // Save ABI + address for frontend
    const configPath = path.join(frontendDir, "contract-config.json");
    const contractConfig = {
      address: contractAddress,
      abi: artifact.abi,
      deploymentTimestamp: new Date().toISOString(),
      network: (await ethers.provider.getNetwork()).name
    };
    
    fs.writeFileSync(
      configPath,
      JSON.stringify(contractConfig, null, 2)
    );
    
    console.log("\n🔧 Contract config saved to:", configPath);
    console.log("📄 Config contents preview:");
    console.log(`   - Address: ${contractConfig.address}`);
    console.log(`   - ABI methods: ${contractConfig.abi.length}`);
    console.log(`   - Network: ${contractConfig.network}`);
    
    // Verify the file was written correctly
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (savedConfig.address === contractAddress && savedConfig.abi) {
        console.log("✅ Configuration file verified successfully!");
      } else {
        throw new Error("Configuration file verification failed");
      }
    } else {
      throw new Error("Configuration file was not created");
    }
    
  } catch (error) {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
main().catch((error) => {
  console.error("❌ Unhandled error:");
  console.error(error);
  process.exit(1);
});