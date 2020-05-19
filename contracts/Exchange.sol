pragma solidity ^0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../BokkyPooBahsRedBlackTreeLibrary/contracts/BokkyPooBahsRedBlackTreeLibrary.sol";
import "./ESToken.sol";
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
        uint256 filled;
    }

    struct MemoryOrder {
        // 32 bits for user, 8 bits for type, 186 for order uid (0x<186><8><32>)
        uint256 uid;
        address trader;
        ERC20 src;
        uint256 srcAmount;
        ERC20 dest;
        uint256 destAmount;
        uint256 filled;
    }

    struct TokenEntity {
        uint256 reservedBalance;
        Order[] orders;
        mapping(uint256 => uint256) indexes; // uid -> index
    }

    struct OrderBook {
        // price tree
        BokkyPooBahsRedBlackTreeLibrary.Tree tree;
        // price -> [order ids]
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

    ERC20 private _ESTT;
    ERC20 private _USDT;

    uint192 private _lastUid;

    constructor (address esttAddress, address usdtAddress) public {
        ESTokenInterface potentialESTT = ESTokenInterface(esttAddress);
        require(potentialESTT.isESToken(), "Exchange: address does not match the ESTT");
        _ESTT = ERC20(esttAddress);
        ERC20 potentialUSDT = ESToken(usdtAddress);
        require(potentialUSDT.decimals() > 0, "Exchange: address does not match the USDT");
        _USDT = potentialUSDT;
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
        uint256 lengthESTT = _ledger[_msgSender()][address(_ESTT)].orders.length;
        uint256 lengthUSDT = _ledger[_msgSender()][address(_USDT)].orders.length;
        uint256[] memory myOrderUids = new uint256[](lengthESTT + lengthUSDT);
        for (uint256 i = 0; i < lengthESTT; ++i) {
            myOrderUids[i] = _ledger[_msgSender()][address(_ESTT)].orders[i].uid;
        }
        for (uint256 i = 0; i < lengthUSDT; ++i) {
            myOrderUids[i + lengthESTT] = _ledger[_msgSender()][address(_USDT)].orders[i].uid;
        }
        return myOrderUids;
    }

    function getOrderByUid (uint256 uid) external view returns (uint256, address, uint256, uint256, uint256) {
        (address tokenSrcAddress, address user, uint256 index) = _unpackUid(uid);
        Order memory o = _ledger[user][tokenSrcAddress].orders[index];
        return (o.uid, o.trader, o.srcAmount, o.destAmount, o.filled);
    }

    function trade (
        address src,
        uint256 srcAmount,
        address dest,
        uint256 destAmount,
        address referral) external {
        uint32 userId = uint32(_msgSender());
        if (_usersAddresses[userId] == address(0)) {
            _usersAddresses[userId] = _msgSender();
        }
        require(_usersAddresses[userId] == _msgSender(), "user address already exist, collision");
        _lastUid++;
        MemoryOrder memory order = MemoryOrder(
            _packUid(_lastUid, src, _msgSender()),
            _msgSender(),
            ERC20(src),
            srcAmount,
            ERC20(dest),
            destAmount,
            0
        );
        _orderCheck(order);
        _ledger[_msgSender()][src].reservedBalance = _ledger[_msgSender()][src].reservedBalance.add(srcAmount);
        if(_trade(order) > 0) {
            _insertOrder(order, src);
        }
        ESTokenInterface esttInerface = ESTokenInterface(address(_ESTT));
        if (referral != address(0) &&
            esttInerface.parentReferral(_msgSender()) == address(0) &&
            src == address(_USDT)
        ) {
            uint256 price = _getPrice(order, true);
            uint256 orderBonus = order.filled.mul(price).div(10 ** uint256(_USDT.decimals()));
            esttInerface.setParentReferral(_msgSender(), referral, orderBonus.mul(REFERRAL_BONUS).div(10 ** 18));
        }
    }

//    function continueTrade (uint256 uid) external { // TODO: remove me
//        (address tokenSrcAddress, address user, uint256 index) = _unpackUid(uid);
//        Order memory storageOrder = _ledger[user][tokenSrcAddress].orders[index];
//        MemoryOrder memory order = MemoryOrder(
//            storageOrder.uid,
//            storageOrder.trader,
//            ERC20(tokenSrcAddress),
//            storageOrder.srcAmount,
//            tokenSrcAddress == address(_ESTT)? ERC20(_USDT) : ERC20(_ESTT),
//            storageOrder.destAmount,
//            storageOrder.filled
//        );
//        require(_msgSender() == order.trader, "doesn't have rights to continue buy");
//        if(_trade(order) == 0) {
//            address src = address(order.src);
//            _removeOrder(uid, src, order.trader);
//            uint256 price = _getPrice(order, true);
//            _removeOrderFromOrderBook(uid, src, price);
//        } else {
//            (address src, address user, uint256 index) = _unpackUid(uid); // TODO: refactor if need
//            _ledger[user][src].orders[index].filled = order.filled;
//        }
//    }

    function cancel (uint256 uid) external {
        (address tokenSrcAddress, address user, uint256 index) = _unpackUid(uid);
        Order memory storageOrder = _ledger[user][tokenSrcAddress].orders[index];
        MemoryOrder memory order = MemoryOrder(
            storageOrder.uid,
            storageOrder.trader,
            ERC20(tokenSrcAddress),
            storageOrder.srcAmount,
            tokenSrcAddress == address(_ESTT)? ERC20(_USDT) : ERC20(_ESTT),
            storageOrder.destAmount,
            storageOrder.filled
        );
        require(_msgSender() == order.trader, "doesn't have rights to cancel order");
        uint256 restAmount = order.srcAmount.sub(order.filled);
        address src = address(order.src);
        _ledger[order.trader][src].reservedBalance = _ledger[order.trader][src].reservedBalance.sub(restAmount);
        _removeOrder(uid, src, order.trader);
        uint256 price = _getPrice(order, true);
        _removeOrderFromOrderBook(uid, address(order.src), price);
    }

    // place limit order
    // if price more than market - order will be matched with market price
    function _trade (MemoryOrder memory order) internal returns (uint256) {
        OrderBook storage destOrderBook = _orderBooks[address(order.dest)];
        uint256 max_price = _getPrice(order, false);
        uint256 destKey = destOrderBook.tree.first();

        while (destKey != 0) {
            // key can be deleted, so next will not be available in that case
            uint256 nextKey = 0;
            if (max_price >= destKey) {
                while (destOrderBook.uids[destKey].length != 0) {
                    uint256 uid = destOrderBook.uids[destKey][0];
                    (address src, address user, uint256 index) = _unpackUid(uid);
                    Order storage opposite = _ledger[user][src].orders[index];
                    _match(order, opposite, destKey);
                    if (opposite.filled == opposite.srcAmount) {
                        nextKey = destOrderBook.tree.next(destKey);
                        _removeOrder(destOrderBook.uids[destKey][0], address(order.dest), opposite.trader);
                        _removeOrderFromPriceIndex(destOrderBook, 0, destKey);
                    }
                    if (order.filled == order.srcAmount || gasleft() < 500000) {
                        return order.srcAmount.sub(order.filled);
                    }
                }
            }
            if (order.filled == order.srcAmount || gasleft() < 500000) {
                return order.srcAmount.sub(order.filled);
            }
            if (nextKey > 0)
                destKey = nextKey;
            else
                destKey = destOrderBook.tree.next(destKey);
        }

        return order.srcAmount.sub(order.filled);
    }

    function _insertOrder (MemoryOrder memory order, address src) internal {
        Order memory storageOrder = Order(
            order.uid,
            order.trader,
            order.srcAmount,
            order.destAmount,
            order.filled
        );
        _ledger[order.trader][src].orders.push(storageOrder);
        uint256 length = _ledger[order.trader][src].orders.length;
        _ledger[order.trader][src].indexes[order.uid] = length;
        uint256 price = _getPrice(order, true);
        _insertOrderToPriceIndex(_orderBooks[src], order.uid, price);
    }

    function _removeOrder (uint256 uid, address src, address user) internal {
        uint256 index = _ledger[user][src].indexes[uid];
        uint256 length = _ledger[user][src].orders.length;
        if (index != length) {
            _ledger[user][src].orders[index.sub(1)] = _ledger[user][src].orders[length.sub(1)];
            uint256 lastOrderUid = _ledger[user][src].orders[length.sub(1)].uid;
            _ledger[user][src].indexes[lastOrderUid] = index;
        }
        _ledger[user][src].orders.pop();
        delete  _ledger[user][src].indexes[uid];
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

    function _orderCheck (MemoryOrder memory order) internal view returns (bool) {
        address src = address(order.src);
        address dest = address(order.dest);
        if (src == address(_ESTT)) {
            require(dest == address(_USDT), "wrong dest"); // TODO: add require 1:1
        } else if (src == address(_USDT)) {
            require(dest == address(_ESTT), "wrong dest"); // TODO: add require 1:1
        } else {
            revert("wrong src");
        }
        require(order.srcAmount > 0, "wrong src amount");
        require(order.destAmount > 0, "wrong dest amount");
        uint256 totalAllowance = _ledger[order.trader][address(order.src)].reservedBalance.add(order.srcAmount);
        require(order.src.allowance(order.trader, address(this)) >= totalAllowance, "not enough balance");
        return true;
    }

    function _match
    (
        MemoryOrder memory order,   // estt/usdt
        Order storage opposite,     // usdt/estt
        uint256 price
    ) internal
    {
        uint256 neededOrder = order.srcAmount.sub(order.filled);
        uint256 fee = 0;
        if (address(order.src) == address(_ESTT)) {
            fee = neededOrder.mul(EXCHANGE_FEE).div(10 ** 18); // fee = neededOrder * EXCHANGE_FEE / 10**18
            neededOrder = neededOrder.sub(fee);
        }
        uint256 availableOpposite = (opposite.srcAmount.sub(opposite.filled)).mul(price).div(10 ** uint256(order.dest.decimals()));
        if (neededOrder > availableOpposite) {
            neededOrder = availableOpposite;
            fee = neededOrder.mul(EXCHANGE_FEE).div(10 ** 18 - EXCHANGE_FEE); // fee = availableOpposite * EXCHANGE_FEE / (10**18 - EXCHANGE_FEE)
        }

        uint256 neededOpposite = neededOrder.mul(10 ** uint256(order.dest.decimals())).div(price);

        require(order.src.allowance(order.trader, address(this)) >= neededOrder, "src not enough balance");
        require(order.dest.allowance(opposite.trader, address(this)) >= neededOpposite, "dest not enough balance");

        _ledger[order.trader][address(order.src)].reservedBalance = _ledger[order.trader][address(order.src)].reservedBalance.sub(neededOrder.add(fee));
        _ledger[opposite.trader][address(order.dest)].reservedBalance = _ledger[opposite.trader][address(order.dest)].reservedBalance.sub(neededOpposite);

        order.src.transferFrom(order.trader, opposite.trader, neededOrder);
        if (fee > 0) {
            order.src.transferFrom(order.trader, RESERVE_ADDRESS, fee);
        }
        order.dest.transferFrom(opposite.trader, order.trader, neededOpposite);

        order.filled = order.filled.add(neededOrder.add(fee));
        opposite.filled = opposite.filled.add(neededOpposite);
    }

    function _packUid (uint256 index, address tokenSrc, address userAddress) internal view returns (uint256) {
        uint8 tradeType = tokenSrc == address(_ESTT) ? ESTT_2_USDT : USDT_2_ESTT;
        return index << 40 | (uint64(tradeType) << 32) | uint32(userAddress);
    }

    function _unpackUid (uint256 uid) internal view returns (address, address, uint256) {
        uint8 tradeType = uint8(uid >> 32);
        address tokenSrc;
        if (tradeType == ESTT_2_USDT)
            tokenSrc = address(_ESTT);
        else if (tradeType == USDT_2_ESTT)
            tokenSrc = address(_USDT);
        else
            revert("Wrong type token");
        address userAddress = _usersAddresses[uint32(uid)];
        uint256 index = _ledger[userAddress][tokenSrc].indexes[uid];
        require(index > 0, "Wrong id");
        return (tokenSrc, userAddress, index.sub(1));
    }

    function _getPrice(MemoryOrder memory order, bool invertFlag) internal view returns (uint256) {
        if (!invertFlag) {
            uint256 decimals = address(order.src) == address(_ESTT) ?
                10 ** uint256(_USDT.decimals()) :
                10 ** uint256(_ESTT.decimals());
            return order.srcAmount.mul(decimals).div(order.destAmount);
        }
        uint256 decimals = address(order.src) == address(_ESTT) ?
            10 ** uint256(_ESTT.decimals()) :
            10 ** uint256(_USDT.decimals());
        return order.destAmount.mul(decimals).div(order.srcAmount);
    }
}
