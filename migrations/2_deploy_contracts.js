const ESToken = artifacts.require('ESToken');
const Exchange = artifacts.require('Exchange');
const TetherToken = artifacts.require('TetherToken');
const { BN } = require('openzeppelin-test-helpers');

module.exports = function(deployer) {
  deployer.deploy(ESToken).then(function() {
    return deployer.deploy(TetherToken, new BN('1000000000000000000000'), 'USDT', 'USDT', new BN('6'));
  }).then(function() {
    return deployer.deploy(Exchange, ESToken.address, TetherToken.address);
  });
};
