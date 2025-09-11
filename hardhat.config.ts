  import { HardhatUserConfig } from "hardhat/config";
  import "@nomicfoundation/hardhat-toolbox";
  import "@nomicfoundation/hardhat-ethers";

  const config: HardhatUserConfig = {
    solidity: "0.8.28",
    networks: {
      ganache: {
        url: "http://127.0.0.1:7545",
        accounts: [
          "0x04497645c88c015c7c6cfaca5bf5f66221367da334cb85d9cbe645418389d61b"
        ],
        chainId: 1337,
        gas: 6000000,
        gasPrice: 20000000000
      },
      localhost: {
        url: "http://127.0.0.1:8545",
        chainId: 31337
      }
    },
    paths: {
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: "./artifacts"
    }
  };

  export default config;