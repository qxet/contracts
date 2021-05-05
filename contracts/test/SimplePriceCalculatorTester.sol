// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceCalculator.sol";
import {SimplePriceCalculator} from "../lib/SimplePriceCalculator.sol";

contract SimplePriceCalculatorTester {
    function calculateOptionPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _x0,
        uint256 _amount,
        uint256 _k,
        IPriceCalculator.OptionType _optionType
    ) external pure returns (uint256) {
        return SimplePriceCalculator.calculateOptionPrice(_spot, _strike, _maturity, _x0, _amount, _k, _optionType);
    }

    function calStartPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _iv,
        IPriceCalculator.OptionType _optionType
    ) external pure returns (uint256) {
        return SimplePriceCalculator.calStartPrice(_spot, _strike, _maturity, _iv, _optionType);
    }

    function exp(int256 _x) external pure returns (int256) {
        return SimplePriceCalculator.exp(_x);
    }
}
