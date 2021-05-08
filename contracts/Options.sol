// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorInterface.sol";
import "./interfaces/IOptions.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IMarginVault.sol";
import "./interfaces/IPriceCalculator.sol";

/**
 * @title Options
 * @notice Option contract to create, sell and exercise options.
 */
contract Options is IOptions, ERC1155, IERC1155Receiver {
    IPool public pool;
    IMarginVault account;
    AggregatorInterface priceOracle;
    IStaking feeRecepient;

    address asset;
    mapping(uint256 => OptionSeries) serieses;

    event OptionBought(uint256 optionId, uint256 amount, uint256 premium, uint256 protocolFee);
    event OptionSold(uint256 optionId, uint256 amount, uint256 premium);
    event Exercised(uint256 optionId, uint256 amount, uint256 profit);

    /**
     * @param _uri uri of ERC1155
     * @param _pool liquidity pool
     */
    constructor(
        string memory _uri,
        address _asset,
        address _pool,
        address _accountContractAddress,
        address _priceOracle,
        IStaking _feeRecepient
    ) ERC1155(_uri) {
        asset = _asset;
        pool = IPool(_pool);
        account = IMarginVault(_accountContractAddress);
        priceOracle = AggregatorInterface(_priceOracle);
        feeRecepient = _feeRecepient;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override(IERC1155Receiver) returns (bytes4) {
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override(IERC1155Receiver) returns (bytes4) {
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256,uint256,bytes)"));
    }

    /**
     * @notice buy options
     * @param _maturity maturity
     * @param _strike strike price
     * @param _amount amount to buy
     * @param _maxFeeAmount max total amount of fee
     */
    function buyERC20Option(
        uint256 _maturity,
        uint256 _strike,
        uint256 _amount,
        uint256 _maxFeeAmount
    ) public returns (uint256) {
        require(_maturity >= 1 days, "Options: maturity must be greater than 1 days");
        require(_maturity <= 4 weeks, "Options: maturity must be less than 4 weeks");
        require(_strike > 0, "Options: strike must not be 0");
        require(_amount > 0, "Options: amount must not be 0");
        uint256 price = getPrice();
        uint256 id = storeOption(_maturity + block.timestamp, _strike, IPriceCalculator.OptionType.Call);
        (uint256 premium, uint256 protocolFee) =
            pool.buy(id, price, _amount, _maturity, _strike, IPriceCalculator.OptionType.Call);
        require(premium + protocolFee <= _maxFeeAmount, "Options: total fee exceeds maxFeeAmount");

        // receive premium from trader
        IERC20(asset).transferFrom(msg.sender, address(this), premium + protocolFee);
        // send protocol fee to staking contract
        feeRecepient.sendProfitERC20(msg.sender, protocolFee);
        // transfer premium to pool
        IERC20(asset).transfer(address(pool), premium);
        _mint(msg.sender, id, _amount, "");

        // emit event
        emit OptionBought(id, _amount, premium, protocolFee);
        return id;
    }

    /**
     * @notice sell options
     */
    function sellERC20Option(uint256 _optionId, uint256 _amount) public {
        OptionSeries memory option = getOption(_optionId);
        require(option.expiry >= block.timestamp, "Options: option expired");
        // TODO: check balance of option
        uint256 price = getPrice();
        uint256 premium =
            pool.sell(_optionId, price, _amount, option.expiry - block.timestamp, option.strike, option.optionType);

        // send premium to trader from pool
        pool.sendERC20(msg.sender, premium);
        // receive options from trader
        safeTransferFrom(msg.sender, address(this), _optionId, _amount, "");

        // emit event
        emit OptionSold(_optionId, _amount, premium);
    }

    /**
     * @notice exercise options trader hold
     */
    function exerciseERC20(uint256 _optionId, uint256 _amount) public {
        OptionSeries memory option = getOption(_optionId);
        require(_amount > 0, "Options: _amount must not be 0");
        require(option.expiry >= block.timestamp, "Options: option expired");

        uint256 profit = calculateProfit(option, _amount);
        pool.exercise(_optionId, _amount, profit);

        // burn options
        _burn(msg.sender, _optionId, _amount);
        // send profit to trader
        pool.sendERC20(msg.sender, profit);

        // emit event
        emit Exercised(_optionId, _amount, profit);
    }

    /**
     * @notice exercise options pool hold
     */
    function exercisePoolLongs(uint256 _optionId, uint256 _amount) public {
        OptionSeries memory option = getOption(_optionId);
        require(_amount > 0, "Options: _amount must not be 0");
        require(option.expiry >= block.timestamp, "Options: option expired");

        uint256 profit = calculateProfit(option, _amount);
        pool.exercisePoolLongs(_optionId, profit);

        // if trader shorts the option
        uint256 vaultId = account.longTovaultIds(_optionId);
        if (vaultId > 0) {
            (uint256 collateral, uint256 longId, uint256 longAmount, , , ) = account.vaults(vaultId);
            require(longAmount >= _amount);
            OptionSeries memory long = getOption(longId);
            uint256 longProfit = calculateProfit(long, _amount);
            account.setProfit(vaultId, collateral + longProfit - profit);
        }

        // burn options which pool hold
        _burn(address(this), _optionId, _amount);
    }

    /**
     * @notice unlock pool funds after expiration
     */
    function unlock(uint256 _optionId) public {
        OptionSeries memory option = getOption(_optionId);
        require(option.expiry < block.timestamp, "Options: option must be expired");
        pool.unlock(_optionId);
    }

    /**
     * @notice write new option with option collateral from pool
     * @param _longId long option id
     * @param _maturity maturity of new option
     * @param _strike strike price of new option
     * @param _amount amount to write
     */
    function write(
        uint256 _longId,
        uint256 _maturity,
        uint256 _strike,
        uint256 _amount
    ) public {
        require(_maturity >= 1 days, "Options: maturity must be greater than 1 days");
        require(_maturity <= 4 weeks, "Options: maturity must be less than 4 weeks");
        require(_strike > 0, "Options: strike must not be 0");
        require(_amount > 0, "Options: amount must not be 0");
        OptionSeries memory long = getOption(_longId);
        require(
            long.optionType == IPriceCalculator.OptionType.Call || long.optionType == IPriceCalculator.OptionType.Put,
            "Options: option type must be Call or Put"
        );
        uint256 shortId = storeOption(_maturity + block.timestamp, _strike, long.optionType);
        uint256 collateralAmount =
            account.write(
                msg.sender,
                _longId,
                shortId,
                long,
                OptionSeries(uint64(_maturity + block.timestamp), uint64(_strike), long.optionType),
                _amount
            );

        // receive ETH as collateral
        IERC20(asset).transferFrom(msg.sender, address(this), collateralAmount);
        // burn long and mint short
        _burn(msg.sender, _longId, _amount);
        _mint(msg.sender, shortId, _amount, "");
    }

    /**
     * @notice redeem vault
     * @param _vaultId vault id
     */
    function redeem(uint256 _vaultId) public {
        (, uint256 longId, , , uint256 profit, address owner) = account.vaults(_vaultId);
        require(msg.sender == owner, "Options: only owner can redeem vault");
        OptionSeries memory long = getOption(longId);
        require(block.timestamp > long.expiry, "Options: not expired");
        pool.sendERC20(msg.sender, profit);

        account.deleteVault(_vaultId);
    }

    /**
     * @notice calculate profit of ITM option
     */
    function calculateProfit(OptionSeries memory option, uint256 _amount) internal view returns (uint256) {
        uint256 price = getPrice();
        if (option.optionType == IPriceCalculator.OptionType.Call) {
            require(price >= option.strike, "Options: price must be greater than strike price");
            return (_amount * (price - option.strike)) / price;
        } else if (option.optionType == IPriceCalculator.OptionType.Put) {
            require(price < uint256(option.strike), "Options: price must be less than strike price");
            return (_amount * (price - uint256(option.strike))) / price;
        } else if (option.optionType == IPriceCalculator.OptionType.CashOrNothingCall) {
            require(price >= uint256(option.strike), "Options: price must be greater than strike price");
            return _amount;
        } else if (option.optionType == IPriceCalculator.OptionType.CashOrNothingPut) {
            require(price < uint256(option.strike), "Options: price must be less than strike price");
            return _amount;
        } else {
            revert("unknown option type");
        }
    }

    function storeOption(
        uint256 _expiry,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) internal returns (uint256) {
        uint256 id = pack(uint64(_expiry), uint64(_strike), _optionType);
        serieses[id] = OptionSeries(uint64(_expiry), uint64(_strike), _optionType);
        return id;
    }

    function getOption(uint256 _id) public view returns (OptionSeries memory) {
        return serieses[_id];
    }

    function pack(
        uint64 _expiry,
        uint64 _strike,
        IPriceCalculator.OptionType _optionType
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(_expiry, _strike, _optionType)));
    }

    /**
     * @notice gets the latest price for the asset
     * @dev overides the getPrice function in IPriceOracle
     * @return price of the asset in USD scaled by 10e8
     */
    function getPrice() internal view returns (uint256) {
        int256 answer = priceOracle.latestAnswer();
        require(answer > 0, "ChainLinkPriceOracle: price must be greater than 0");
        return uint256(answer);
    }
}
