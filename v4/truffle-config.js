module.exports = {
  networks: {

  },
  mocha: {

  },
  contracts_directory: "./v4",
  compilers: {
    solc: {
      version: "0.4.17",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "constantinople"
      }
    }
  },
  plugins: ["solidity-coverage"]
}
