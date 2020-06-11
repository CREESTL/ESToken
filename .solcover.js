const fs = require('fs');
const path = require('path');

const copyFileSync = (source, target) => {
  let targetFile = target;
  //if target is a directory a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

const copyFolderRecursiveSync = (source, target) => {
  let files = [];
  console.log(source, target);
  //check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    console.log(targetFolder);
    fs.mkdirSync(targetFolder);
  }

  //copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}

module.exports = {
  skipFiles: ['Migrations.sol', 'ERC20.sol'],
  onCompileComplete: (config) => {
    // console.log(config);
    // //fs.copyFileSync('./build/contracts/TetherToken.json', './.coverage_contracts/');
    // if (config.config == './v4/truffle-config.js') {
      copyFolderRecursiveSync('.coverage_contracts/', './temp/');
    //   // copyFolderRecursiveSync('.coverage_artifacts/', './temp/');
    // } else if (config.config == './v6/truffle-config.js') {
    //   // copyFolderRecursiveSync('./temp/.coverage_contracts/', '.coverage_contracts/');
    //   fs.copyFileSync('./temp/.coverage_contracts/USDT.sol', '.coverage_contracts/USDT.sol');
    // }
  }
};