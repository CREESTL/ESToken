module.exports = {
  networks: {
    soliditycoverage: {
      host: "localhost",
      port: 8555,
      network_id: "*", // Match any network id
      gas: 6721975
    }
  },
  mocha: {
    // reporter: "eth-gas-reporter",
    // reporterOptions : { currency: "USD" }
  },
  compilers: {
    solc: {
      version: "0.6.3",
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
