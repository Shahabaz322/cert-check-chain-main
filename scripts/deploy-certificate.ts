import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying CertificateContract...");

  // Get the ContractFactory
  const CertificateContract = await ethers.getContractFactory("CertificateContract");

  // Deploy the contract
  console.log("📄 Deploying contract...");
  const certificate = await CertificateContract.deploy();

  // Wait for deployment to be mined
  await certificate.waitForDeployment();

  const contractAddress = await certificate.getAddress();
  
  console.log("✅ CertificateContract deployed successfully!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔗 Deployment transaction:", certificate.deploymentTransaction()?.hash);

  // Verify deployment by calling contract functions
  console.log("\n🔍 Verifying deployment...");
  const owner = await certificate.owner();
  console.log("👤 Contract owner:", owner);
  
  const totalCertificates = await certificate.getTotalCertificates();
  console.log("📊 Total certificates:", Number(totalCertificates));
  
  const nextId = await certificate.nextCertificateId();
  console.log("🆔 Next certificate ID:", Number(nextId));

  // Generate ABI for frontend
  const artifact = await ethers.getContractFactory("CertificateContract");
  
  console.log("\n🔧 UPDATE YOUR src/lib/web3.ts:");
  console.log("=" .repeat(50));
  console.log(`export const CONTRACT_ADDRESS = '${contractAddress}';`);
  console.log("\nReplace CONTRACT_ABI with:");
  console.log("export const CONTRACT_ABI = ", JSON.stringify(artifact.interface.formatJson(), null, 2));
  console.log("=" .repeat(50));

  // Test issuing a certificate (optional)
  console.log("\n🧪 Testing certificate issuance...");
  try {
    const testRecipient = owner; // Use deployer as test recipient
    const testTx = await certificate.issueCertificate(
      testRecipient,
      "John Doe",
      "Blockchain Development",
      "Tech University",
      Math.floor(Date.now() / 1000)
    );
    
    const receipt = await testTx.wait();
    console.log("✅ Test certificate issued! TX hash:", receipt?.hash);
    
    // Get the certificate
    const testCert = await certificate.getCertificate(1);
    console.log("📜 Test certificate details:", {
      id: Number(testCert.id),
      recipient: testCert.recipient,
      name: testCert.name,
      course: testCert.course,
      institution: testCert.institution,
      isValid: testCert.isValid
    });
    
  } catch (error) {
    console.log("⚠️  Test certificate issuance failed:", error);
  }
}

main()
  .then(() => {
    console.log("\n🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });