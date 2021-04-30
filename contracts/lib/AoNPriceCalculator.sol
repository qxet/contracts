// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceCalculator.sol";
import "./AdvancedMath.sol";

library AoNPriceCalculator {
    int256 constant INITIAL_POSITION = 1e8;
    int256 constant C = 3 * 1e16;
    int256 internal constant SQRT_2_PI_E8 = 250662827;
    int256 internal constant K0_4_E4 = 4000;
    int256 internal constant K0_41_E4 = 4100;
    int256 internal constant SQRT_YEAR_E8 = 5615.69229926 * 10**8;

    /**
     * @notice calculate option price
     * @param _spot spot price scaled 1e8
     * @param _strike strike price scaled 1e8
     * @param _maturity maturity in seconds
     * @param _x0 start IV
     * @param _amount amount of options
     * @param _k coefficient for slope
     * @param _optionType option type
     */
    function calculateOptionPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _x0,
        uint256 _amount,
        uint256 _k,
        IPriceCalculator.OptionType _optionType
    ) public pure returns (uint256) {
        require(_spot > 0 && _spot < 10**13, "oracle price should be between 0 and 10^13");
        require(_maturity > 0 && _maturity < 31536000, "the _maturity should not have expired and less than 1 year");
        require(_strike > 0 && _strike < 10**13, "strike price should be between 0 and 10^13");
        require(0 < _x0 && _x0 < 10 * 1e8, "0 < x0 < 1000%");
        require(_amount > 0, "_amount > 0");
        require(0 < _k, "0 < _k");
        int256 sqrtMaturity = AdvancedMath._sqrt(int256(_maturity));

        if (_optionType == IPriceCalculator.OptionType.CashOrNothingCall) {
            return
                calculateCashCallPrice(
                    int256(_spot),
                    int256(_strike),
                    sqrtMaturity,
                    int256(_x0),
                    int256(_amount),
                    int256(_k)
                );
        } else if (_optionType == IPriceCalculator.OptionType.CashOrNothingPut) {
            return
                calculateCashPutPrice(
                    int256(_spot),
                    int256(_strike),
                    sqrtMaturity,
                    int256(_x0),
                    int256(_amount),
                    int256(_k)
                );
        } else {
            revert("unknown option type");
        }
    }

    function calStartPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _iv,
        IPriceCalculator.OptionType _optionType
    ) internal pure returns (uint256 price) {
        return calculateOptionPrice(_spot, _strike, _maturity, _iv, 1e8, 1e8, _optionType);
    }

    /**
     * @notice calculate Cash or nothing call
     */
    function calculateCashCallPrice(
        int256 _spot,
        int256 _strike,
        int256 _sqrtMaturity,
        int256 _x0,
        int256 _amount,
        int256 _k
    ) internal pure returns (uint256 price) {
        int256 arg = (1e8 * SQRT_YEAR_E8 * (_strike - _spot)) / (1250 * _x0 * _sqrtMaturity);
        return uint256((1e8 * _amount) / (1e8 + AdvancedMath.exp(arg)));
    }

    /**
     * @notice calculate Cash or nothing put
     */
    function calculateCashPutPrice(
        int256 _spot,
        int256 _strike,
        int256 _sqrtMaturity,
        int256 _x0,
        int256 _amount,
        int256 _k
    ) internal pure returns (uint256 price) {
        int256 arg = (1e8 * SQRT_YEAR_E8 * (_strike - _spot)) / (1250 * _x0 * _sqrtMaturity);
        return uint256((1e8 * _amount) / (1e8 + AdvancedMath.exp(-arg)));
    }
}
