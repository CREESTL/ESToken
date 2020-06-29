ES Token Contract
=================

**Requirements** 

- nodeJS v8.10.0 or later
- npm v6.13.0 or later
- truffle v5.1.22 or later

**Installation**

- git submodule init update
- npm i

**Run tests**

- npm run lint
- npm run test

**Make Flattened contract file**

- npm run flatten

**Deploy**

- to log in to the metamask, make sure ETH is enough (open remix after login to metamask)
- save privKey from an account that's gonna be used for deploy. It's a contract owner! If you lose the key, you'll lose access to all tokens.
- prepare the remix (https://remix.ethereum.org, turn on "solidity compiler" and "deploy and run trunsactions" plug-ins)
- copy the code of all contracts into the remix (all content of flattened.sol file)
- choose compiler version 0.6.2
- compile (ensure that Enable optimization (under compile button) is set)
- select ENVIRONMENT - Injected Web3 (will appear under the selected item eth mainnet).
- in the window "deploy and run trunsactions" select ESToken contract, press Deploy.
- wait for the transaction to be published
- choose an Exchange contract
- next to the "deploy field", enter the address of just deployed ESToken and USDT, for example:
0x7cC0742Ce292dDc9a35C32b8f6F33815f14f85f, 0xdac17f958d2ee523a2206206994597c13d831ec7
- press Deploy 
- waiting for the contract to deploy
- select ESToken contract (click on address to expand), find init function.
- enter the address of the newly Exchange contract in the field next to it (for example: 0x72e07c609576804D27F781ee0D844D2fba0EA1af)
- then press init

**change interests**

- set daily interest (token), 18 decimals

await this.esToken.setDailyInterest(new BN('1000200000000000000'), { from: owner });

- set referral interest (token), 18 decimals

await this.esToken.setReferralInterest(new BN('1000100000000000000'), { from: owner });

- set referral bonus (exchange), 18 decimals

await this.exchange.setReferralBonus(new BN('1000500000000000000'), { from: owner });

- set exchange fee (exchange), 18 decimals

await this.exchange.setExchangeFee(new BN('1008000000000000000'), { from: owner });

- set min estt price (exchange), 6 decimals (from 1 to 9999)

await this.exchange.setMinPrice(new BN('1000000'), { from: owner });
