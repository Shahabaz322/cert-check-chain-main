import { ethers } from "hardhat";

async function main() {
  console.log("Checking recent deployments on Ganache...");
  
  // Connect to Ganache
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
  
  // Get latest block
  const latestBlock = await provider.getBlock("latest");
  console.log("Latest block number:", latestBlock?.number);
  
  // Check last few blocks for contract deployments
  if (latestBlock) {
    for (let i = 0; i < 5 && (latestBlock.number - i) >= 0; i++) {
      const blockNumber = latestBlock.number - i;
      const block = await provider.getBlock(blockNumber);
      
      if (block?.transactions) {
        console.log(`\nBlock ${blockNumber} has ${block.transactions.length} transactions`);
        
        for (const txHash of block.transactions) {
          const tx = await provider.getTransaction(txHash);
          const receipt = await provider.getTransactionReceipt(txHash);
          
          // Check if this is a contract deployment (to address is null)
          if (tx?.to === null && receipt?.contractAddress) {
            console.log(`🎯 Contract deployed at: ${receipt.contractAddress}`);
            console.log(`   Transaction hash: ${txHash}`);
            
            // Try to interact with it as a Certificate contract
            try {
              const CertificateContract = await ethers.getContractFactory("CertificateContract");
              const contract = CertificateContract.attach(receipt.contractAddress);
              
              const owner = await contract.owner();
              const nextId = await contract.nextCertificateId();
              
              console.log(`   ✅ This is a CertificateContract!`);
              console.log(`   👤 Owner: ${owner}`);
              console.log(`   🆔 Next certificate ID: ${nextId}`);
              console.log(`\n🔧 Update your web3.ts with:`);
              console.log(`export const CONTRACT_ADDRESS = '${receipt.contractAddress}';`);
              
            } catch (error) {
              console.log(`   ❌ Not a CertificateContract or error: ${error}`);
            }
          }
        }
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });