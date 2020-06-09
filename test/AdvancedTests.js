const {
  BN,
  constants,
  expectRevert,
  time,
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
    this.estt = await ESToken.new({ from: owner });
    this.usdt = await TetherToken.new(new BN('1000000000000000000000'), 'USDT', 'USDT', new BN('6'), { from: owner });
    this.exchange = await Exchange.new(this.estt.address, this.usdt.address, { from: owner });
    await this.estt.init(this.exchange.address, { from: owner });
  });

  describe('Orders tests', async () => {
    it('should instant buy ESTT by 1:1 price', async () => {
      await this.usdt.transfer(carol, new BN('1000000'), { from: owner });
      await this.usdt.approve(alice, new BN('1000000'), { from: carol });
      await this.usdt.transferFrom(carol, alice, new BN('1000000'), { from: alice });
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      console.log('\tgas used =', response.receipt.gasUsed);
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
    });

    it('should instant sell ESTT by 1:1 price', async () => {
      await this.usdt.transfer(bob, new BN('1008000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1008000'), { from: bob });
      await this.exchange.trade(this.usdt.address, new BN('1008000'), this.estt.address, new BN('1008000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      //estt
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1008000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999998992000'));
      await this.estt.approve(this.exchange.address, new BN('1008000'), { from: bob });
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      const response = await this.exchange.trade(this.estt.address, new BN('1008000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob });
      console.log('\tgas used =', response.receipt.gasUsed);
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 0);
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('8000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999992000'));
    });

    it('should place few orders continue trade', async () => {
      await this.estt.transfer(bob, estt('5000000'), { from: owner });
      await this.estt.approve(this.exchange.address, estt('5000000'), { from: bob });
      await this.usdt.approve(this.exchange.address, usdt('700000000'), { from: owner });
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(estt('70000000'));
      await this.exchange.trade(this.usdt.address, usdt('70000000'), this.estt.address, estt('70000000'), ZERO_ADDRESS, { from: owner }); // 1 usdt -> 1 estt
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(estt('0'));
      let response;
      let amount1 = usdt('1');
      let amount2WithFee = estt('1').add(new BN('8000'));
      let amount2 = estt('1');
      let total1 = new BN('0');
      let total2 = new BN('0');
      let count = 50;
      for (let i = 0; i < count; ++i) {
        amount1 = amount1.add(new BN('1'));
        response = await this.exchange.trade(this.estt.address, amount2WithFee, this.usdt.address, amount1, ZERO_ADDRESS, { from: bob });
        total1 = total1.add(amount1);
        total2 = total2.add(amount2);
        console.log("\ttrade EST/USDT gas used =", response.receipt.gasUsed);
      }
      total1 = amount1.mul(new BN(count));

      let uids = await this.exchange.getMyOrders({ from: bob });
      expect(uids.length).to.be.equal(count);
  
      console.log("\ttrade EST/USDT", total1.toString(10), total2.toString(10));
      response = await this.exchange.trade(this.usdt.address, total1, this.estt.address, total2, ZERO_ADDRESS, { from: owner });
      console.log("\ttrade USDT/EST gas used =", response.receipt.gasUsed);
      uids = await this.exchange.getMyOrders({ from: bob });
      console.log("\tfilled orders =", count - uids.length, "/", count);
      count = uids.length;
      expect(uids.length).not.to.be.equal(0);
  
      uids = await this.exchange.getMyOrders({ from: owner });
      expect(uids.length).to.be.equal(1);
      response = await this.exchange.continueTrade(uids[0], { from: owner });
      console.log("\ttrade USDT/EST gas used =", response.receipt.gasUsed, "(continue)");
      uids = await this.exchange.getMyOrders({ from: bob });
      console.log("\tfilled orders =", count - uids.length, "/", count);
      count = uids.length;
      if (uids.length > 0) {
        uids = await this.exchange.getMyOrders({ from: owner });
        // let order = await this.exchange.getOrderByUid(uids[0], { from: owner });
        // for (let key in order) {
        //   console.log(order[key].toString(10));
        // }
        // let price = 0;
        // do {
        //   price = await this.exchange.getNextPrice(this.estt.address, price);
        //   console.log("\t", price.toString(10));
        //   const orders = await this.exchange.getUidsByPrice(this.estt.address, price);
        //   for (let i in orders) {
        //     order = await this.exchange.getOrderByUid(orders[i], { from: owner });
        //     for (let key in order) {
        //       console.log("\t\t", order[key].toString(10));
        //     }
        //   }
        // } while (price != 0);
        response = await this.exchange.continueTrade(uids[0], { from: owner });
        // response = await this.exchange.trade(this.usdt.address, total1, this.estt.address, total2, ZERO_ADDRESS, { from: owner });
        console.log("\ttrade USDT/EST gas used =", response.receipt.gasUsed, "(continue)");
        uids = await this.exchange.getMyOrders({ from: bob });
        console.log("\tfilled orders =", count - uids.length, "/", count);
        count = uids.length;
      }
      expect(uids.length).to.be.equal(0);

      uids = await this.exchange.getMyOrders({ from: owner });
      let order = await this.exchange.getOrderByUid(uids[0], { from: owner });
      expect(order[5].toString(10)).to.be.equal('50001275');
      
      // for (let key in order) {
      //   console.log(order[key].toString(10));
      // }
      // console.log((await this.usdt.balanceOf(bob)).toString());
      // expect(uids.length).to.be.equal(0);

      // console.log((await this.exchange.getMyOrders({ from: bob })).length);
      // console.log((await this.exchange.getMyOrders({ from: owner })).length);
    });
  
  });

  describe('Fee tests', async () => {
    // fee substructed from any estt sell sum, except case when estt seller is the exchange
    it('should have correct fee usdt/estt 1/1', async () => {
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      // bob buy 1 estt for 1 usdt in exchange, without fee cause 1/1 using exchange
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
    });

    it('should have correct fee estt/usdt 1/1', async () => {
      await this.usdt.transfer(this.exchange.address, new BN('1000000'), { from: owner });
      await this.estt.transfer(bob, new BN('1008000'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('1008000'), { from: bob });
      (await this.estt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1008000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      // bob buy 1 usdt for 1 estt in exchange, fee 0.8% will be substracted from given estt amount
      await this.exchange.trade(this.estt.address, new BN('1008000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000001000000'));
    });

    it('should have correct fee estt/usdt 0.9/1.0 (needed <= opposite)', async () => {
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 1);
      // 900000 + fee 7200 (0.8 %)
      await this.estt.transfer(carol, new BN('907200'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('907200'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('907200'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: carol });
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('900000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('0'));
    });

    it('should have correct fee estt/usdt 0.9/1.0 (needed > opposite)', async () => {
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: bob });
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 1);
      await this.estt.transfer(carol, new BN('1814400'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('1814400'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('1814400'), this.usdt.address, new BN('2000000'), ZERO_ADDRESS, { from: carol });
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('900000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('907200'));
    });

    it('should have correct fee usdt/estt 1.0/0.9 (needed <= opposite)', async () => {
      await this.estt.transfer(carol, new BN('907200'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('907200'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('907200'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: carol });
      let count = await this.exchange.getMyOrders({ from: carol });
      assertEqual(count.length, 1);
          // let uids = await this.exchange.getMyOrders({ from: carol });
          // let order = await this.exchange.getOrderByUid(uids[0], { from: owner });
          // for (let key in order) {
          //   console.log("\t\t", order[key].toString(10));
          // }
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      // const r = await this.exchange.trado(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: bob });
      //     for (let key in r) {
      //       console.log("\t\t\t", r[key].toString(10));
      //     }
      // return;
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: bob });
      count = await this.exchange.getMyOrders({ from: bob });
          // uids = await this.exchange.getMyOrders({ from: bob });
          // order = await this.exchange.getOrderByUid(uids[0], { from: owner });
          // for (let key in order) {
          //   console.log("\t\t", order[key].toString(10));
          // }
          // return;
      assertEqual(count.length, 0);
      // 900000 + fee 7200 (0.8 %)
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('899999'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('1'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('999999'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('1'));
    });

    it('should have correct fee usdt/estt 1.0/0.9 (needed > opposite)', async () => {
      await this.estt.transfer(carol, new BN('907200'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('907200'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('907200'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: carol });
      let count = await this.exchange.getMyOrders({ from: carol });
      assertEqual(count.length, 1);
      // let uids = await this.exchange.getMyOrders({ from: carol });
      // let order = await this.exchange.getOrderByUid(uids[0], { from: owner });
      // for (let key in order) {
      //   console.log("\t\t", order[key].toString(10));
      // }
      //usdt
      await this.usdt.transfer(bob, new BN('2000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('2000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('2000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      const response = await this.exchange.trade(this.usdt.address, new BN('2000000'), this.estt.address, new BN('1800000'), ZERO_ADDRESS, { from: bob });
      count = await this.exchange.getMyOrders({ from: bob });
      assertEqual(count.length, 1);
      // let r = await this.exchange.trado(this.usdt.address, new BN('2000000'), this.estt.address, new BN('1800000'), true, { from: bob });
      //     for (let key in r) {
      //       console.log("\t\t\t", r[key].toString(10));
      //     }
      //     r = await this.exchange.trado(this.usdt.address, new BN('2000000'), this.estt.address, new BN('1800000'), false, { from: bob });
      //     for (let key in r) {
      //       console.log("\t\t\t", r[key].toString(10));
      //     }
      // 900000 + fee 7200 (0.8 %)
      // return;
      // console.log((await this.estt.balanceOf(bob)).toString(10));
      // console.log((await this.usdt.balanceOf(bob)).toString(10));
      // console.log((await this.usdt.balanceOf(carol)).toString(10));
      // console.log((await this.estt.balanceOf(carol)).toString(10));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('899999'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000001'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('999999'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('1'));
    });


  });

  describe('Negative tests', async () => {
    it('should remove orders if allowance is low', async () => {
      await this.usdt.transfer(alice, new BN('5000000'), { from: owner }); // 5 usdt
      await this.estt.transfer(alice, new BN('1000000'), { from: owner }); // 1 estt
      await this.usdt.approve(this.exchange.address, new BN('5000000'), { from: alice }); // 5 usdt
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: alice }); // 1 estt
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 2 usdt -> 0.1 estt
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, { from: alice }); // 1 usdt -> 0.1 estt
      await this.usdt.approve(this.exchange.address, new BN('0'), { from: alice });
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, new BN('5000000'), ZERO_ADDRESS, { from: alice }); // 1 estt -> 5 usdt
      const alice_orders = await this.exchange.getMyOrders({ from: alice });
      assertEqual(alice_orders.length, 1);
    });
  });

  describe('Gas tests', async () => {
    // // require remove "onlyExchange" modifier from "setParentReferral" func
    // // WARNING THIS TEST IS VERY SLOW (10-15 min)!!!!!!!!!
    // for (let N = 1; N <= 50; ++N) {
    //     const name = 'should support ' + N + ' referrals'
    //     it(name, async () => {
    //         await this.estt.transfer(alice, new BN('1000000'), {from: owner}); // 1 estt
    //         for (let i = 0; i < N; ++i) {
    //             await this.estt.setParentReferral(alice, bob, new BN('0'));
    //         }
    //         (await this.estt.parentReferral(alice)).should.be.equal(bob);
    //         const referrals = await this.estt.getMyReferrals({from: bob});
    //         assertEqual(referrals.length, N);
    //         (referrals[0]).should.be.equal(alice);
    //         await time.increase(new BN('86400'));
    //         const balance_bob_1 = await this.estt.balanceOf(bob, {from: bob});
    //         balance_bob_1.should.be.bignumber.lt(new BN('100').mul(new BN(N)).add(new BN('10')));
    //         balance_bob_1.should.be.bignumber.gt(new BN('100').mul(new BN(N)).sub(new BN('10')));
    //         const params = await this.estt.transfer(alice, balance_bob_1, {from: bob});
    //         console.log('gas used:', params.receipt.gasUsed);
    //     });
    // }
  });
});
