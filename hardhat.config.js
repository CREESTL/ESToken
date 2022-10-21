require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");
require("hardhat-gas-reporter");

const {
        BSCSCAN_API_KEY,
        ACC_PRIVATE_KEY
    } = process.env;

module.exports = {
  solidity: {
    version: "0.6.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // BSC testnet
    chapel: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [ACC_PRIVATE_KEY],
      chainId: 56,
    },
    // BSC mainnet
    bsc: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: [ACC_PRIVATE_KEY],
      chainId: 97,
    },
  },
  mocha: {
    timeout: 20000000000
  },
  paths: {
    sources: "./contracts/",
    tests: "./tests/",
  },
  etherscan: {
    apiKey: {
      bsc: BSCSCAN_API_KEY,
      bscTestnet: BSCSCAN_API_KEY
    },
  },
  skipFiles: ["node_modules"],
  gasReporter: {
      enabled: true,
      url: "http://localhost:8545"
  }
};
