require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");
require("hardhat-gas-reporter");

const { BSCSCAN_API_KEY, ACC_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // BSC Chapel testnet
    chapel: {
      url: `https://rpc.ankr.com/bsc_testnet_chapel/`,
      accounts: [ACC_PRIVATE_KEY],
    },
    // BSC mainnet
    bsc: {
      url: "https://rpc.ankr.com/bsc",
      accounts: [ACC_PRIVATE_KEY],
    },
  },
  mocha: {
    timeout: 20000000000,
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
    },
  },
  skipFiles: ["node_modules"],
  gasReporter: {
    enabled: true,
    url: "http://localhost:8545",
  },
};
