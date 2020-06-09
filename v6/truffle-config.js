module.exports = {
  networks: {

  },
  mocha: {

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
