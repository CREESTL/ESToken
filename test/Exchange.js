const {
  BN,
  constants,
  expectRevert,
  time,
  ether,
} = require('@openzeppelin/test-helpers');

const { usdt, estt } = require('./Common');

require('chai')
  .use(require('chai-as-promised'))
  .should();

const { ZERO_ADDRESS } = constants;

const ESToken = artifacts.require('ESToken');
const Exchange = artifacts.require('Exchange');
const TetherToken = artifacts.require('TetherToken');

const assertEqual = (a, b) => assert.isTrue(Object.is(a, b), `Expected ${a.toString()} to equal ${b.toString()}`);

contract('Exchange', async ([owner, alice, bob, carol]) => {

  beforeEach(async () => {
    this.estt = await ESToken.new({from: owner});
    this.usdt = await TetherToken.new(new BN('1000000000000000000000'), 'USDT', 'USDT', new BN('6'), {from: owner});
    this.exchange = await Exchange.new(this.estt.address, this.usdt.address, {from: owner});
    await this.estt.init(this.exchange.address, {from: owner});
  });

  // see migrations
  it("should deploy with less than 6 mil gas", async () => {
    const receipt = await web3.eth.getTransactionReceipt(this.exchange.transactionHash);
    assert.isBelow(receipt.gasUsed, process.env.NETWORK == 'soliditycoverage' ? 12000000 : 6000000);
  });

  describe('Basic trade tests', async () => {
    beforeEach(async () => {
      await this.usdt.transfer(alice, usdt('5'), {from: owner}); // 5 usdt
      await this.estt.transfer(alice, estt('1'), {from: owner}); // 1 estt
      await this.usdt.approve(this.exchange.address, usdt('5'), {from: alice}); // 5 usdt
      await this.estt.approve(this.exchange.address, estt('1'), {from: alice}); // 1 estt
    });

    it('should place an orders', async () => {
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('2'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 2 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, usdt('50.1'), ZERO_ADDRESS, {from: alice}); // 1 estt -> 50.1 usdt
    });

    it('should revert if not enough balance', async () => {
      // usdt
      await expectRevert(this.exchange.trade(this.usdt.address, new BN('5000001'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }), 'not enough balance');
      await this.exchange.trade(this.usdt.address, usdt('5'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, {from: alice}); // 5 usdt -> 1 estt
      await expectRevert(this.exchange.trade(this.usdt.address, usdt('0.000001'), this.estt.address, new BN('1'), ZERO_ADDRESS, {from: alice}), 'not enough balance');
      // // estt
      await expectRevert(this.exchange.trade(this.estt.address, new BN('1000001'), this.usdt.address, usdt('10.1'), ZERO_ADDRESS, {from: alice}), 'not enough balance');
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, usdt('50.1'), ZERO_ADDRESS, {from: alice}); // 1 estt -> 50.1 usdt
      await expectRevert(this.exchange.trade(this.estt.address, new BN('12'), this.usdt.address, usdt('10.1'), ZERO_ADDRESS, {from: alice}), 'not enough balance');
    });

    it('should revert if price is too low', async () => {
      // usdt
      await expectRevert(this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('1000001'), ZERO_ADDRESS, {from: alice}), 'ESTT can\'t be cheaper USDT');
      // estt
      await expectRevert(this.exchange.trade(this.estt.address, new BN('100001'), this.usdt.address, usdt('0.1'), ZERO_ADDRESS, {from: alice}), 'ESTT can\'t be cheaper USDT');
    });

    it('should revert if price is too low and not 1:1', async () => {
      // change min price
      await this.exchange.setMinPrice(new BN('2000000'), { from: owner });
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('2000000')); // 2
      // usdt
      await this.exchange.trade(this.usdt.address, usdt('2'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, {from: alice});
      await expectRevert(this.exchange.trade(this.usdt.address, new BN('2000000'), this.estt.address, new BN('1000001'), ZERO_ADDRESS, {from: alice}), 'ESTT can\'t be cheaper USDT');
      // estt
      await this.exchange.trade(this.estt.address, new BN('100000'), this.usdt.address, usdt('0.2'), ZERO_ADDRESS, {from: alice});
      await expectRevert(this.exchange.trade(this.estt.address, new BN('100001'), this.usdt.address, usdt('0.2'), ZERO_ADDRESS, {from: alice}), 'ESTT can\'t be cheaper USDT');
    });

    it('should revert if src or dest not correct', async () => {
      const someErc20 = await ESToken.new({from: owner});
      // usdt
      await expectRevert(this.exchange.trade(someErc20.address, usdt('1'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, {from: alice}), 'wrong src');
      // estt
      await expectRevert(this.exchange.trade(this.estt.address, new BN('100000'), someErc20.address, usdt('0.1'), ZERO_ADDRESS, {from: alice}), 'wrong dest');
      await expectRevert(this.exchange.trade(someErc20.address, new BN('100000'), someErc20.address, usdt('0.1'), ZERO_ADDRESS, {from: alice}), 'wrong src');
    });
  });

  describe('Get methods tests', async () => {
    beforeEach(async () => {
      await this.usdt.transfer(alice, usdt('5'), {from: owner}); // 5 usdt
      await this.estt.transfer(alice, new BN('1000000'), {from: owner}); // 1 estt
      await this.usdt.approve(this.exchange.address, usdt('5'), {from: alice}); // 5 usdt
      await this.estt.approve(this.exchange.address, new BN('1000000'), {from: alice}); // 1 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('2'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, usdt('50.1'), ZERO_ADDRESS, { from: alice }); // 1 estt -> 50.1 usdt
    });

    it('should set/get referral bonus', async () => {
      (await this.exchange.referralBonus()).should.be.bignumber.equal(new BN('1000500000000000000')); // 1 + 0.05%

      await expectRevert(this.exchange.setReferralBonus(new BN('999999999999999999'), { from: owner }), 'negative referral bonus');
      await expectRevert(this.exchange.setReferralBonus(new BN('1000000000000000000'), { from: alice }), 'Ownable: caller is not the owner');

      await this.exchange.setReferralBonus(new BN('1000000000000000000'), { from: owner });
      (await this.exchange.referralBonus()).should.be.bignumber.equal(new BN('1000000000000000000')); // 1 + 0.0%

      await this.exchange.setReferralBonus(new BN('1002000000000000000'), { from: owner });
      (await this.exchange.referralBonus()).should.be.bignumber.equal(new BN('1002000000000000000')); // 1 + 0.2%
    });

    it('should set/get exchange fee', async () => {
      (await this.exchange.exchangeFee()).should.be.bignumber.equal(new BN('1008000000000000000')); // 1 + 0.8%

      await expectRevert(this.exchange.setExchangeFee(new BN('999999999999999999'), { from: owner }), 'negative exchange fee');
      await expectRevert(this.exchange.setExchangeFee(new BN('1000000000000000000'), { from: alice }), 'Ownable: caller is not the owner');

      await this.exchange.setExchangeFee(new BN('1000000000000000000'), { from: owner });
      (await this.exchange.exchangeFee()).should.be.bignumber.equal(new BN('1000000000000000000')); // 1 + 0.0%

      await this.exchange.setExchangeFee(new BN('1002000000000000000'), { from: owner });
      (await this.exchange.exchangeFee()).should.be.bignumber.equal(new BN('1002000000000000000')); // 1 + 0.2%
    });

    it('should set/get min price', async () => {
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('1000000')); // 1

      await expectRevert(this.exchange.setMinPrice(new BN('900000'), { from: owner }), 'min possible price not in range [1, 9999]');
      await expectRevert(this.exchange.setMinPrice(new BN('10000000000'), { from: owner }), 'min possible price not in range [1, 9999]');
      await expectRevert(this.exchange.setMinPrice(new BN('1000000'), { from: alice }), 'Ownable: caller is not the owner');

      await this.exchange.setMinPrice(new BN('2000000'), { from: owner });
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('2000000')); // 2

      await this.exchange.setMinPrice(new BN('1000000'), { from: owner });
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('1000000')); // 1
    });

    it('should get prices', async () => {
      // usdt
      const price_usdt_estt_0 = await this.exchange.getNextPrice(this.usdt.address, 0);
      price_usdt_estt_0.should.be.bignumber.equal(new BN('50000')); // 5 usdt for 1 estt
      const price_usdt_estt_1 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_0);
      price_usdt_estt_1.should.be.bignumber.equal(new BN('100000')); // 10 usdt for 1 estt
      const price_usdt_estt_2 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_1);
      price_usdt_estt_2.should.be.bignumber.equal(new BN('0'));
      // estt
      const price_estt_usdt_0 = await this.exchange.getNextPrice(this.estt.address, 0);
      price_estt_usdt_0.should.be.bignumber.equal(usdt('50.1')); // 1 estt for 50.1 usdt
      const price_estt_usdt_1 = await this.exchange.getNextPrice(this.usdt.address, price_estt_usdt_0);
      price_estt_usdt_1.should.be.bignumber.equal(new BN('0'));
    });

    it('should get user uids', async () => {
      const alice_orders = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders.length, 5);
      const rest_alice_address = alice.toString().substr(alice.toString().length - 8).toLowerCase();
      const alice_order_estt_usdt = alice_orders[0].toJSON().toLowerCase();
      assertEqual(alice_order_estt_usdt.substr(alice_order_estt_usdt.length - 9),"1" + rest_alice_address);
      for (let i = 1; i < 5; ++i) {
        const alice_order_usdt_estt = alice_orders[i].toJSON().toLowerCase();
        assertEqual(alice_order_usdt_estt.substr(alice_order_usdt_estt.length - 9),"2" + rest_alice_address);
      }
    });

    it('should get orders params', async () => {
      // usdt
      const price_usdt_estt_0 = await this.exchange.getNextPrice(this.usdt.address, 0);
      price_usdt_estt_0.should.be.bignumber.equal(new BN('50000')); // 5 usdt for 1 estt
      const price_usdt_estt_1 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_0);
      price_usdt_estt_1.should.be.bignumber.equal(new BN('100000')); // 10 usdt for 1 estt
      const price_usdt_estt_2 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_1);
      price_usdt_estt_2.should.be.bignumber.equal(new BN('0'));
      const price_usdt_estt_0_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_0);
      assertEqual(price_usdt_estt_0_uids.length, 1);
      const order_usdt_estt_0 = await this.exchange.getOrderByUid(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0[0].should.be.bignumber.equal(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0[1].should.be.equal(alice);
      order_usdt_estt_0[2].should.be.bignumber.equal(usdt('2'));
      order_usdt_estt_0[3].should.be.bignumber.equal(new BN('100000'));
      order_usdt_estt_0[4].should.be.bignumber.equal(new BN('0'));
      const price_usdt_estt_1_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_1);
      assertEqual(price_usdt_estt_1_uids.length, 3);
      for (let i = 0; i < 3; ++i) {
        const order_usdt_estt = await this.exchange.getOrderByUid(price_usdt_estt_1_uids[i]);
        order_usdt_estt[0].should.be.bignumber.equal(price_usdt_estt_1_uids[i]);
        order_usdt_estt[1].should.be.equal(alice);
        order_usdt_estt[2].should.be.bignumber.equal(usdt('1'));
        order_usdt_estt[3].should.be.bignumber.equal(new BN('100000'));
        order_usdt_estt[4].should.be.bignumber.equal(new BN('0'));
      }
      // estt
      const price_estt_usdt_0 = await this.exchange.getNextPrice(this.estt.address, 0);
      price_estt_usdt_0.should.be.bignumber.equal(usdt('50.1')); // 1 estt for 50.1 usdt
      const price_estt_usdt_1 = await this.exchange.getNextPrice(this.usdt.address, price_estt_usdt_0);
      price_estt_usdt_1.should.be.bignumber.equal(new BN('0'));
      const price_estt_usdt_0_uids = await this.exchange.getUidsByPrice(this.estt.address, price_estt_usdt_0);
      assertEqual(price_estt_usdt_0_uids.length, 1);
      const order_usdt_estt_4 = await this.exchange.getOrderByUid(price_estt_usdt_0_uids[0]);
      order_usdt_estt_4[0].should.be.bignumber.equal(price_estt_usdt_0_uids[0]);
      order_usdt_estt_4[1].should.be.equal(alice);
      order_usdt_estt_4[2].should.be.bignumber.equal(new BN('1000000'));
      order_usdt_estt_4[3].should.be.bignumber.equal(usdt('50.1'));
      order_usdt_estt_4[4].should.be.bignumber.equal(new BN('0'));
    });
  });

  describe('Orders tests', async () => {
    it('should instant buy ESTT by 1:1 price', async () => {
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, usdt('1'), { from: bob });
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bob_orders_0 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_0.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(usdt('1'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
    });

    it('should instant buy ESTT by 1:1 price, min price 2u/1e', async () => {
      await this.exchange.setMinPrice(new BN('2000000'), { from: owner });
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('2000000'));
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, usdt('1'), { from: bob });
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bob_orders_0 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_0.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('500000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(usdt('1'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999500000'));
    });

    it ('should instant sell ESTT by 1:1 price', async () => {
      // "before" block
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address,new BN('1000000'), { from: bob });
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      //estt
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0'));
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, usdt('1'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bob_orders_1 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_1.length, 0);
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0.992'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(usdt('0.008'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999992000'));
    });

    it ('should instant sell ESTT by 1:1 price, min price 2u/1e', async () => {
      await this.exchange.setMinPrice(new BN('2000000'), { from: owner });
      (await this.exchange.minPrice()).should.be.bignumber.equal(new BN('2000000'));
      // "before" block
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address,new BN('1000000'), { from: bob });
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      //estt
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999500000'));
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0'));
      await this.exchange.trade(this.estt.address, new BN('500000'), this.usdt.address, usdt('1'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bob_orders_1 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_1.length, 0);
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(usdt('0.992'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(usdt('0.008'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999996000'));
    });
  });

  describe('Orders tests', async () => {
    beforeEach(async () => {
      await this.usdt.transfer(alice, usdt('5'), { from: owner }); // 5 usdt
      await this.usdt.approve(this.exchange.address, usdt('5'), { from: alice }); // 5 usdt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.5 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.5 estt
      await this.exchange.trade(this.usdt.address, usdt('2'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 0.5 estt
      await this.exchange.trade(this.usdt.address, usdt('1'), this.estt.address, new BN('500000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.5 estt
    });

    it('should check right uid', async () => {
      const rest_alice_address = alice.toString().substr(alice.toString().length - 8).toLowerCase();
      const custom_uid = '0x103' + rest_alice_address; // incrrect Uid (wrong trade type)
      await expectRevert(this.exchange.cancel(web3.utils.toBN(custom_uid), { from: alice }), 'wrong token type');
    });

    it('should revert if user has not rights to cancel order', async () => {
      const alice_orders_0 = await this.exchange.getMyOrders({ from: alice });
      await expectRevert(this.exchange.cancel(alice_orders_0[0], { from: bob }), 'doesn\'t have rights to cancel order');
    });

    it('should cancel orders', async () => {
      const alice_orders_0 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_0.length, 4);
      await this.exchange.cancel(alice_orders_0[0], { from: alice });
      await expectRevert(this.exchange.cancel(alice_orders_0[0], { from: alice }), 'SafeMath: subtraction overflow');
      const alice_orders_1 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_1.length, 3);
      await this.exchange.cancel(alice_orders_1[0], { from: alice });
      await this.exchange.cancel(alice_orders_1[1], { from: alice });
      await this.exchange.cancel(alice_orders_1[2], { from: alice });
      const alice_orders_2 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_2.length, 0);
    });

    it('should support piecemeal purchases', async () => {
      return;
      await this.estt.transfer(bob, new BN('2016129'), { from: owner }); // 2 estt + 0.8% fee
      await this.estt.approve(this.exchange.address, new BN('2016129'), { from: bob }); // 2 estt + 0.8% fee
      await this.exchange.trade(this.estt.address, new BN('400000'), this.usdt.address, usdt('1'), ZERO_ADDRESS, { from: bob }); // 0.4 estt -> 1 usdt
      const price_usdt_estt_0 = await this.exchange.getNextPrice(this.usdt.address, 0);
      const price_usdt_estt_0_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_0);
      const order_usdt_estt_0 = await this.exchange.getOrderByUid(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0[4].should.be.bignumber.equal(usdt('1.5872')); // 1.6 - 0.8% exchange fee
      const alice_orders_0 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_0.length, 4);
      await this.exchange.trade(this.estt.address, new BN('400000'), this.usdt.address, usdt('1'), ZERO_ADDRESS, { from: bob }); // 0.4 estt -> 1 usdt
      const bob_orders_0 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_0.length, 1);
      const alice_orders_1 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_1.length, 3);
      await this.exchange.cancel(bob_orders_0[0], { from: bob });
      await this.exchange.trade(this.estt.address, new BN('504032'), this.usdt.address, usdt('1'), ZERO_ADDRESS, { from: bob }); // 0.5 estt (+0.8% for fee) -> 1 usdt
      const alice_orders_2 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_2.length, 2);
      await this.exchange.trade(this.estt.address, new BN('1008065'), this.usdt.address, usdt('1.5'), ZERO_ADDRESS, { from: bob }); // 200 estt (+0.8% for fee) -> 1.5 usdt
      (await this.estt.balanceOf(alice, { from: alice })).should.be.bignumber.equal(new BN('2000000'));
      (await this.estt.balanceOf(bob, { from: bob })).should.be.bignumber.lt(new BN('110'));
      (await this.usdt.balanceOf(alice, { from: alice })).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(bob, { from: bob })).should.be.bignumber.equal(usdt('5'));
    });
  });

  describe('Referral tests', async () => {
    it('should add referral bonus', async () => {
      await this.usdt.transfer(alice, usdt('100'), { from: owner });
      await this.usdt.approve(this.exchange.address, usdt('100'), { from: alice });
      await this.exchange.trade(this.usdt.address, usdt('100'), this.estt.address, new BN('100000000'), bob, { from: alice }); // 100 usdt -> 100 estt
      (await this.estt.balanceOf(bob, { from: bob })).should.be.bignumber.equal(new BN('50000'));
      await time.increase(new BN('86400'));
      const balance_bob_1 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_1.should.be.bignumber.lt(new BN('60011'));
      balance_bob_1.should.be.bignumber.gt(new BN('60006'));
      await time.increase(new BN('86400'));
      const balance_bob_2 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_2.should.be.bignumber.lt(new BN('70021'));
      balance_bob_2.should.be.bignumber.gt(new BN('70016'));
      await time.increase(new BN('86400'));
      const balance_bob_3 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_3.should.be.bignumber.lt(new BN('80031'));
      balance_bob_3.should.be.bignumber.gt(new BN('80025'));
      const balance_alice_1 = await this.estt.balanceOf(alice, { from: alice });
      balance_alice_1.should.be.bignumber.lt(new BN('100070000'));
      balance_alice_1.should.be.bignumber.gt(new BN('100050000'));
      await this.estt.transfer(alice, balance_bob_3, { from: bob });
      const balance_alice_2 = await this.estt.balanceOf(alice, { from: alice });
      balance_alice_2.should.be.bignumber.lt(new BN('100140040'));
      balance_alice_2.should.be.bignumber.gt(new BN('100139990'));
      const referrals = await this.estt.getMyReferrals({ from: bob });
      assertEqual(referrals.length, 1);
      (referrals[0]).should.be.equal(alice);
    });

    // it('test crash', async () => {
    //   await this.usdt.transfer(alice, ether('100'), { from: owner });
    //   await this.usdt.approve(this.exchange.address, ether('100'), { from: alice });
    //   await this.estt.accrueInterest();
    //   await this.estt.accrueInterest();
    //   await this.estt.accrueInterest();
    //   await this.estt.accrueInterest();
    //   await this.estt.accrueInterest();
    //   await this.estt.accrueInterest();
    //   await this.exchange.trade(this.usdt.address, ether('100'), this.estt.address, new BN('100000000'), carol, { from: alice }); // 100 usdt -> 100 estt
    //   const balance_carol = await this.estt.balanceOf(carol, { from: bob });
    //   (balance_carol).should.be.bignumber.equal(new BN('50000'));
    // });
  });

  after(async () => {
    await Exchange.deployed().then(async (instance) => {
      const bytecode = instance.constructor._json.bytecode;
      const deployed = instance.constructor._json.deployedBytecode;
      const sizeOfB = bytecode.length / 2;
      const sizeOfD = deployed.length / 2;
      console.log("\n    Exchange size of bytecode in bytes =", sizeOfB);
      console.log("    Exchange size of deployed in bytes =", sizeOfD);
      console.log("    Exchange initialisation and constructor code in bytes =", sizeOfB - sizeOfD);
      const receipt = await web3.eth.getTransactionReceipt(this.exchange.transactionHash);
      console.log("    Exchange deploy gas =", receipt.gasUsed);
    });
  });
});
