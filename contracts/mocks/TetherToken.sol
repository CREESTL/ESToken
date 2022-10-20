// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../ERC20.sol";

contract TetherToken is ERC20 {
    constructor(string memory name_, string memory symbol_) 
    ERC20(name_, symbol_) {}
}
