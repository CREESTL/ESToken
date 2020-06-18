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

  describe('Match tests', async () => {
    // before run
    // - add function below to Exchange.sol
    // - remove first line ("return")

    // function _match (
    //     address src,
    //     uint256 srcAmount1,
    //     address dest,
    //     uint256 destAmount1,
    //     uint256 filled1,
    //     uint256 uid, // 0 if opposite should be exchange
    //     uint256 srcAmount2,
    //     uint256 destAmount2,
    //     uint256 filled2
    // ) public view returns (uint256, uint256, uint256, uint256) {
    //     MemoryOrder memory order = MemoryOrder(
    //         _msgSender(),
    //         src,
    //         srcAmount1,
    //         dest,
    //         destAmount1,
    //         filled1
    //     );
    //     Order memory opposite = Order(
    //         uid,
    //         _msgSender(),
    //         srcAmount2,
    //         destAmount2,
    //         filled2
    //     );
    //     uint256 price = _getPrice(order);
    //     uint256 availableOpposite;
    //     IERC20 erc20dest = IERC20(order.dest);
    //     if (opposite.uid != 0) {
    //         availableOpposite = (opposite.srcAmount.sub(opposite.filled)).mul(price).div(_decimals(order.dest));
    //     } else {
    //         availableOpposite = (erc20dest.balanceOf(address(this))).mul(price).div(_decimals(order.dest));
    //     }
    //     return _calcMatch(order, opposite, availableOpposite, price);
    // }

    it('should match correct and sub\add fee depends on available sum', async () => {
      return;
      await this.usdt.transfer(this.exchange.address, new BN('1000000000000'), { from: owner });
      // 1 u / 1 e = 1 e / 1 u (by exchange)
      let calc = await this.exchange._match(this.usdt.address, usdt('70000000'), this.estt.address, estt('70000000'), new BN('0'), new BN('0'), usdt('70000000'), estt('70000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(usdt('70000000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(estt('70000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), new BN('0'), new BN('0'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('1000000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('1000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.usdt.address, new BN('10000000'), this.estt.address, new BN('10000000'), new BN('0'), new BN('0'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('10000000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('10000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      // 1 u / 1 e = (1 - fee = 0.992) e / 0.992 u (by opposite)
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('8000'));
      calc = await this.exchange._match(this.usdt.address, new BN('10000000'), this.estt.address, new BN('10000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('8000'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('10000000'), new BN('10000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('1000000'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('1000000'));
      calc[3].should.be.bignumber.equal(new BN('8000'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), new BN('0'), new BN('1'), new BN('900000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('991999'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('892800'));
      calc[3].should.be.bignumber.equal(new BN('7199'));
      calc = await this.exchange._match(this.usdt.address, new BN('2000000'), this.estt.address, new BN('1800000'), new BN('0'), new BN('1'), new BN('900000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('991999'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('892800'));
      calc[3].should.be.bignumber.equal(new BN('7199'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), new BN('0'), new BN('1'), new BN('1800000'), new BN('2000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('999999'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('900000'));
      calc[3].should.be.bignumber.equal(new BN('7200'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), new BN('0'), new BN('1'), new BN('1800000'), new BN('2000000'), new BN('900000'));
      calc[0].should.be.bignumber.equal(new BN('991999'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('892800'));
      calc[3].should.be.bignumber.equal(new BN('7199'));
      calc = await this.exchange._match(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), new BN('0'), new BN('1'), new BN('903600'), new BN('1004000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('995967'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('896371'));
      calc[3].should.be.bignumber.equal(new BN('7228'));
      calc = await this.exchange._match(this.usdt.address, new BN('1004000'), this.estt.address, new BN('903600'), new BN('0'), new BN('1'), new BN('900000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('991999'));
      calc[1].should.be.bignumber.equal(new BN('0'));
      calc[2].should.be.bignumber.equal(new BN('892800'));
      calc[3].should.be.bignumber.equal(new BN('7199'));
      calc = await this.exchange._match(this.estt.address, new BN('1000000000000'), this.estt.address, new BN('1000000000000'), new BN('0'), new BN('0'), new BN('1000000000000'), new BN('1000000000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000000000'));
      calc[1].should.be.bignumber.equal(new BN('8000000000'));
      calc[2].should.be.bignumber.equal(new BN('992000000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('0'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000'));
      calc[1].should.be.bignumber.equal(new BN('8000'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('10000000'), this.usdt.address, new BN('10000000'), new BN('0'), new BN('0'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('9920000'));
      calc[1].should.be.bignumber.equal(new BN('80000'));
      calc[2].should.be.bignumber.equal(new BN('9920000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('0'), new BN('10000000'), new BN('10000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000'));
      calc[1].should.be.bignumber.equal(new BN('8000'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('992000'));
      calc[1].should.be.bignumber.equal(new BN('8000'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('10000000'), this.usdt.address, new BN('10000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('1000000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('1000000'));
      calc[1].should.be.bignumber.equal(new BN('8000'));
      calc[2].should.be.bignumber.equal(new BN('1000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('900000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('892800'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('1800000'), this.usdt.address, new BN('2000000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('900000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('900000'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('1000000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('1800000'), this.usdt.address, new BN('2000000'), new BN('900000'), new BN('1'), new BN('1000000'), new BN('900000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('892800'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('2000000'), new BN('1800000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('892800'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('2000000'), new BN('1800000'), new BN('900000'));
      calc[0].should.be.bignumber.equal(new BN('892800'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('903600'), this.usdt.address, new BN('1004000'), new BN('0'), new BN('1'), new BN('1000000'), new BN('900000'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('896372'));
      calc[1].should.be.bignumber.equal(new BN('7228'));
      calc[2].should.be.bignumber.equal(new BN('995968'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      calc = await this.exchange._match(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), new BN('0'), new BN('1'), new BN('1004000'), new BN('903600'), new BN('0'));
      calc[0].should.be.bignumber.equal(new BN('892800'));
      calc[1].should.be.bignumber.equal(new BN('7200'));
      calc[2].should.be.bignumber.equal(new BN('992000'));
      calc[3].should.be.bignumber.equal(new BN('0'));
      // for (let key in calc) {
      //   console.log("\t\t", calc[key].toString(10));
      // }
      // const esttBalance = await this.usdt.balanceOf(owner, { from: owner });
      // console.log("\t\t", esttBalance.toString(10));
    });
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
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      //estt
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      const response = await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob });
      console.log('\tgas used =', response.receipt.gasUsed);
      const bobOrders = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrders.length, 0);
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('992000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('8000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999992000'));
    });

    it('should remove bad opposite', async () => {
      await this.usdt.transfer(carol, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: carol });
      await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: carol });
      await this.usdt.approve(this.exchange.address, new BN('0'), { from: carol });
      await this.estt.transfer(bob, new BN('900000'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('900000'), { from: bob });
      const response = await this.exchange.trade(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob });
      const bobOrders = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrders.length, 1);
      const order = await this.exchange.getOrderByUid(bobOrders[0], { from: bob });
      expect(order[1]).to.be.equal(bob);
      expect(order[2].toString(10)).to.be.equal('900000');
      expect(order[3].toString(10)).to.be.equal('1000000');
      expect(order[4].toString(10)).to.be.equal('0');
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('900000'));
      const carolOrders = await this.exchange.getMyOrders({ from: carol });
      assertEqual(carolOrders.length, 0);
    });

    it('should place few orders continue trade', async () => {
      // return;
      await this.estt.transfer(bob, estt('5000000'), { from: owner });
      await this.estt.approve(this.exchange.address, estt('5000000'), { from: bob });
      await this.usdt.approve(this.exchange.address, usdt('700000000'), { from: owner });
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(estt('70000000'));
      await this.exchange.trade(this.usdt.address, usdt('70000000'), this.estt.address, estt('70000000'), ZERO_ADDRESS, { from: owner }); // 1 usdt -> 1 estt
      //             let uidss = await this.exchange.getMyOrders({ from: owner });
      //       console.log("\t\t\t", uidss.length);
      //       let orderr = [];
      //       if (uidss.length > 0)
      //       orderr = await this.exchange.getOrderByUid(uidss[0], { from: owner });
      //       for (let key in orderr) {
      //         console.log("\t\t", orderr[key].toString(10));
      //       }
      // return;
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(estt('0'));
      let response;
      let amount1 = usdt('1');
      let amount2 = estt('1');
      let total1 = new BN('0');
      let total2 = new BN('0');
      let count = 50;
      for (let i = 0; i < count; ++i) {
        amount1 = amount1.add(new BN('1'));
        response = await this.exchange.trade(this.estt.address, amount2, this.usdt.address, amount1, ZERO_ADDRESS, { from: bob });
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
        response = await this.exchange.continueTrade(uids[0], { from: owner });
        console.log("\ttrade USDT/EST gas used =", response.receipt.gasUsed, "(continue)");
        uids = await this.exchange.getMyOrders({ from: bob });
        console.log("\tfilled orders =", count - uids.length, "/", count);
        count = uids.length;
      }
      expect(uids.length).to.be.equal(0);

      uids = await this.exchange.getMyOrders({ from: owner });
      let order = await this.exchange.getOrderByUid(uids[0], { from: owner });
      expect(order[4].toString(10)).to.be.equal('49601225');
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
      await this.estt.transfer(bob, new BN('1000000'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.estt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
      const bobOrdersCount = await this.exchange.getMyOrders({ from: bob });
      assertEqual(bobOrdersCount.length, 0);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('992000'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('8000'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000992000'));
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
      await this.estt.transfer(carol, new BN('900000'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('900000'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: carol });
      let count = await this.exchange.getMyOrders({ from: carol });
      assertEqual(count.length, 1);
      //usdt
      await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
      await this.usdt.approve(this.exchange.address, new BN('1000000'), { from: bob });
      (await this.usdt.allowance(bob, this.exchange.address, { from: bob })).should.be.bignumber.equal(new BN('1000000'));
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
      (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
      (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
      const response = await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('900000'), ZERO_ADDRESS, { from: bob });
      count = await this.exchange.getMyOrders({ from: bob });
      assertEqual(count.length, 1);
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('892800'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('8001'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('991999'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('1'));
    });

    it('should have correct fee usdt/estt 1.0/0.9 (needed > opposite)', async () => {
      await this.estt.transfer(carol, new BN('900000'), { from: owner });
      await this.estt.approve(this.exchange.address, new BN('900000'), { from: carol });
      await this.exchange.trade(this.estt.address, new BN('900000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: carol });
      let count = await this.exchange.getMyOrders({ from: carol });
      assertEqual(count.length, 1);
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
      (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('892800'));
      (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('1008001'));
      (await this.usdt.balanceOf(carol)).should.be.bignumber.equal(new BN('991999'));
      (await this.estt.balanceOf(carol)).should.be.bignumber.equal(new BN('1'));
    });
  });

  describe('Negative tests', async () => {
    it('should remove orders if allowance is low', async () => {
      return;
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
