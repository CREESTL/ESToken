const {
  BN,
  EVMThrow,
} = require('openzeppelin-test-helpers');
require('chai')
  .use(require('chai-as-promised'))
  .should();

const ESToken = artifacts.require('ESToken');

contract('ESToken', async ([owner, alice, bob]) => {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  beforeEach(async () => {
    this.esToken = await ESToken.new({ from: owner });
  });

  it('should been deployed', async () => {
  });
});
