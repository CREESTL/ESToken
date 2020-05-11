pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../BokkyPooBahsRedBlackTreeLibrary/contracts/BokkyPooBahsRedBlackTreeLibrary.sol";
import "./ESToken.sol";


contract Exchange is Ownable {
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

    struct TokenEntity {
        uint256 reservedBalance;
        Order[] orders;
    }

    struct OrderBook {
        // price tree
        BokkyPooBahsRedBlackTreeLibrary.Tree tree;
        // price -> [order ids]
        mapping(uint256 => uint256[]) uids;
    }

    enum ErrorType { None, WrongUid }

    uint8 constant private ESTT_2_USDT = 1;
    uint8 constant private USDT_2_ESTT = 2;

    mapping(address => OrderBook) private _orderBooks; // srcToken -> OrderBook
    mapping(uint256 => address) private _usersAddresses; // uint32(address) -> address
    mapping(address => mapping(address => TokenEntity)) private _ledger; // user, ESTT/USDT pair => TokenEntity

    ESToken private _ESTT;
    ERC20 private _USDT;

    uint192 private _lastUid;

    constructor (address esttAddress, address usdtAddress) public {
        ESToken potentialESTT = ESToken(esttAddress);
        require(potentialESTT.decimals() == 6, "Exchange: address does not match the ESTT");
        _ESTT = potentialESTT;
        ERC20 potentialUSDT = ESToken(usdtAddress);
        require(potentialUSDT.decimals() == 18, "Exchange: address does not match the USDT");
        _USDT = potentialUSDT;
    }

    function getNextKey (address tokenSrc, uint256 key) external view returns (uint256) {
        if (!_orderBooks[tokenSrc].tree.exists(key))
            return 0;
        return key == 0 ? _orderBooks[tokenSrc].tree.first() : _orderBooks[tokenSrc].tree.next(key);
    }

    // TODO: functions for orderCount + orderByIndex
    function getMyOrders () external view returns (uint256[] memory) {
        Order[] memory myESTTOrders = _ledger[_msgSender()][address(_ESTT)].orders;
        Order[] memory myUSDTOrders = _ledger[_msgSender()][address(_USDT)].orders;
        uint256[] memory myOrderUids = new uint256[](myESTTOrders.length + myUSDTOrders.length);
        for (uint256 i = 0; i < myESTTOrders.length; ++i) {
            myOrderUids[i] = myESTTOrders[i].uid;
        }
        for (uint256 i = 0; i < myUSDTOrders.length; ++i) {
            myOrderUids[i + myESTTOrders.length] = myUSDTOrders[i].uid;
        }
        return myOrderUids;
    }

    function getOrderByUid (uint256 uid) external view returns (Order memory) {
        return _getOrderByUid(uid);
    }

    function trade (
        address src,
        uint256 srcAmount,
        address dest,
        uint256 destAmount) external {
        require(src == address(_ESTT) || src == address(_USDT), "wrong src address");
        require(dest == address(_ESTT) || dest == address(_USDT), "wrong dest address");
        uint32 userId = uint32(_msgSender());
        if (_usersAddresses[userId] == address(0)) {
            _usersAddresses[userId] = _msgSender();
        }
        require(_usersAddresses[userId] == _msgSender(), "user address already exist, collision");
        _lastUid++;
        Order memory order = Order(
            _packUid(_lastUid, src, _msgSender()),
            _msgSender(),
            srcAmount,
            destAmount,
            0
        );
        require(_orderCheck(order), "wrong params");
        _ledger[_msgSender()][src].reservedBalance = _ledger[_msgSender()][src].reservedBalance.add(srcAmount);
        if(_trade(order) > 0) {
            _ledger[order.trader][src].orders.push(order);
            uint256 price = _getPrice(order, true);
            _insertOrderToPriceIndex(_orderBooks[src], order.uid, price);
        }
    }

    function continueTrade (uint256 uid) external {
        Order memory order = _getOrderByUid(uid);
        require(_msgSender() == order.trader, "doesn't have rights to continue buy");
        if(_trade(order) == 0) {
            (address src, ) = _getAddressesByUid(order.uid);
            _removeOrder(uid);
            uint256 price = _getPrice(order, true);
            _removeOrderFromOrderBook(uid, src, price);
        } else {
            Order storage oldOrder = _getStorageOrderByUid(uid);
            oldOrder.filled = order.filled; // TODO: Check that
        }
    }

    function cancel (uint256 uid) external {
        Order memory order = _getOrderByUid(uid);
        require(_msgSender() == order.trader, "doesn't have rights to continue buy");
        (address src, ) = _getAddressesByUid(order.uid);
        uint256 restAmount = order.srcAmount.sub(order.filled);
        _ledger[order.trader][src].reservedBalance = _ledger[order.trader][src].reservedBalance.sub(restAmount);
        _removeOrder(uid);
        uint256 price = _getPrice(order, true);
        _removeOrderFromOrderBook(uid, src, price);
    }

    function _getOrderByUid (uint256 uid) internal view returns (Order memory) {
        (ErrorType error, uint256 id, address tokenSrcAddress, address user) = _unpackUid(uid);
        require(error == ErrorType.None, "Wrong Uid");
        uint256 length = _ledger[user][tokenSrcAddress].orders.length;
        require(id < length, "Logical Error! Wrong Uid");
        return _ledger[user][tokenSrcAddress].orders[id];
    }

    function _getStorageOrderByUid (uint256 uid) internal view returns (Order storage) {
        (ErrorType error, uint256 id, address tokenSrcAddress, address user) = _unpackUid(uid);
        require(error == ErrorType.None, "Wrong Uid");
        uint256 length = _ledger[user][tokenSrcAddress].orders.length;
        require(id < length, "Logical Error! Wrong Uid");
        return _ledger[user][tokenSrcAddress].orders[id];
    }

    // place limit order
    // if price more than market - order will be matched with market price
    function _trade (Order memory order) internal returns (uint256) {
        (, ERC20 oppositeToken) = _getERC20ByUid(order.uid);
        OrderBook storage destOrderBook = _orderBooks[address(oppositeToken)];
        uint256 max_price = _getPrice(order, false);
        uint256 destKey = destOrderBook.tree.first();

        while (destKey != 0) {
            // key can be deleted, so next will not be available in that case
            uint256 nextKey = 0;
            if (max_price >= destKey) {
                while (destOrderBook.uids[destKey].length != 0) {
                    Order storage opposite = _getStorageOrderByUid(destOrderBook.uids[destKey][0]);
                    _match(order, opposite, destKey);
                    if (opposite.filled == opposite.srcAmount) {
                        nextKey = destOrderBook.tree.next(destKey);
                        _removeOrder(destOrderBook.uids[destKey][0]);
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

    function _removeOrder (uint256 uid) internal {
        (ErrorType error, uint256 id, address tokenSrcAddress, address user) = _unpackUid(uid);
        require(error == ErrorType.None, "Wrong Uid");
        uint256 length = _ledger[user][tokenSrcAddress].orders.length;
        require(id < length, "Logical Error! Wrong Uid");
        for (uint256 i = 0; i < length; ++i) {
            if (_ledger[user][tokenSrcAddress].orders[i].uid == uid) {
                if (i != length.sub(1)) {
                    _ledger[user][tokenSrcAddress].orders[i] = _ledger[user][tokenSrcAddress].orders[length.sub(1)];
                }
                break;
            }
        }
        _ledger[user][tokenSrcAddress].orders.pop();
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

    function _orderCheck (Order memory order) internal view returns (bool) {
        require(order.srcAmount > 0, "wrong src amount");
        require(order.destAmount > 0, "wrong dest amount");
        (ERC20 tokenSrc, ) = _getERC20ByUid(order.uid);
        uint256 totalAllowance = _ledger[order.trader][address(tokenSrc)].reservedBalance.add(order.srcAmount);
        require(tokenSrc.allowance(order.trader, address(this)) >= totalAllowance, "not enough balance");
        return true;
    }

    function _match
    (
        Order memory order,     // estt/usdt
        Order storage opposite, // usdt/estt
        uint256 price
    ) internal
    {
        (ERC20 orderToken, ERC20 oppositeToken) = _getERC20ByUid(order.uid);
        uint256 neededOrder = order.srcAmount.sub(order.filled);
        uint256 availableOpposite = (opposite.srcAmount.sub(opposite.filled)).mul(price).div(10 ** uint256(orderToken.decimals()));
        if (neededOrder > availableOpposite)
            neededOrder = availableOpposite;

        uint256 neededOpposite = neededOrder.mul(10 ** uint256(oppositeToken.decimals())).div(price);

        require(orderToken.allowance(order.trader, address(this)) >= neededOrder, "src not enough balance");
        require(oppositeToken.allowance(opposite.trader, address(this)) >= neededOpposite, "dest not enough balance");
        _ledger[order.trader][address(orderToken)].reservedBalance = _ledger[order.trader][address(orderToken)].reservedBalance.sub(neededOrder);
        _ledger[opposite.trader][address(oppositeToken)].reservedBalance = _ledger[opposite.trader][address(oppositeToken)].reservedBalance.sub(neededOpposite);
        orderToken.transferFrom(order.trader, opposite.trader, neededOrder);
        oppositeToken.transferFrom(opposite.trader, order.trader, neededOpposite);

        order.filled = order.filled.add(neededOrder);
        opposite.filled = opposite.filled.add(neededOpposite);
    }

    function _packUid (uint256 index, address tokenSrc, address userAddress) internal view returns (uint256) {
        uint8 tradeType = tokenSrc == address(_ESTT) ? ESTT_2_USDT : USDT_2_ESTT;
        return index << 40 | (tradeType << 32) | uint32(userAddress);
    }

    function _unpackUid (uint256 uid) internal view returns (ErrorType, uint256, address, address) {
        uint8 tradeType = uint8(uid >> 32);
        address tokenSrc;
        if (tradeType == ESTT_2_USDT)
            tokenSrc = address(_ESTT);
        else if (tradeType == USDT_2_ESTT)
            tokenSrc = address(_USDT);
        else
            return (ErrorType.WrongUid, 0, address(0), address(0));
        address userAddress = _usersAddresses[uint32(uid)];
        return (ErrorType.None, uid >> 40, tokenSrc, userAddress);
    }

    function _getERC20ByUid (uint256 uid) internal view returns (ERC20 srcToken, ERC20 destToken) {
        (ErrorType error, , address tokenSrcAddress, ) = _unpackUid(uid);
        require(error == ErrorType.None, "Wrong Uid");
        if (tokenSrcAddress == address(_ESTT)) {
            return (_ESTT, _USDT);
        }
        return (_USDT, _ESTT);
    }

    function _getAddressesByUid (uint256 uid) internal view returns (address src, address dest) {
        (ErrorType error, , address srcAddress, ) = _unpackUid(uid);
        require(error == ErrorType.None, "Wrong Uid");
        if (srcAddress == address(_ESTT)) {
            return (address(_ESTT), address(_USDT));
        }
        return (address(_USDT), address(_ESTT));
    }

    function _getPrice(Order memory order, bool invertFlag) internal view returns (uint256) {
        (ErrorType error, , address src, ) = _unpackUid(order.uid);
        require(error == ErrorType.None, "Wrong Uid");
        if (!invertFlag) {
            if (src == address(_ESTT)) {
                return order.srcAmount.mul(10 ** uint256(_USDT.decimals())).div(order.destAmount);
            }
            return order.srcAmount.mul(10 ** uint256(_ESTT.decimals())).div(order.destAmount);
        }
        if (src == address(_ESTT)) {
            return order.destAmount.mul(10 ** uint256(_ESTT.decimals())).div(order.srcAmount);
        }
        return order.destAmount.mul(10 ** uint256(_USDT.decimals())).div(order.srcAmount);
    }
}
