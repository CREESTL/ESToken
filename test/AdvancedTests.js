const {
    BN,
    constants,
    expectRevert,
    time,
} = require('openzeppelin-test-helpers');

require('chai')
    .use(require('chai-as-promised'))
    .should();

const { ZERO_ADDRESS } = constants;

const ESToken = artifacts.require('ESToken');
const Exchange = artifacts.require('Exchange');
const USDToken6 = artifacts.require('USDToken6');

const assertEqual = (a, b) => assert.isTrue(Object.is(a, b), `Expected ${a.toString()} to equal ${b.toString()}`);

contract('Exchange', async ([owner, alice, bob]) => {
    beforeEach(async () => {
        this.estt = await ESToken.new({from: owner});
        this.usdt = await USDToken6.new({from: owner});
        this.exchange = await Exchange.new(this.estt.address, this.usdt.address, {from: owner});
        await this.estt.init(this.exchange.address, {from: owner});
    });

    describe('Orders tests', async () => {
        it('should instant buy ESTT by 1:1 price', async () => {
            //usdt
            await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
            await this.usdt.increaseAllowance(this.exchange.address, new BN('1000000'), { from: bob });
            (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
            (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('0'));
            (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('70000000000000'));
            await this.exchange.trade(this.usdt.address,  new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
            const bob_orders_0 = await this.exchange.getMyOrders({ from: bob });
            assertEqual(bob_orders_0.length, 0);
            (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('1000000'));
            (await this.usdt.balanceOf(bob)).should.be.bignumber.equal( new BN('0'));
            (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
            (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
        });

        it ('should instant sell ESTT by 1:1 price', async () => {
            // "before" block
            await this.usdt.transfer(bob, new BN('1000000'), { from: owner });
            await this.usdt.increaseAllowance(this.exchange.address, new BN('1000000'), { from: bob });
            await this.exchange.trade(this.usdt.address,  new BN('1000000'), this.estt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
            //estt
            (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('1000000'));
            (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999000000'));
            await this.estt.approve(this.exchange.address, new BN('1000000'), { from: bob });
            (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
            await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, new BN('1000000'), ZERO_ADDRESS, { from: bob }); // 1 usdt -> 1 estt
            const bob_orders_1 = await this.exchange.getMyOrders({ from: bob });
            assertEqual(bob_orders_1.length, 0);
            (await this.usdt.balanceOf(bob)).should.be.bignumber.equal(new BN('992000'));
            (await this.estt.balanceOf(bob)).should.be.bignumber.equal(new BN('0'));
            (await this.usdt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('8000'));
            (await this.estt.balanceOf(this.exchange.address)).should.be.bignumber.equal(new BN('69999999992000'));
        });
    });

    describe('Negative tests', async () => {
        it('should remove orders if allowance is low', async () => {
            // block "before"
            await this.usdt.transfer(alice, new BN('5000000'), {from: owner}); // 5 usdt
            await this.estt.transfer(alice, new BN('1000000'), {from: owner}); // 1 estt
            await this.usdt.approve(this.exchange.address, new BN('5000000'), {from: alice}); // 5 usdt
            await this.estt.approve(this.exchange.address, new BN('1000000'), {from: alice}); // 1 estt

            await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
            await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
            await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 2 usdt -> 0.1 estt
            await this.exchange.trade(this.usdt.address, new BN('1000000'), this.estt.address, new BN('100000'), ZERO_ADDRESS, {from: alice}); // 1 usdt -> 0.1 estt
            await this.usdt.approve(this.exchange.address, new BN('0'), {from: alice});
            await this.exchange.trade(this.estt.address, new BN('1000000'), this.usdt.address, new BN('5000000'), ZERO_ADDRESS, {from: alice}); // 1 estt -> 5 usdt
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
