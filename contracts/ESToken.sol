pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ERC20.sol";
import "./Interfaces.sol";


contract ESToken is ESTokenInterface, Context, ERC20, Ownable {
    using SafeMath for uint256;
    using Address for address;

    struct Referral {
        address user;
        uint256 expIndex;
        uint256 balance;
    }

    struct ParentRef {
        address user;
        uint256 index;
    }

    address constant private RESERVE_ADDRESS = 0x0000000000000000000000000000000000000001;
    address private _reserveAddress;
    address private _exchangeAddress;

    uint256 private _dailyInterest;
    uint256 private _referralInterest;
    uint256 private _accrualTimestamp;
    uint256 private _expIndex;
    uint256 private _expReferralIndex;
    uint256 private _holdersCounter;

    mapping (address => uint256) private _holderIndex;
    mapping (address => ParentRef) private _parentRef;
    mapping (address => Referral[]) private _referrals;

    modifier onlyExchange () {
        require(_msgSender() == address(_exchangeAddress), "caller is not allowed to do some");
        _;
    }

    constructor () public ERC20("ESToken", "ESTT") {
        _setupDecimals(6);
        _dailyInterest = 200_000_000_000_000; // +0.02%
        _referralInterest = 100_000_000_000_000; // +0.01%
        _expIndex = 10 ** 18;
        _expReferralIndex = 10 ** 18;
        _accrualTimestamp = block.timestamp;
    }

    function init(address newExchangeAddress) external onlyOwner {
        ExchangeInterface exchangeI = ExchangeInterface(newExchangeAddress);
        require(exchangeI.isExchange(), "ESToken: newExchangeAddress does not match the exchange");
        require(_reserveAddress == address(0), "ESToken: re-initialization");
        _reserveAddress = RESERVE_ADDRESS;
        _exchangeAddress = newExchangeAddress;
        _mint(_exchangeAddress, 70_000_000 * 10 ** uint256(decimals()));
        _mint(_reserveAddress, 25_000_000 * 10 ** uint256(decimals()));
        _mint(_msgSender(), 5_000_000 * 10 ** uint256(decimals()));
    }

    function isESToken() pure external override returns (bool) {
        return true;
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

    function parentReferral(address user) external view override returns (address) {
        return _parentRef[user].user;
    }

    function holdersCounter() external view returns (uint256) {
        return _holdersCounter;
    }

    function setParentReferral(address user, address parent, uint256 reward) external override onlyExchange {
        require(parent != _reserveAddress &&
                parent != _exchangeAddress &&
                parent != owner(), "Wrong referral");
        _updateBalance(parent);
        _parentRef[user].user = parent;
        _parentRef[user].index = _referrals[parent].length;
        Referral memory referral = Referral(user, _expReferralIndex, _balances[user]);
        _referrals[parent].push(referral);
        _balances[parent] = _balances[parent].add(reward);
        if (_parentRef[parent].user != address(0)) {
            _referrals[_parentRef[parent].user][_parentRef[parent].index].balance = _balances[parent];
        }
    }

    function getMyReferrals() public view returns (address[] memory) {
        uint256 length = _referrals[_msgSender()].length;
        address[] memory addresses = new address[](length);
        for (uint i = 0; i < length; ++i) {
            addresses[i] = _referrals[_msgSender()][i].user;
        }
        return addresses;
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return super.balanceOf(account);
        }
        uint256 bonus = 0;
        for(uint256 i = 0; i < _referrals[account].length; ++i) {
            uint256 newExpReferralIndex = _calculateInterest(block.timestamp, _referralInterest, _expReferralIndex);
            Referral memory referral = _referrals[account][i];
            if (referral.expIndex < (10 ** 18) || _holderIndex[referral.user] < (10 ** 18)) {
                continue;
            }
            uint256 newBalanceOfPartner = referral.balance.mul(_expIndex).div(_holderIndex[referral.user]);
            uint256 bonusBalance = newBalanceOfPartner.mul(newExpReferralIndex).div(referral.expIndex);
            uint256 partnerBonus = bonusBalance.sub(newBalanceOfPartner);
            bonus = bonus.add(partnerBonus);
        }
        if (_balances[account] > 0 && _holderIndex[account] > 0) {
            uint256 newExpIndex = _calculateInterest(block.timestamp, _dailyInterest, _expIndex);
            return _balances[account].mul(newExpIndex).div(_holderIndex[account]).add(bonus); // (balance * newExpIndex / holderIndex) + ref.bonus
        }
        return super.balanceOf(account).add(bonus);
    }

    function accrueInterest() public {
        _expIndex = _calculateInterest(block.timestamp, _dailyInterest, _expIndex);
        _expReferralIndex = _calculateInterest(block.timestamp, _referralInterest, _expReferralIndex);
        _accrualTimestamp = block.timestamp;
    }

    function _calculateInterest(uint256 timestampNow, uint256 interest, uint256 prevIndex) internal view returns (uint256) {
        uint256 period = timestampNow.sub(_accrualTimestamp);
        if (period < 60) {
            return prevIndex;
        }
        uint256 interestFactor = interest.mul(period);
        uint newExpIndex = (interestFactor.mul(prevIndex).div(10 ** 18).div(86400)).add(prevIndex);
        return newExpIndex;
    }

    function _updateBalance(address account) internal {
        if (account == _reserveAddress ||
            account == owner() ||
            account == _exchangeAddress) {
            return ;
        }
        if (_holderIndex[account] > 0) {
            uint256 newBalance = _balances[account].mul(_expIndex).div(_holderIndex[account]); // balance * expIndex / holderIndex
            uint256 delta = newBalance.sub(_balances[account]);
            for(uint256 i = 0; i < _referrals[account].length; ++i) {
                Referral storage referral = _referrals[account][i];
                if (referral.expIndex < (10 ** 18) || _holderIndex[referral.user] < (10 ** 18)) {
                    continue;
                }
                uint256 newBalanceOfPartner = referral.balance.mul(_expIndex).div(_holderIndex[referral.user]);
                uint256 bonusBalance = newBalanceOfPartner.mul(_expReferralIndex).div(referral.expIndex);
                uint256 partnerBonus = bonusBalance.sub(newBalanceOfPartner);
                newBalance = newBalance.add(partnerBonus);
                delta = delta.add(partnerBonus);
                referral.expIndex = _expReferralIndex;
                referral.balance = newBalanceOfPartner;
            }
            if (delta != 0 && _balances[_reserveAddress] >= delta) {
                if (_balances[account] == 0) {
                    _holdersCounter++;
                }
                _balances[account] = newBalance;
                _balances[_reserveAddress] = _balances[_reserveAddress].sub(delta);
                if (_parentRef[account].user != address(0)) {
                    _referrals[_parentRef[account].user][_parentRef[account].index].balance = newBalance;
                    _referrals[_parentRef[account].user][_parentRef[account].index].expIndex = _expReferralIndex;
                }
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
        if (_balances[from] == amount) {
            _holdersCounter--;
        }
        if (_balances[to] == 0) {
            _holdersCounter++;
        }
        super._beforeTokenTransfer(from, to, amount);
    }
}
