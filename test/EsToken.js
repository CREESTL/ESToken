const {
    BN,
    EVMThrow,
} = require('openzeppelin-test-helpers');
require('chai')
    .use(require('chai-as-promised'))
    .should();

const EsToken = artifacts.require('EsToken');

contract('EsToken', async ([owner, alice, bob]) => {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    beforeEach(async () => {
        this.eSToken = await EsToken.new({ from: owner });
    });

    it('should been deployed', async () => {
    });
});