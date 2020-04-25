pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ESToken.sol";

contract Exchange is Ownable {
    using SafeMath for uint256;
    using Address for address;

    ESToken private esToken;

    constructor (address esTokenAddress) public {
        ESToken potentialESToken = ESToken(esTokenAddress);
        require(potentialESToken.decimals() == 6, "Exchange: address does not match the ESToken");
        esToken = potentialESToken;
    }
}
