pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ERC20.sol";


contract ESToken is Context, ERC20, Ownable {
    using SafeMath for uint256;
    using Address for address;

    address constant private RESERVE_ADDRESS = 0x0000000000000000000000000000000000000001;
    address private _reserveAddress;
    address private _exchangeAddress;

    uint256 private _dailyInterest;
    uint256 private _accrualTimestamp;
    uint256 private _expIndex;

    mapping (address => uint256) private _holderIndex;

    constructor () public ERC20("ESToken", "ESTT") {
        _setupDecimals(6);
        _dailyInterest = 200_000_000_000_000; // +0.02%
        _expIndex = 10 ** 18;
        _accrualTimestamp = block.timestamp;
    }

    function init(address newExchangeAddress) external onlyOwner {
        require(newExchangeAddress != address(0), "ESToken: newExchangeAddress is zero address");
        require(_reserveAddress == address(0), "ESToken: re-initialization");
        _reserveAddress = RESERVE_ADDRESS;
        _exchangeAddress = newExchangeAddress;
        _mint(_exchangeAddress, 70_000_000 * 10 ** uint256(decimals()));
        _mint(_reserveAddress, 25_000_000 * 10 ** uint256(decimals()));
        _mint(_msgSender(), 5_000_000 * 10 ** uint256(decimals()));
    }

    function setDailyInterest(uint256 newDailyInterest) external onlyOwner {
        require(newDailyInterest >= 10 ** 18, "ESToken: negative daily interest");
        _dailyInterest = newDailyInterest.sub(10 ** 18);
    }

    function reserveAddress() external view returns (address) {
        return _reserveAddress;
    }

    function exchangeAddress() external view returns (address) {
        return _exchangeAddress;
    }

    function dailyInterest() external view returns (uint256) {
        return _dailyInterest.add(10 ** 18);
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return super.balanceOf(account);
        }
        if (_balances[account] > 0 && _holderIndex[account] > 0) {
            uint256 newExpIndex = _calculateInterest(block.timestamp);
            return _balances[account].mul(newExpIndex).div(_holderIndex[account]); // balance * newExpIndex / holderIndex
        }
        return super.balanceOf(account);
    }

    function accrueInterest() public {
        _expIndex = _calculateInterest(block.timestamp);
        _accrualTimestamp = block.timestamp;
    }

    function _calculateInterest(uint256 timestampNow) internal view returns (uint256) {
        uint256 period = timestampNow.sub(_accrualTimestamp);
        uint256 interestFactor = _dailyInterest.mul(period);
        uint newExpIndex = (interestFactor.mul(_expIndex).div(10 ** 18).div(86400)).add(_expIndex);
        return newExpIndex;
    }

    function _updateBalance(address account) internal {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return ;
        }
        if (_balances[account] > 0 && _holderIndex[account] > 0) {
            uint256 newBalance = _balances[account].mul(_expIndex).div(_holderIndex[account]); // balance * expIndex / holderIndex
            uint256 delta = newBalance.sub(_balances[account]);
            if (delta != 0 && _balances[_reserveAddress] >= delta) {
                _balances[account] = newBalance;
                _balances[_reserveAddress] = _balances[_reserveAddress].sub(delta);
            }
        }
        _holderIndex[account] = _expIndex;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        accrueInterest();
        if (from != address(0)) {
            _updateBalance(from);
            _updateBalance(to);
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}
