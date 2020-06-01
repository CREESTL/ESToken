pragma solidity ^0.6.2;

interface ESTokenInterface {
    function isESToken() pure external returns (bool);
    function parentReferral(address user) external view returns (address);
    function setParentReferral(address user, address parent, uint256 reward) external;
}

interface ExchangeInterface {
    function isExchange() pure external returns (bool);
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

}