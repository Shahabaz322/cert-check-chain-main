import { ethers, network } from "hardhat";

async function main() {
  console.log("Current network:", network.name);
  console.log("Sending transaction using network:", network.name);

  // Get signers
  const [sender] = await ethers.getSigners();
  
  console.log("Sending 1 wei from", sender.address, "to itself");

  // Check if this is an Optimism network (you can customize this logic)
  if (network.name.includes("op") || network.name.includes("optimism")) {
    console.log("Sending L2 transaction on Optimism network");
  } else {
    console.log("Sending transaction on", network.name);
  }

  // Send transaction (1 wei to self)
  const tx = await sender.sendTransaction({
    to: sender.address,
    value: 1n, // 1 wei
  });

  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Transaction sent successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });