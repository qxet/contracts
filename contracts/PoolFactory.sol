// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Options.sol";
import "./Pool.sol";
import "./PredyStaking.sol";

/**
 * @notice Pool Factory Contract
 */
contract PoolFactory {
    mapping(address => address) public getPool;

    event PoolCreated(address poolAddress);

    constructor() {}

    function createPool(address _asset) public {
        Pool pool = new Pool(_asset);
        address poolAddress = address(pool);
        getPool[_asset] = poolAddress;
        emit PoolCreated(poolAddress);
    }

    function transferOwnership(address _asset, address _options) public {
        Pool(getPool[_asset]).transferOwnership(_options);
    }
}

contract OptionsFactory {
    mapping(address => address) public getOptions;

    event OptionsCreated(address optionsAddress);

    constructor() {}

    function createOptions(
        address _asset,
        address _pool,
        address _accountContractAddress,
        address _priceOracle,
        address _feeRecepient
    ) public {
        Options options =
            new Options("", _asset, _pool, _accountContractAddress, _priceOracle, PredyStaking(_feeRecepient));
        address optionsAddress = address(options);
        getOptions[_asset] = optionsAddress;
        emit OptionsCreated(optionsAddress);
    }
}
