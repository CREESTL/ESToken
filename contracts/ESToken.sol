pragma solidity ^0.6.0;

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

    mapping (address => uint256) private _lastOperationTimestamp;

    constructor () public ERC20("ESToken", "ESTT") {
        _setupDecimals(6);
        _dailyInterest = 1_000_200_000_000_000_000; // +0.02%
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
        _dailyInterest = newDailyInterest;
    }

    function reserveAddress() external view returns (address) {
        return _reserveAddress;
    }

    function exchangeAddress() external view returns (address) {
        return _exchangeAddress;
    }

    function dailyInterest() external view returns (uint256) {
        return _dailyInterest;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return super.balanceOf(account);
        }
        if (block.timestamp > _lastOperationTimestamp[account]) {
            if (_balances[account] > 0) {
                uint256 delta =
                    _calculateCurrentInterest(
                        block.timestamp,
                        _lastOperationTimestamp[account],
                        _balances[account],
                        _dailyInterest);
                return super.balanceOf(account).add(delta);
            }
        }
        return super.balanceOf(account);
    }

    function _calculateCurrentInterest(
        uint256 timestampNow,
        uint256 lastOperationTimestamp,
        uint256 balance,
        uint256 interest) internal pure returns (uint256) {
        uint256 period = timestampNow.sub(lastOperationTimestamp);
        uint256 interestPersent = interest.sub(10 ** 18);
        return balance.mul(interestPersent).div(10 ** 18).mul(period).div(86400); // balance * interest * period / (24 * 60 * 60)
    }

    function _updateBalance(address account) internal {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return ;
        }
        if (block.timestamp > _lastOperationTimestamp[account]) {
            if (_balances[account] > 0) {
                uint256 delta =
                    _calculateCurrentInterest(
                        block.timestamp,
                        _lastOperationTimestamp[account],
                            _balances[account],
                        _dailyInterest);
                if (delta > 0 && _balances[_reserveAddress] >= delta) {
                    _balances[account] = _balances[account].add(delta);
                    _balances[_reserveAddress] = _balances[_reserveAddress].sub(delta);
                }
            }
            _lastOperationTimestamp[account] = block.timestamp;
        }
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (from != address(0)) {
            _updateBalance(from);
            _updateBalance(to);
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}
