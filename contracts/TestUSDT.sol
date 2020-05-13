pragma solidity ^0.6.0;

import "./ERC20.sol";

contract USDToken is ERC20 {
    constructor () public ERC20("USDToken", "USDT") {
        _setupDecimals(18);
        _mint(_msgSender(), 250_000_000 * 10 ** uint256(decimals()));
    }
}
