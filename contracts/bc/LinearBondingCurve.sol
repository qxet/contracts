// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BondingCurve.sol";

contract LinearBondingCurve is BondingCurve {
    uint256 internal immutable K;
    uint256 internal immutable START_PRICE;

    constructor(
        IERC20 _token,
        uint256 _k,
        uint256 _startPrice
    ) BondingCurve(_token) {
        K = _k;
        START_PRICE = _startPrice;
    }

    function s(uint256 x0, uint256 x1) public view override returns (uint256) {
        require(x1 > x0, "LinearBondingCurve: x1 > x0");
        return (((x1 + x0) * (x1 - x0)) / (2 * K) + (START_PRICE * (x1 - x0))) / 1e18;
    }
}
