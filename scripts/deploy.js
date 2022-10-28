// SPDX-License-Identifier: MIT

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");

// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutput.json");

let contractName;
let token;
let exchange;

// The address of USDT token depends on the chain
// Addresses from BscScan
let USDT_ADDRESS;
if (network.name == "chapel") {
  // BUSDImplementation
  USDT_ADDRESS = "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee";
} else if (network.name == "bsc") {
  // BEP20USDT
  USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
}

async function main() {
  console.log(`[NOTICE!] Chain of deployment: ${network.name}`);

  // ====================================================

  // Contract #1: ESToken

  // Deploy
  contractName = "ESToken";
  console.log(`[${contractName}]: Start of Deployment...`);
  let _contractProto = await ethers.getContractFactory(contractName);
  token = await _contractProto.deploy();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY[network.name][contractName].address = token.address;

  // Verify
  console.log(`[${contractName}]: Start of Verification...`);

  // Sleep for 90 seconds, otherwise block explorer will fail
  await delay(90000);

  // Write deployment and verification info into the JSON file before actual verification
  // The reason is that verification may fail if you try to verify the same contract again
  // And the JSON file will not change
  OUTPUT_DEPLOY[network.name][contractName].address = token.address;
  if (network.name === "bsc") {
    url = "https://bscscan.com/address/" + token.address + "#code";
  } else if (network.name === "chapel") {
    url = "https://testnet.bscscan.com/address/" + token.address + "#code";
  }
  OUTPUT_DEPLOY[network.name][contractName].verification = url;

  // Provide all contract's dependencies as separate files
  // NOTE It may fail with "Already Verified" error. Do not pay attention to it. Verification will
  // be done correctly!
  try {
    await hre.run("verify:verify", {
      address: token.address
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`[${contractName}]: Verification Finished!`);


  // ====================================================

  // Contract #2: Exchange

  // Deploy
  contractName = "Exchange";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  exchange = await _contractProto.deploy(token.address, USDT_ADDRESS);
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY[network.name][contractName].address = exchange.address;

  // Verify
  console.log(`[${contractName}]: Start of Verification...`);

  await delay(90000);

  OUTPUT_DEPLOY[network.name][contractName].address = exchange.address;
  if (network.name === "bsc") {
    url = "https://bscscan.com/address/" + exchange.address + "#code";
  } else if (network.name === "chapel") {
    url = "https://testnet.bscscan.com/address/" + exchange.address + "#code";
  }

  OUTPUT_DEPLOY[network.name][contractName].verification = url;

  try {
    await hre.run("verify:verify", {
      address: exchange.address,
      constructorArguments: [token.address, USDT_ADDRESS],
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`[${contractName}]: Verification Finished!`);

  // ====================================================

  console.log(`See Results in "${__dirname + "/deployOutput.json"}" File`);

  fs.writeFileSync(
    path.resolve(__dirname, "./deployOutput.json"),
    JSON.stringify(OUTPUT_DEPLOY, null, "  ")
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });