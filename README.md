# Poker NFT Marketplace

This repository contains contracts of poker game cards marketplace

#### Table on contents
[Prerequisites](#preq)
[Build & Deploy](#build_and_deploy)  
[Wallets](#wallets)  

<a name="preq"/>
### Prerequisites 
- Install [Node.js](https://nodejs.org/en/download/)
- Clone this repository
- Navigate to the directory with the cloned code
- Install [Hardhat](https://hardhat.org/) with `npm install --save-dev hardhat`
- Install [Truffle](https://trufflesuite.com/docs/truffle/getting-started/installation/) with `npm install -g truffle`
- Create a [MetaMask](https://metamask.io/) wallet
  - Install MetaMask Chrome extension
  - Add [BSC Mainnet](https://academy.binance.com/en/articles/connecting-metamask-to-binance-smart-chain) to MetaMask
  - Add [BSC Chapel Testnet](https://academy.binance.com/en/articles/connecting-metamask-to-binance-smart-chain) to MetaMask
- Create an account on [BSCScan](https://bscscan.com/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
   BSCSCAN_API_KEY=***your API key***
    ```
- Create a file called `.env` in the root of the project with the same contents as `.env.example`
- Copy your wallet's private key (see [Wallets](#wallets)) to `.env` file
```
ACC_PRIVATE_KEY=***your private key***
```
:warning:__DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS__:warning:

<a name="build_and_deploy"/>
### Build & Deploy  
The following information will guide you through the process of building and deploying the contracts yourself.


#### 1. Build
```
npx hardhat compile
```

#### 2. Test
```
truffle test
```
Move to the "Deploy" step __only__ if all tests pass!

#### 3. Deploy
а) __Chapel__ test network  
Make sure you have _enough test BNB_ tokens for testnet in your wallet ([Wallets](#wallets)) . You can get it for free from [faucet](https://testnet.binance.org/faucet-smart).  
```
npx hardhat run scripts/deploy.js --network chapel
```  
b) __BSC__ main network  
Make sure you have _enough real BNB_ tokens in your wallet ([Wallets](#wallets)). Deployment to the mainnet costs __real__ BNB!
```
npx hardhat run scripts/deploy.js --network bsc
```
Deploy to testnet/mainnet takes more than 1.5 minutes to complete. Please, be patient.  

After contracts get deployed, you can find their addresses in `scripts/remote/deployOutput.json` file. 

Please note that all deployed contracts __are verified__ on either [BscScan](https://bscscan.com/) or [BscTestScan](https://testnet.bscscan.com/). 

<a name="wallets"/>
### Wallets
For deployment you will need to use either _your existing wallet_ or _a generated one_. 

#### Using existing wallet
If you choose to use your existing wallet, then you will need to be able to export (copy/paste) its private key. For example, you can export private key from your MetaMask wallet.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#preq)).  

#### Creating a new wallet
If you choose to create a fresh wallet for this project, you should use `createWallet.js` script :
```
npx hardhat run scripts/createWallet.js
```
This will generate a single new wallet and show its address and private key. __Save them somewhere else! __
A new wallet _does not_ hold any tokens. You have to provide it with tokens of your choice.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#prerequisites)).