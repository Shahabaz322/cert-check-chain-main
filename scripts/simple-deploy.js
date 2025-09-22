const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting deployment...");

  try {
    // Get network info
    const network = await hre.ethers.provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

    // Get deployer
    const [deployer] = await hre.ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH`);

    // Try different ways to get the contract
    let Contract;
    let contractName;

    console.log("\n🔍 Attempting to load contract...");

    // Method 1: Try simple name
    try {
      console.log("Method 1: Trying 'CertificateV2'...");
      Contract = await hre.ethers.getContractFactory("CertificateV2");
      contractName = "CertificateV2";
      console.log("✅ Success with simple name!");
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.message}`);

      // Method 2: Try fully qualified name
      try {
        console.log("Method 2: Trying fully qualified name...");
        Contract = await hre.ethers.getContractFactory("contracts/CertificateV2.sol:CertificateV2");
        contractName = "CertificateV2";
        console.log("✅ Success with fully qualified name!");
      } catch (error2) {
        console.log(`❌ Method 2 failed: ${error2.message}`);

        // Method 3: Try other possible names
        const possibleNames = ["CertificateContract", "Certificate"];
        for (const name of possibleNames) {
          try {
            console.log(`Method 3: Trying '${name}'...`);
            Contract = await hre.ethers.getContractFactory(name);
            contractName = name;
            console.log(`✅ Success with '${name}'!`);
            break;
          } catch (error3) {
            console.log(`❌ '${name}' failed: ${error3.message}`);
          }
        }

        if (!Contract) {
          throw new Error("Could not load any contract. Please check compilation.");
        }
      }
    }

    // Deploy the contract
    console.log(`\n🚀 Deploying ${contractName}...`);
    const contract = await Contract.deploy();

    console.log("⏳ Waiting for deployment...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`✅ Deployed to: ${address}`);

    // Test basic functions
    console.log("\n🧪 Testing contract...");
    try {
      const owner = await contract.owner();
      console.log(`✅ Owner: ${owner}`);

      if (typeof contract.getTotalCertificates === 'function') {
        const total = await contract.getTotalCertificates();
        console.log(`✅ Total certificates: ${total}`);
      }

      if (typeof contract.nextCertificateId === 'function') {
        const nextId = await contract.nextCertificateId();
        console.log(`✅ Next ID: ${nextId}`);
      }
    } catch (testError) {
      console.log(`⚠️  Test warning: ${testError.message}`);
    }

    // Save config
    console.log("\n💾 Saving configuration...");
    const outputDir = path.join(__dirname, "..", "src", "lib");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Try to load ABI
    let abi = [];
    try {
      const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CertificateV2.sol", `${contractName}.json`);
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        abi = artifact.abi;
        console.log(`✅ Loaded ABI with ${abi.length} functions`);
      }
    } catch (abiError) {
      console.log(`⚠️  Could not load ABI: ${abiError.message}`);
    }

    const config = {
      address: address,
      abi: abi,
      contractName: contractName,
      deploymentInfo: {
        deployer: deployer.address,
        network: network.name,
        chainId: network.chainId.toString(),
        timestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber()
      }
    };

    const configPath = path.join(outputDir, "contract-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Config saved to: ${configPath}`);

    console.log("\n🎉 DEPLOYMENT SUCCESS!");
    console.log("=" * 40);
    console.log(`📍 Address: ${address}`);
    console.log(`📋 Contract: ${contractName}`);
    console.log(`📁 Config: ${configPath}`);

  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED!");
    console.error("=" * 30);
    console.error(`Error: ${error.message}`);

    // Diagnostic info
    console.log("\n🔍 DIAGNOSTICS:");
    
    // Check if files exist
    const contractFile = path.join(__dirname, "..", "contracts", "CertificateV2.sol");
    console.log(`Contract file exists: ${fs.existsSync(contractFile)}`);
    
    // Check artifacts
    const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts", "CertificateV2.sol");
    console.log(`Artifacts exist: ${fs.existsSync(artifactsDir)}`);
    
    if (fs.existsSync(artifactsDir)) {
      const files = fs.readdirSync(artifactsDir);
      console.log(`Artifact files: ${files.join(", ")}`);
    }

    console.log("\n💡 TRY:");
    console.log("1. npx hardhat clean");
    console.log("2. npx hardhat compile");
    console.log("3. Run this script again");

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });