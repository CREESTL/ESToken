pragma solidity ^0.6.0;

import "./ESToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Exchange is Ownable {
    ESToken private esToken;
    constructor (address esTokenAddress) public {
        ESToken potentialESToken = ESToken(esTokenAddress);
        require(potentialESToken.decimals() == 6, "address does not match the ESToken");
        esToken = potentialESToken;
    }
}
