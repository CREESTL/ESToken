const {
  BN,
  constants,
  expectRevert,
  time,
} = require('openzeppelin-test-helpers');

const { ZERO_ADDRESS } = constants;

require('chai')
  .use(require('chai-as-promised'))
  .should();

const ESToken = artifacts.require('ESToken');

contract('ESToken', async ([owner, alice, bob]) => {
  const RESERVE_ADDRESS = '0x0000000000000000000000000000000000000001';
  const TEST_EXCHANGE_ADDRESS = '0x0000000000000000000000000000000000000002';

  describe('Constructor tests', async () => {
    it('should create ESToken contract and show default parameters', async () => {
      const esToken = await ESToken.new({ from: owner });

      (await esToken.name.call()).should.be.equal('ESToken');
      (await esToken.symbol.call()).should.be.equal('ESTT');
      (await esToken.decimals.call()).should.be.bignumber.equal(new BN('6'));
      (await esToken.totalSupply.call()).should.be.bignumber.equal(new BN('0'));
      (await esToken.reserveAddress()).should.be.equal(ZERO_ADDRESS);
      (await esToken.exchangeAddress()).should.be.equal(ZERO_ADDRESS);
      (await esToken.dailyInterest()).should.be.bignumber.equal(new BN('1000200000000000000')); // 1 + 0.02%
    });
  });

  describe('Parameter tests', async () => {
    beforeEach(async () => {
      this.esToken = await ESToken.new({ from: owner });
    });

    it('should initialize', async () => {
      this.esToken = await ESToken.new({ from: owner });
      (await this.esToken.totalSupply.call()).should.be.bignumber.equal(new BN('0'));
      (await this.esToken.reserveAddress()).should.be.equal(ZERO_ADDRESS);
      (await this.esToken.exchangeAddress()).should.be.equal(ZERO_ADDRESS);

      await expectRevert(this.esToken.init(TEST_EXCHANGE_ADDRESS, { from: alice }), 'Ownable: caller is not the owner');
      await expectRevert(this.esToken.init(ZERO_ADDRESS, { from: owner }), 'ESToken: newExchangeAddress is zero address');
      await this.esToken.init(TEST_EXCHANGE_ADDRESS, { from: owner });
      await expectRevert(this.esToken.init(TEST_EXCHANGE_ADDRESS, { from: owner }), 'ESToken: re-initialization');

      (await this.esToken.totalSupply.call()).should.be.bignumber.equal(new BN('100000000000000')); // 100_000_000 * decimals
      (await this.esToken.reserveAddress()).should.be.equal(RESERVE_ADDRESS);
      (await this.esToken.exchangeAddress()).should.be.equal(TEST_EXCHANGE_ADDRESS);
      (await this.esToken.balanceOf(TEST_EXCHANGE_ADDRESS)).should.be.bignumber.equal(new BN('70000000000000')); // 70_000_000 * decimals
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.equal(new BN('25000000000000')); // 25_000_000 * decimals
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(new BN('5000000000000')); //  5_000_000 * decimals
    });

    it('should set/get daily interest', async () => {
      await this.esToken.init(TEST_EXCHANGE_ADDRESS, { from: owner });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(new BN('1000200000000000000')); // 1 + 0.02%

      await expectRevert(this.esToken.setDailyInterest(new BN('999999999999999999'), { from: owner }), 'ESToken: negative daily interest');
      await expectRevert(this.esToken.setDailyInterest(new BN('1000000000000000000'), { from: alice }), 'Ownable: caller is not the owner');

      await this.esToken.setDailyInterest(new BN('1000000000000000000'), { from: owner });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(new BN('1000000000000000000')); // 1 + 0.0%

      await this.esToken.setDailyInterest(new BN('1001000000000000000'), { from: owner });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(new BN('1001000000000000000')); // 1 + 0.1%
    });
  });

  describe('Tests of methods', async () => {
    beforeEach(async () => {
      this.esToken = await ESToken.new({ from: owner });
      await this.esToken.init(TEST_EXCHANGE_ADDRESS, { from: owner });
    });

    it('should show balance', async () => {
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(new BN('5000000000000')); //  5_000_000 * decimals
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('0'));

      await this.esToken.transfer(alice, new BN('1000000000000'), { from: owner });

      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('1000000000000')); //  1_000_000 * decimals
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(new BN('4000000000000')); //  4_000_000 * decimals
    });

    it('should accrue interest', async () => {
      await this.esToken.transfer(alice, new BN('1000000000000'), { from: owner });
      await this.esToken.transfer(bob, new BN('1000000000000'), { from: owner });
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('1000000000000')); //  1_000_000 * decimals
      (await this.esToken.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000000000')); //  1_000_000 * decimals
      await time.increase(new BN('86400'));
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('1000200000000')); //  1_000_200 * decimals
      await this.esToken.transfer(bob, new BN('1000200000000'), { from: alice });
      (await this.esToken.balanceOf(bob)).should.be.bignumber.equal(new BN('2000400000000')); //  2_000_400 * decimals
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('0'));
      await time.increase(new BN('86400'));
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(new BN('0'));
      (await this.esToken.balanceOf(bob)).should.be.bignumber.equal(new BN('2000800080000')); //  2_000_800 * decimals
    });
  });
});
