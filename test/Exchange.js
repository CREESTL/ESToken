const {
  BN,
  constants,
  expectRevert,
  time,
  ether,
} = require('openzeppelin-test-helpers');

require('chai')
  .use(require('chai-as-promised'))
  .should();

const { ZERO_ADDRESS } = constants;

const ESToken = artifacts.require('ESToken');
const Exchange = artifacts.require('Exchange');
const USDToken = artifacts.require('USDToken');

const assertEqual = (a, b) => assert.isTrue(Object.is(a, b), `Expected ${a.toString()} to equal ${b.toString()}`);

contract('Exchange', async ([owner, alice, bob]) => {

  beforeEach(async () => {
    this.estt = await ESToken.new({ from: owner });
    this.usdt = await USDToken.new({ from: owner });
    this.exchange = await Exchange.new(this.estt.address, this.usdt.address, { from: owner });
    await this.estt.init(this.exchange.address, { from: owner });
  });

  it('should place an orders', async () => {
    await this.usdt.transfer(alice, ether('5'), { from: owner }); // 5 usdt
    await this.estt.transfer(alice, new BN('1000000'), { from: owner }); // 1 estt
    await this.usdt.approve(this.exchange.address, ether('5'), { from: alice }); // 5 usdt
    await this.estt.approve(this.exchange.address, new BN('1000000'), { from: alice }); // 1 estt
    await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
    await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
    await this.exchange.trade(this.usdt.address, ether('2'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 100 estt
    await expectRevert(this.exchange.trade(this.usdt.address, ether('2'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }), 'not enough balance');
    await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
    await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, ether('0.025'), ZERO_ADDRESS, { from: alice }); // 1 estt -> 0.025 usdt
  });

  describe('Tests of get methods', async () => {
    beforeEach(async () => {
      await this.usdt.transfer(alice, ether('5'), { from: owner }); // 5 usdt
      await this.estt.transfer(alice, new BN('1000000'), { from: owner }); // 1 estt
      await this.usdt.approve(this.exchange.address, ether('5'), { from: alice }); // 5 usdt
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: alice }); // 1 estt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('2'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, ether('0.025'), ZERO_ADDRESS, { from: alice }); // 1 estt -> 0.025 usdt
    });

    it('should show prices and orders params', async () => {
      const price_usdt_estt_0 = await this.exchange.getNextPrice(this.usdt.address, 0);
      price_usdt_estt_0.should.be.bignumber.equal(new BN('50000000')); // 0.02 usdt for 1 estt
      const price_usdt_estt_1 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_0);
      price_usdt_estt_1.should.be.bignumber.equal(new BN('100000000')); // 0.01 usdt for 1 estt
      const price_usdt_estt_2 = await this.exchange.getNextPrice(this.usdt.address, price_usdt_estt_1);
      price_usdt_estt_2.should.be.bignumber.equal(new BN('0'));
      const price_usdt_estt_0_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_0);
      assertEqual(price_usdt_estt_0_uids.length, 1);
      const order_usdt_estt_0 = await this.exchange.getOrderByUid(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0.uid.should.be.bignumber.equal(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0.trader.should.be.equal(alice);
      order_usdt_estt_0.srcAmount.should.be.bignumber.equal(ether('2'));
      order_usdt_estt_0.destAmount.should.be.bignumber.equal(new BN('100000000'));
      order_usdt_estt_0.filled.should.be.bignumber.equal(new BN('0'));
      const price_usdt_estt_1_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_1);
      assertEqual(price_usdt_estt_1_uids.length, 3);
      const order_usdt_estt_1 = await this.exchange.getOrderByUid(price_usdt_estt_1_uids[0]);
      order_usdt_estt_1.uid.should.be.bignumber.equal(price_usdt_estt_1_uids[0]);
      order_usdt_estt_1.trader.should.be.equal(alice);
      order_usdt_estt_1.srcAmount.should.be.bignumber.equal(ether('1'));
      order_usdt_estt_1.destAmount.should.be.bignumber.equal(new BN('100000000'));
      order_usdt_estt_1.filled.should.be.bignumber.equal(new BN('0'));
      const order_usdt_estt_2 = await this.exchange.getOrderByUid(price_usdt_estt_1_uids[1]);
      order_usdt_estt_2.uid.should.be.bignumber.equal(price_usdt_estt_1_uids[1]);
      order_usdt_estt_2.trader.should.be.equal(alice);
      order_usdt_estt_2.srcAmount.should.be.bignumber.equal(ether('1'));
      order_usdt_estt_2.destAmount.should.be.bignumber.equal(new BN('100000000'));
      order_usdt_estt_2.filled.should.be.bignumber.equal(new BN('0'));
      const order_usdt_estt_3 = await this.exchange.getOrderByUid(price_usdt_estt_1_uids[2]);
      order_usdt_estt_3.uid.should.be.bignumber.equal(price_usdt_estt_1_uids[2]);
      order_usdt_estt_3.trader.should.be.equal(alice);
      order_usdt_estt_3.srcAmount.should.be.bignumber.equal(ether('1'));
      order_usdt_estt_3.destAmount.should.be.bignumber.equal(new BN('100000000'));
      order_usdt_estt_3.filled.should.be.bignumber.equal(new BN('0'));
      const price_estt_usdt_0 = await this.exchange.getNextPrice(this.estt.address, 0);
      price_estt_usdt_0.should.be.bignumber.equal(ether('0.025')); // 1 estt for 0.025 usdt
      const price_estt_usdt_1 = await this.exchange.getNextPrice(this.usdt.address, price_estt_usdt_0);
      price_estt_usdt_1.should.be.bignumber.equal(new BN('0'));
      const price_estt_usdt_0_uids = await this.exchange.getUidsByPrice(this.estt.address, price_estt_usdt_0);
      assertEqual(price_estt_usdt_0_uids.length, 1);
      const order_usdt_estt_4 = await this.exchange.getOrderByUid(price_estt_usdt_0_uids[0]);
      order_usdt_estt_4.uid.should.be.bignumber.equal(price_estt_usdt_0_uids[0]);
      order_usdt_estt_4.trader.should.be.equal(alice);
      order_usdt_estt_4.srcAmount.should.be.bignumber.equal(new BN('1000000'));
      order_usdt_estt_4.destAmount.should.be.bignumber.equal(ether('0.025'));
      order_usdt_estt_4.filled.should.be.bignumber.equal(new BN('0'));
    });

    it('should show user uids', async () => {
      const alice_orders = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders.length, 5);
      const rest_alice_address = alice.toString().substr(alice.toString().length - 8).toLowerCase();
      assertEqual(alice_orders[0].toJSON().toLowerCase(),"501" + rest_alice_address);
      assertEqual(alice_orders[1].toJSON().toLowerCase(),"102" + rest_alice_address);
      assertEqual(alice_orders[2].toJSON().toLowerCase(),"202" + rest_alice_address);
      assertEqual(alice_orders[3].toJSON().toLowerCase(),"302" + rest_alice_address);
      assertEqual(alice_orders[4].toJSON().toLowerCase(),"402" + rest_alice_address);
    });
  });

  describe('Tests of main trade methods', async () => {
    beforeEach(async () => {
      await this.usdt.transfer(alice, ether('5'), { from: owner }); // 5 usdt
      await this.usdt.approve(this.exchange.address, ether('5'), { from: alice }); // 5 usdt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('2'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 100 estt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 100 estt
    });

    it('should cancel order', async () => {
      const alice_orders_0 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_0.length, 4);
      const rest_alice_address = alice.toString().substr(alice.toString().length - 8).toLowerCase();
      const custom_uid = '0x103' + rest_alice_address; // incrrect Uid (wrong trade type)
      await expectRevert(this.exchange.cancel(web3.utils.toBN(custom_uid), { from: alice }), 'Wrong Uid');
      await expectRevert(this.exchange.cancel(alice_orders_0[0], { from: bob }), 'doesn\'t have rights to cancel order');
      await this.exchange.cancel(alice_orders_0[0], { from: alice });
      await expectRevert(this.exchange.cancel(alice_orders_0[0], { from: alice }), 'order not found');
      const alice_orders_1 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_1.length, 3);
      await this.exchange.cancel(alice_orders_1[0], { from: alice });
      await this.exchange.cancel(alice_orders_1[1], { from: alice });
      await this.exchange.cancel(alice_orders_1[2], { from: alice });
      const alice_orders_2 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_2.length, 0);
    });

    it('should support piecemeal purchases', async () => {
      await this.estt.transfer(bob, new BN('400000000'), { from: owner }); // 400 estt
      await this.estt.approve(this.exchange.address, new BN('400000000'), { from: bob }); // 400 estt
      await this.exchange.trade(this.estt.address, new BN('60000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: bob }); // 60 estt -> 1 usdt
      const price_usdt_estt_0 = await this.exchange.getNextPrice(this.usdt.address, 0);
      const price_usdt_estt_0_uids = await this.exchange.getUidsByPrice(this.usdt.address, price_usdt_estt_0);
      const order_usdt_estt_0 = await this.exchange.getOrderByUid(price_usdt_estt_0_uids[0]);
      order_usdt_estt_0.filled.should.be.bignumber.equal(ether('1.2'));
      const alice_orders_0 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_0.length, 4);
      await this.exchange.trade(this.estt.address, new BN('60000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: bob }); // 60 estt -> 1 usdt
      const bob_orders_0 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_0.length, 1);
      const alice_orders_1 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_1.length, 3);
      await this.exchange.cancel(bob_orders_0[0], { from: bob });
      const bob_orders_1 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_1.length, 0);
      await this.exchange.trade(this.estt.address, new BN('100000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: bob }); // 100 estt -> 1 usdt
      const alice_orders_2 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_2.length, 2);
      await this.exchange.trade(this.estt.address, new BN('200000000'), this.usdt.address, ether('1.5'), ZERO_ADDRESS, { from: bob }); // 200 estt -> 1.5 usdt
      const alice_orders_3 = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders_3.length, 0);
      const bob_orders_2 = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bob_orders_2.length, 0);
      (await this.estt.balanceOf(alice, { from: alice })).should.be.bignumber.equal(new BN('400000000'));
      (await this.estt.balanceOf(bob, { from: bob })).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(alice, { from: alice })).should.be.bignumber.equal(ether('0'));
      (await this.usdt.balanceOf(bob, { from: bob })).should.be.bignumber.equal(ether('5'));
    });
  });

  describe('Tests of main trade methods', async () => {
    beforeEach(async () => {
      await this.estt.transfer(alice, new BN('400000000'), { from: owner }); // 400 estt
      await this.estt.approve(this.exchange.address, new BN('400000000'), { from: alice }); // 400 estt
      await this.exchange.trade(this.estt.address, new BN('100000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: alice }); // 100 estt -> 1 usdt
      await this.exchange.trade(this.estt.address, new BN('100000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: alice }); // 100 estt -> 1 usdt
      await this.exchange.trade(this.estt.address, new BN('100000000'), this.usdt.address, ether('2'), ZERO_ADDRESS, { from: alice }); // 100 estt -> 2 usdt
      await this.exchange.trade(this.estt.address, new BN('100000000'), this.usdt.address, ether('1'), ZERO_ADDRESS, { from: alice }); // 100 estt -> 1 usdt
    });

    it('should add referral bonus', async () => {
      await this.usdt.transfer(alice, ether('5'), { from: owner }); // 5 usdt
      await this.usdt.approve(this.exchange.address, ether('5'), { from: alice }); // 5 usdt
      await this.exchange.trade(this.usdt.address, ether('1'), this.estt.address, new BN('100000000'), bob, { from: alice }); // 1 usdt -> 100 estt
      (await this.estt.balanceOf(bob, { from: bob })).should.be.bignumber.equal(new BN('50000'));
      await time.increase(new BN('86400'));
      const balance_bob_1 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_1.should.be.bignumber.lt(new BN('50011'));
      balance_bob_1.should.be.bignumber.gt(new BN('50008'));
      await time.increase(new BN('86400'));
      const balance_bob_2 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_2.should.be.bignumber.lt(new BN('50021'));
      balance_bob_2.should.be.bignumber.gt(new BN('50017'));
      await time.increase(new BN('86400'));
      const balance_bob_3 = await this.estt.balanceOf(bob, { from: bob });
      balance_bob_3.should.be.bignumber.lt(new BN('50031'));
      balance_bob_3.should.be.bignumber.gt(new BN('50026'));
      const balance_alice_1 = await this.estt.balanceOf(alice, { from: alice });
      balance_alice_1.should.be.bignumber.lt(new BN('400241000'));
      balance_alice_1.should.be.bignumber.gt(new BN('400239000'));
      await this.estt.transfer(alice, balance_bob_3, { from: bob });
      const balance_alice_2 = await this.estt.balanceOf(alice, { from: alice });
      balance_alice_2.should.be.bignumber.lt(new BN('400291000'));
      balance_alice_2.should.be.bignumber.gt(new BN('400289000'));
    });
  });
});
