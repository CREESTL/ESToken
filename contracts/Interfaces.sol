pragma solidity ^0.6.2;

interface ESTokenInterface {
    function isESToken() pure external returns (bool);
    function parentReferral(address user) external view returns (address);
    function setParentReferral(address user, address parent, uint256 reward) external;
}

interface ExchangeInterface {
    function isExchange() pure external returns (bool);
}