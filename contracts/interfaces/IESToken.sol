// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IESToken {
    function isESToken() external pure returns (bool);
    function parentReferral(address user) external view returns (address);
    function setParentReferral(address user, address parent, uint256 reward) external;
}
