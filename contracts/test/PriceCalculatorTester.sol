// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceCalculator.sol";
import {PriceCalculator} from "../lib/PriceCalculator.sol";

contract PriceCalculatorTester {
    function calculateOptionPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _x0,
        uint256 _amount,
        uint256 _k,
        IPriceCalculator.OptionType _optionType,
        bool _isSell
    ) external pure returns (uint256) {
        return PriceCalculator.calculateOptionPrice(_spot, _strike, _maturity, _x0, _amount, _k, _optionType, _isSell);
    }

    function calD1D2(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _x0
    ) external pure returns (int256, int256) {
        return PriceCalculator.calD1D2(_spot, _strike, _maturity, _x0);
    }

    function calDiff(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _x0
    ) external pure returns (int256) {
        return PriceCalculator.calDiff(_spot, _strike, _maturity, _x0);
    }

    function calStartPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _iv,
        IPriceCalculator.OptionType _optionType
    ) external pure returns (uint256) {
        return PriceCalculator.calStartPrice(_spot, _strike, _maturity, _iv, _optionType);
    }
}
