const fs = require('fs');

module.exports = {
  skipFiles: ['Migrations.sol', 'ERC20.sol'],
  onCompileComplete: (config) => {
    // console.log(config)
    // fs.copyFileSync('./build/contracts/TetherToken.json', './.coverage_contracts/');
  }
};