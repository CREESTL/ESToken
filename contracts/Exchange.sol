pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../BokkyPooBahsRedBlackTreeLibrary/contracts/BokkyPooBahsRedBlackTreeLibrary.sol";
import "./Interfaces.sol";


contract Exchange is ExchangeInterface, Ownable {
    using SafeMath for uint256;
    using Address for address;
    using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;

    struct Order {
        // 32 bits for user, 8 bits for type, 186 for order uid (0x<186><8><32>)
        uint256 uid;
        address trader;
        uint256 srcAmount;
        uint256 destAmount;
        uint256 fee;
        uint256 filled;
    }

    struct MemoryOrder {
        address trader;
        address src;
        uint256 srcAmount;
        address dest;
        uint256 destAmount;
        uint256 fee;
        uint256 filled;
    }

    struct TokenEntity {
        uint256 reservedBalance;
        Order[] orders;
        // TODO typo
        mapping(uint256 => uint256) ids; // uid -> index
    }

    struct OrderBook {
        // price tree
        BokkyPooBahsRedBlackTreeLibrary.Tree tree;
        // price -> [order uids]
        mapping(uint256 => uint256[]) uids;
    }

    address constant private RESERVE_ADDRESS = 0x0000000000000000000000000000000000000001;
    uint8 constant private ESTT_2_USDT = 1;
    uint8 constant private USDT_2_ESTT = 2;
    uint256 constant private REFERRAL_BONUS = 500_000_000_000_000; // +0.05%
    uint256 constant private EXCHANGE_FEE = 8_000_000_000_000_000; // 0.8% fee from estt->usdt tx

    mapping(address => OrderBook) private _orderBooks; // srcToken -> OrderBook
    mapping(uint256 => address) private _usersAddresses; // uint32(address) -> address
    mapping(address => mapping(address => TokenEntity)) private _ledger; // user, ESTT/USDT pair => TokenEntity

    IERC20 private _ESTT;
    IERC20USDTCOMPATIBLE private _USDT;
    uint256 private _ESTTDecimals;
    uint256 private _USDTDecimals;
    address private _ESTTAddress;
    address private _USDTAddress;

    uint192 private _lastUid;

    constructor (address esttAddress, address usdtAddress) public {
        ESTokenInterface potentialESTT = ESTokenInterface(esttAddress);
        require(potentialESTT.isESToken(), "address doesn't match to ESTT");
        _ESTT = IERC20(esttAddress);
        _ESTTDecimals = _ESTT.decimals();
        _ESTTAddress = esttAddress;
        IERC20USDTCOMPATIBLE potentialUSDT = IERC20USDTCOMPATIBLE(usdtAddress);
        _USDTDecimals = potentialUSDT.decimals();
        require(_USDTDecimals == 6, "address doesn't match to USDT");
        _USDT = potentialUSDT;
        _USDTAddress = usdtAddress;
    }

    function isExchange() pure external override returns (bool) {
        return true;
    }

    function getNextPrice (address tokenSrc, uint256 price) external view returns (uint256) {
        return price == 0 ? _orderBooks[tokenSrc].tree.first() : _orderBooks[tokenSrc].tree.next(price);
    }

    function getUidsByPrice (address tokenSrc, uint256 price) external view returns (uint256[] memory) {
        return _orderBooks[tokenSrc].uids[price];
    }

    function getMyOrders () external view returns (uint256[] memory) {
        uint256 lengthESTT = _ledger[_msgSender()][_ESTTAddress].orders.length;
        uint256 lengthUSDT = _ledger[_msgSender()][_USDTAddress].orders.length;
        uint256[] memory myOrderUids = new uint256[](lengthESTT + lengthUSDT);
        for (uint256 i = 0; i < lengthESTT; ++i) {
            myOrderUids[i] = _ledger[_msgSender()][_ESTTAddress].orders[i].uid;
        }
        for (uint256 i = 0; i < lengthUSDT; ++i) {
            myOrderUids[i + lengthESTT] = _ledger[_msgSender()][_USDTAddress].orders[i].uid;
        }
        return myOrderUids;
    }

    function getOrderByUid (uint256 uid) external view returns (uint256, address, uint256, uint256, uint256, uint256) {
        (address srcAddress, address user, uint256 index) = _unpackUid(uid);
        Order memory o = _ledger[user][srcAddress].orders[index];
        return (o.uid, o.trader, o.srcAmount, o.destAmount, o.fee, o.filled);
    }

    function trade (
        address src,
        uint256 srcAmount,
        address dest,
        uint256 destAmount,
        address referral
    ) external {
        uint32 userId = uint32(_msgSender());
        if (_usersAddresses[userId] == address(0)) {
            _usersAddresses[userId] = _msgSender();
        }
        require(_usersAddresses[userId] == _msgSender(), "user address already exist");
        _lastUid++;
        MemoryOrder memory order = MemoryOrder(
            _msgSender(),
            src,
            srcAmount,
            dest,
            destAmount,
            0,
            0
        );
        (order.srcAmount, order.fee) = _orderSubstractFee(order);
        _orderCheck(order);
        _ledger[_msgSender()][src].reservedBalance = _ledger[_msgSender()][src].reservedBalance.add(srcAmount);
        // less than 10 wei
        if(_trade(order) > 10) {
            _insertOrder(order, src);
        }
        ESTokenInterface esttInerface = ESTokenInterface(_ESTTAddress);
        if (referral != address(0) &&
            esttInerface.parentReferral(_msgSender()) == address(0) &&
            src == _USDTAddress
        ) {
            uint256 price = _getPrice(order, true);
            uint256 orderBonus = order.filled.mul(price).div(10 ** _USDTDecimals);
            esttInerface.setParentReferral(_msgSender(), referral, orderBonus.mul(REFERRAL_BONUS).div(10 ** 18));
        }
    }

    //     function trado (
    //     address src,
    //     uint256 srcAmount,
    //     address dest,
    //     uint256 destAmount,
    //     bool referral
    // ) external view returns (uint256, uint256, uint256, uint256, uint256){
    //     //return srcAmount.mul(10 ** 18).div(10 ** 18 + EXCHANGE_FEE);
    //     MemoryOrder memory order = MemoryOrder(
    //         _msgSender(),
    //         src,
    //         srcAmount,
    //         dest,
    //         destAmount,
    //         0,
    //         0
    //     );
    //     Order memory opposite = Order(
    //         1,
    //         _msgSender(),
    //         900000,
    //         1000000,
    //         7200,
    //         0
    //     );
    //     (order.srcAmount, order.fee) = _orderSubstractFee(order);
    //     uint256 maxPrice = _getPrice(order, referral);
    //     (uint256 needed, uint256 fee, uint256 neededOpposite, uint256 feeOpposite) = _calcMatch(order, opposite, maxPrice);
    //     return (needed, fee, neededOpposite, feeOpposite, maxPrice);
    //     // return (needed.add(fee), 0,0,0);
    // }

    function continueTrade (uint256 uid) external {
        (address tokenSrcAddress, address user, uint256 index) = _unpackUid(uid);
        Order memory storageOrder = _ledger[user][tokenSrcAddress].orders[index];
        require(_msgSender() == storageOrder.trader, "has no rights to continue trade");
        MemoryOrder memory order = MemoryOrder(
            storageOrder.trader,
            tokenSrcAddress,
            storageOrder.srcAmount,
            tokenSrcAddress == _ESTTAddress ? _USDTAddress : _ESTTAddress,
            storageOrder.destAmount,
            storageOrder.fee,
            storageOrder.filled
        );
        if(_trade(order) == 0) {
            _removeOrder(uid, order.src, order.trader);
            uint256 price = _getPrice(order, true);
            _removeOrderFromOrderBook(uid, order.src, price);
        } else {
            _ledger[user][tokenSrcAddress].orders[index].filled = order.filled;
        }
    }

    function cancel (uint256 uid) external {
        (address tokenSrcAddress, address user, uint256 index) = _unpackUid(uid);
        Order memory storageOrder = _ledger[user][tokenSrcAddress].orders[index];
        MemoryOrder memory order = MemoryOrder(
            storageOrder.trader,
            tokenSrcAddress,
            storageOrder.srcAmount,
            tokenSrcAddress == _ESTTAddress ? _USDTAddress : _ESTTAddress,
            storageOrder.destAmount,
            storageOrder.fee,
            storageOrder.filled
        );
        require(_msgSender() == order.trader, "doesn't have rights to cancel order");
        uint256 restAmount = order.srcAmount.sub(order.filled);
        _ledger[order.trader][order.src].reservedBalance = _ledger[order.trader][order.src].reservedBalance.sub(restAmount);
        _removeOrder(uid, order.src, order.trader);
        uint256 price = _getPrice(order, true);
        _removeOrderFromOrderBook(uid, order.src, price);
    }

    // place limit order
    // if price more than market - order will be matched with market price
    function _trade (MemoryOrder memory order) internal returns (uint256) {
        OrderBook storage destOrderBook = _orderBooks[order.dest];
        uint256 maxPrice = _getPrice(order, false);
        uint256 destKey = destOrderBook.tree.first();

        while (destKey != 0) {
            // key can be deleted, so next will not be available in that case
            uint256 nextKey = 0;
            if (maxPrice >= destKey) {
                while (destOrderBook.uids[destKey].length != 0) {
                    uint256 uid = destOrderBook.uids[destKey][0];
                    (address src, address user, uint256 index) = _unpackUid(uid);
                    Order storage opposite = _ledger[user][src].orders[index];
                    (bool badOpposite, uint256 filledOpposite) = _match(order, opposite, destKey);
                    opposite.filled = opposite.filled.add(filledOpposite);
                    if (opposite.srcAmount.sub(opposite.filled) < 10 || !badOpposite) {
                        nextKey = destOrderBook.tree.next(destKey);
                        _removeOrder(destOrderBook.uids[destKey][0], order.dest, opposite.trader);
                        _removeOrderFromPriceIndex(destOrderBook, 0, destKey);
                    }
                    if (order.filled == order.srcAmount || gasleft() < 600000) {
                        return order.srcAmount.sub(order.filled);
                    }
                }
            }
            if (order.filled == order.srcAmount || gasleft() < 600000) {
                return order.srcAmount.sub(order.filled);
            }
            if (nextKey > 0)
                destKey = nextKey;
            else
                destKey = destOrderBook.tree.next(destKey);
        }

        if (maxPrice == (10 ** _decimals(order.src))) {
            _match(
                order,
                Order(0, address(0), 0, 0, 0, 0),
                maxPrice
            );
        }
        return order.srcAmount.sub(order.filled);
    }

    function _insertOrder (MemoryOrder memory order, address src) internal {
        Order memory storageOrder = Order(
            _packUid(_lastUid, src, _msgSender()),
            order.trader,
            order.srcAmount,
            order.destAmount,
            order.fee,
            order.filled
        );
        _ledger[order.trader][src].orders.push(storageOrder);
        uint256 length = _ledger[order.trader][src].orders.length;
        _ledger[order.trader][src].ids[storageOrder.uid] = length;
        uint256 price = _getPrice(order, true);
        _insertOrderToPriceIndex(_orderBooks[src], storageOrder.uid, price);
    }

    function _removeOrder (uint256 uid, address src, address user) internal {
        uint256 index = _ledger[user][src].ids[uid];
        uint256 length = _ledger[user][src].orders.length;
        if (index != length) {
            _ledger[user][src].orders[index.sub(1)] = _ledger[user][src].orders[length.sub(1)];
            uint256 lastOrderUid = _ledger[user][src].orders[length.sub(1)].uid;
            _ledger[user][src].ids[lastOrderUid] = index;
        }
        _ledger[user][src].orders.pop();
        delete  _ledger[user][src].ids[uid];
    }

    function _removeOrderFromOrderBook (uint256 uid, address srcToken, uint256 price) internal {
        uint256[] storage uids = _orderBooks[srcToken].uids[price];
        for (uint256 i = 0; i < uids.length; ++i) {
            if (uids[i] == uid) {
                _removeOrderFromPriceIndex(_orderBooks[srcToken], i, price);
                break;
            }
        }
    }

    function _insertOrderToPriceIndex (OrderBook storage orderBook, uint256 uid, uint256 key) internal {
        if (!orderBook.tree.exists(key)) {
            orderBook.tree.insert(key);
        }
        orderBook.uids[key].push(uid);
    }

    function _removeOrderFromPriceIndex (OrderBook storage orderBook, uint256 index, uint256 key) internal {
        orderBook.uids[key][index] = orderBook.uids[key][orderBook.uids[key].length.sub(1)];
        orderBook.uids[key].pop();
        if (orderBook.uids[key].length == 0) {
            orderBook.tree.remove(key);
            delete orderBook.uids[key];
        }
    }

    // TODO remove require
    function _orderCheck (MemoryOrder memory order) internal view {
        uint256 price = _getPrice(order, false);
        if (order.src == _ESTTAddress) {
            require(order.dest == _USDTAddress, "wrong dest");
            require(price <= (10 ** _ESTTDecimals), "ESTT can't be cheaper USDT");
        } else if (order.src == _USDTAddress) {
            require(order.dest == _ESTTAddress, "wrong dest");
            require(price >= (10 ** _USDTDecimals), "ESTT can't be cheaper USDT");
        } else {
            revert("wrong src");
        }
        require(order.srcAmount > 0, "wrong src amount");
        require(order.destAmount > 0, "wrong dest amount");
        uint256 totalAllowance = _ledger[order.trader][order.src].reservedBalance.add(order.srcAmount);
        IERC20 ierc20 = IERC20(order.src);
        require(ierc20.allowance(order.trader, address(this)) >= totalAllowance, "not enough balance");
    }

    function _orderSubstractFee (MemoryOrder memory order) internal view returns (uint256, uint256) {
        if (order.src == _ESTTAddress && order.trader != address(this)) {
            uint256 srcAmountWithoutFee = order.srcAmount.mul(10 ** 18).div(10 ** 18 + EXCHANGE_FEE);
            return (srcAmountWithoutFee, order.srcAmount.sub(srcAmountWithoutFee));
        }
        return (order.srcAmount, 0);
    }

    function _match (MemoryOrder memory order, Order memory opposite, uint256 price) internal returns (bool, uint256) {
        (uint256 needed, uint256 fee, uint256 neededOpposite, uint256 feeOpposite) = _calcMatch(order, opposite, price);

        IERC20 erc20 = IERC20(order.src);
        require(erc20.allowance(order.trader, address(this)) >= needed.add(fee), "src not enough balance");
        erc20 = IERC20(order.dest);
        if (
            opposite.uid != 0 &&
            erc20.allowance(opposite.trader, address(this)) < neededOpposite ||
            (feeOpposite > 0 && _ESTT.allowance(opposite.trader, address(this)) < feeOpposite)
            ) {
            return (false, 0);
        }

        _ledger[order.trader][order.src].reservedBalance = _ledger[order.trader][order.src].reservedBalance.sub(needed);//.add(fee));
        if (opposite.uid != 0) {
            _ledger[opposite.trader][order.dest].reservedBalance = _ledger[opposite.trader][order.dest].reservedBalance.sub(neededOpposite);
        }

        if (order.src == _ESTTAddress) {
            if (opposite.uid != 0) {
                _ESTT.transferFrom(order.trader, opposite.trader, needed);
                _USDT.transferFrom(opposite.trader, order.trader, neededOpposite);
            } else {
                _ESTT.transferFrom(order.trader, address(this), needed);
                _USDT.transfer(order.trader, neededOpposite);
            }
            if (fee > 0) {
                _ESTT.transferFrom(order.trader, RESERVE_ADDRESS, fee);
            }
        } else {
            if (opposite.uid != 0) {
                _USDT.transferFrom(order.trader, opposite.trader, needed);
                _ESTT.transferFrom(opposite.trader, order.trader, neededOpposite);
            } else {
                _USDT.transferFrom(order.trader, address(this), needed);
                _ESTT.transfer(order.trader, neededOpposite);
            }
            if (feeOpposite > 0) {
                _ESTT.transferFrom(opposite.trader, RESERVE_ADDRESS, feeOpposite);
            }
        }

        order.filled = order.filled.add(needed);

        return (true, neededOpposite);
    }

    function _calcMatch (MemoryOrder memory order, Order memory opposite, uint256 price) internal view returns
    (
        uint256 needed,
        uint256 fee,
        uint256 neededOpposite, 
        uint256 feeOpposite
    ) {
        needed = order.srcAmount.sub(order.filled);
        fee = 0;
        feeOpposite = 0;
        IERC20 erc20Dest = IERC20(order.dest);
        uint256 availableOpposite;
        if (opposite.uid != 0) {
            availableOpposite = (opposite.srcAmount.sub(opposite.filled)).mul(price).div(10 ** _decimals(order.dest));
        } else {
            availableOpposite = (erc20Dest.balanceOf(address(this))).mul(price).div(10 ** _decimals(order.dest));
        }
        if (needed > availableOpposite) {
            needed = availableOpposite;
        }
        neededOpposite = needed.mul(10 ** _decimals(order.dest)).div(price);
        if (order.fee > 0) {
            fee = needed.mul(order.fee).div(order.srcAmount);
        }
        if (opposite.fee > 0) {
            feeOpposite = opposite.fee.mul(10 ** _ESTTDecimals).div(needed);
        }
        return (needed, fee, neededOpposite, feeOpposite);
    }

    function _packUid (uint256 index, address tokenSrc, address userAddress) internal view returns (uint256) {
        uint8 tradeType = tokenSrc == _ESTTAddress ? ESTT_2_USDT : USDT_2_ESTT;
        return index << 40 | (uint64(tradeType) << 32) | uint32(userAddress);
    }

    function _unpackUid (uint256 uid) internal view returns (address, address, uint256) {
        uint8 tradeType = uint8(uid >> 32);
        address tokenSrc;
        if (tradeType == ESTT_2_USDT)
            tokenSrc = _ESTTAddress;
        else if (tradeType == USDT_2_ESTT)
            tokenSrc = _USDTAddress;
        else
            revert("wrong token type");
        address userAddress = _usersAddresses[uint32(uid)];
        uint256 index = _ledger[userAddress][tokenSrc].ids[uid];
        // not needed sub has needed require
        // require(index > 0, "wrong uid");
        return (tokenSrc, userAddress, index.sub(1));
    }

    function _getPrice (MemoryOrder memory order, bool invertFlag) internal view returns (uint256) {
        if (!invertFlag) {
            uint256 decimals = order.src == _ESTTAddress ?  // dest decimals
                10 ** _USDTDecimals :
                10 ** _ESTTDecimals;
            return order.srcAmount.mul(decimals).div(order.destAmount);
        }
        uint256 decimals = order.src == _ESTTAddress ?  // src decimals
            10 ** _ESTTDecimals :
            10 ** _USDTDecimals;
        return order.destAmount.mul(decimals).div(order.srcAmount);
    }

    function _decimals (address tokenAddress) internal view returns (uint256) {
        if (tokenAddress == _ESTTAddress) {
            return _ESTTDecimals;
        }
        return _USDTDecimals;
    }
}
