// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./ERC20.sol";

contract TetherToken is ERC20 {
    constructor(
        uint256 total_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        // Change default decimals from 18 to the provided amount
        _setupDecimals(decimals_);
        _mint(msg.sender, total_);
    }
}
