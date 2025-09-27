// hash-generator.js
const readline = require("readline");
const CryptoJS = require("crypto-js");

// Generate SHA256 hash from plain text
const generateSHA256Hash = (text) => {
  const wordArray = CryptoJS.enc.Utf8.parse(text);
  const hash = CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
  return hash;
};

// Convert hash to bytes32 format
const hashToBytes32 = (hash) => {
  return hash.startsWith("0x") ? hash : `0x${hash}`;
};

// CLI input setup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter text to hash: ", (inputText) => {
  const hash = generateSHA256Hash(inputText);
  console.log("\n🔑 Generated SHA256 Hash:");
  console.log(hash);

  console.log("\n🔑 Bytes32 Formatted Hash:");
  console.log(hashToBytes32(hash));

  console.log("\n📏 Hash length (with 0x):", hashToBytes32(hash).length);
  rl.close();
});
