const {
  BN,
  constants,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

require("chai").use(require("chai-as-promised")).should();

const { ZERO_ADDRESS } = constants;

const ESToken = artifacts.require("ESToken");
const Exchange = artifacts.require("Exchange");
const TetherToken = artifacts.require("TetherToken");

contract("ESToken", async ([owner, alice, bob]) => {
  const RESERVE_ADDRESS = "0x0000000000000000000000000000000000000001";

  describe("Constructor tests", async () => {
    it("should create ESToken contract and show default parameters", async () => {
      const esToken = await ESToken.new({ from: owner });

      (await esToken.name.call()).should.be.equal("ESToken");
      (await esToken.symbol.call()).should.be.equal("ESTT");
      (await esToken.decimals.call()).should.be.bignumber.equal(new BN("6"));
      (await esToken.totalSupply.call()).should.be.bignumber.equal(new BN("0"));
      (await esToken.reserveAddress()).should.be.equal(ZERO_ADDRESS);
      (await esToken.exchangeAddress()).should.be.equal(ZERO_ADDRESS);
      (await esToken.dailyInterest()).should.be.bignumber.equal(
        new BN("1000300000000000000")
      ); // 1 + 0.03%
    });
  });

  describe("Parameters tests", async () => {
    beforeEach(async () => {
      this.esToken = await ESToken.new({ from: owner });
      this.usdt = await TetherToken.new(
        new BN("1000000000000000000000"),
        "USDT",
        "USDT",
        new BN("6"),
        { from: owner }
      );
      this.exchange = await Exchange.new(
        this.esToken.address,
        this.usdt.address,
        { from: owner }
      );
    });

    it("should initialize", async () => {
      this.esToken = await ESToken.new({ from: owner });
      (await this.esToken.totalSupply.call()).should.be.bignumber.equal(
        new BN("0")
      );
      (await this.esToken.reserveAddress()).should.be.equal(ZERO_ADDRESS);
      (await this.esToken.exchangeAddress()).should.be.equal(ZERO_ADDRESS);

      await expectRevert(
        this.esToken.init(this.exchange.address, { from: alice }),
        "Ownable: caller is not the owner"
      );
      await expectRevert(
        this.esToken.init(ZERO_ADDRESS, { from: owner }),
        "revert"
      );
      await this.esToken.init(this.exchange.address, { from: owner });
      await expectRevert(
        this.esToken.init(this.exchange.address, { from: owner }),
        "ESToken: re-initialization"
      );

      (await this.esToken.totalSupply.call()).should.be.bignumber.equal(
        new BN("100000000000000")
      ); // 100_000_000.000000
      (await this.esToken.reserveAddress()).should.be.equal(RESERVE_ADDRESS);
      (await this.esToken.exchangeAddress()).should.be.equal(
        this.exchange.address
      );
      (
        await this.esToken.balanceOf(this.exchange.address)
      ).should.be.bignumber.equal(new BN("70000000000000")); // 70_000_000.000000
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.equal(
        new BN("25000000000000")
      ); // 25_000_000.000000
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(
        new BN("5000000000000")
      ); //  5_000_000.000000
    });

    it("should set/get daily interest", async () => {
      await this.esToken.init(this.exchange.address, { from: owner });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(
        new BN("1000300000000000000")
      ); // 1 + 0.03%

      await expectRevert(
        this.esToken.setDailyInterest(new BN("999999999999999999"), {
          from: owner,
        }),
        "ESToken: negative daily interest"
      );
      await expectRevert(
        this.esToken.setDailyInterest(new BN("1000000000000000000"), {
          from: alice,
        }),
        "Ownable: caller is not the owner"
      );

      await this.esToken.setDailyInterest(new BN("1000000000000000000"), {
        from: owner,
      });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(
        new BN("1000000000000000000")
      ); // 1 + 0.0%

      await this.esToken.setDailyInterest(new BN("1001000000000000000"), {
        from: owner,
      });
      (await this.esToken.dailyInterest()).should.be.bignumber.equal(
        new BN("1001000000000000000")
      ); // 1 + 0.1%
    });

    it("should set/get referral interest", async () => {
      await this.esToken.init(this.exchange.address, { from: owner });
      (await this.esToken.referralInterest()).should.be.bignumber.equal(
        new BN("1000100000000000000")
      ); // 1 + 0.01%

      await expectRevert(
        this.esToken.setReferralInterest(new BN("999999999999999999"), {
          from: owner,
        }),
        "ESToken: negative referral interest"
      );
      await expectRevert(
        this.esToken.setReferralInterest(new BN("1000000000000000000"), {
          from: alice,
        }),
        "Ownable: caller is not the owner"
      );

      await this.esToken.setReferralInterest(new BN("1000000000000000000"), {
        from: owner,
      });
      (await this.esToken.referralInterest()).should.be.bignumber.equal(
        new BN("1000000000000000000")
      ); // 1 + 0.0%

      await this.esToken.setReferralInterest(new BN("1002000000000000000"), {
        from: owner,
      });
      (await this.esToken.referralInterest()).should.be.bignumber.equal(
        new BN("1002000000000000000")
      ); // 1 + 0.2%
    });
  });

  describe("Methods tests", async () => {
    beforeEach(async () => {
      this.esToken = await ESToken.new({ from: owner });
      this.usdt = await TetherToken.new(
        new BN("1000000000000000000000"),
        "USDT",
        "USDT",
        new BN("6"),
        { from: owner }
      );
      this.exchange = await Exchange.new(
        this.esToken.address,
        this.usdt.address,
        { from: owner }
      );
      await this.esToken.init(this.exchange.address, { from: owner });
    });

    it("should get balance", async () => {
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(
        new BN("5000000000000")
      ); //  5_000_000.000000
      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(
        new BN("0")
      );

      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });

      (await this.esToken.balanceOf(alice)).should.be.bignumber.equal(
        new BN("1000000000000")
      ); //  1_000_000.000000
      (await this.esToken.balanceOf(owner)).should.be.bignumber.equal(
        new BN("4000000000000")
      ); //  4_000_000.000000
    });

    it("should accrued interest", async () => {
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });
      await this.esToken.transfer(bob, new BN("1000000000000"), {
        from: owner,
      });
      const balance_alice_0 = await this.esToken.balanceOf(alice);
      balance_alice_0.should.be.bignumber.lt(new BN("1000000010000")); // ~ 1_000_000.000000
      balance_alice_0.should.be.bignumber.gt(new BN("999999990000"));
      await time.increase(new BN("86400"));
      const balance_alice_1 = await this.esToken.balanceOf(alice);
      balance_alice_1.should.be.bignumber.lt(new BN("1000300010000")); // +300.000000 (clear interest)
      balance_alice_1.should.be.bignumber.gt(new BN("1000199990000"));
      await this.esToken.transfer(owner, balance_alice_1, { from: alice });
      const balance_alice_2 = await this.esToken.balanceOf(alice);
      balance_alice_2.should.be.bignumber.lt(new BN("3500"));
    });

    it("should calculate compound interest right", async () => {
      // first try
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });
      await this.esToken.transfer(bob, new BN("1000000000000"), {
        from: owner,
      });
      for (let i = 0; i < 50; ++i) {
        await time.increase(new BN("8640"));
        await this.esToken.accrueInterest({ from: bob });
      }
      const balance_alice_1 = await this.esToken.balanceOf(alice);
      balance_alice_1.should.be.bignumber.lt(new BN("1001502000000")); // +1000.000000 (clear interest) +less0.500000 (compound interest)
      balance_alice_1.should.be.bignumber.gt(new BN("1000999990000")); // great that  +1000.000000 (clear interest)
      const balance_bob_1 = await this.esToken.balanceOf(bob);
      balance_bob_1.should.be.bignumber.lt(new BN("1001502000000")); // +1000.000000 (clear interest) +less0.500000 (compound interest)
      balance_bob_1.should.be.bignumber.gt(new BN("1000999990000")); // great that  +1000.000000 (clear interest)
      await this.esToken.transfer(owner, balance_alice_1, { from: alice });
      await this.esToken.transfer(owner, balance_bob_1, { from: bob });
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.lt(
        new BN("24998000000000")
      ); // -2_001.000000
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.gt(
        new BN("24996997773000")
      );
      // second try
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });
      await this.esToken.transfer(bob, new BN("1000000000000"), {
        from: owner,
      });
      await time.increase(new BN("432000"));
      await this.esToken.accrueInterest({ from: alice });
      const balance_alice_2 = await this.esToken.balanceOf(alice);
      balance_alice_2.should.be.bignumber.lt(new BN("1001500000000")); // +1000.000000 (clear interest)
      balance_alice_2.should.be.bignumber.gt(new BN("1000999990000")); // great that  +1000.000000 (clear interest)
      const balance_bob_2 = await this.esToken.balanceOf(bob);
      balance_bob_2.should.be.bignumber.lt(new BN("1001500000000")); // +1000.000000 (clear interest)
      balance_bob_2.should.be.bignumber.gt(new BN("1000999990000")); // great that  +1000.000000 (clear interest)
      await this.esToken.transfer(owner, balance_alice_2, { from: alice });
      await this.esToken.transfer(owner, balance_bob_2, { from: bob });
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.lt(
        new BN("24996000000000")
      ); // -4_001.000000
      (await this.esToken.balanceOf(RESERVE_ADDRESS)).should.be.bignumber.gt(
        new BN("24993997773070")
      );
    });

    it("should calculate holders counter right", async () => {
      (
        await this.esToken.holdersCounter({ from: alice })
      ).should.be.bignumber.equal(new BN("3"));
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });
      (
        await this.esToken.holdersCounter({ from: alice })
      ).should.be.bignumber.equal(new BN("4"));
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: owner,
      });
      (
        await this.esToken.holdersCounter({ from: alice })
      ).should.be.bignumber.equal(new BN("4"));
      await this.esToken.transfer(bob, new BN("1000000000000"), {
        from: owner,
      });
      (
        await this.esToken.holdersCounter({ from: alice })
      ).should.be.bignumber.equal(new BN("5"));
      await this.esToken.transfer(alice, new BN("1000000000000"), {
        from: bob,
      });
      (await this.esToken.balanceOf(bob)).should.be.bignumber.equal(
        new BN("0")
      );
      (
        await this.esToken.holdersCounter({ from: alice })
      ).should.be.bignumber.equal(new BN("4"));
    });
  });

  after(async () => {
    await ESToken.deployed().then(async (instance) => {
      const bytecode = instance.constructor._json.bytecode;
      const deployed = instance.constructor._json.deployedBytecode;
      const sizeOfB = bytecode.length / 2;
      const sizeOfD = deployed.length / 2;
      console.log("\n    ESToken size of bytecode in bytes =", sizeOfB);
      console.log("    ESToken size of deployed in bytes =", sizeOfD);
      console.log(
        "    ESToken initialisation and constructor code in bytes =",
        sizeOfB - sizeOfD
      );
      const receipt = await web3.eth.getTransactionReceipt(
        this.esToken.transactionHash
      );
      console.log("    ESToken deploy gas =", receipt.gasUsed);
    });
  });
});
