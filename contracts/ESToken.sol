pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract ESToken is Context, ERC20, Ownable {
    constructor () public ERC20("ESToken", "ESTT") {
        _setupDecimals(6);
        _mint(_msgSender(), 100_000_000 * 10 ** uint256(decimals()));
    }
}
