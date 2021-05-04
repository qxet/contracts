// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceCalculator.sol";
import "./AdvancedMath.sol";

library AoNPriceCalculator {
    /**
     * @dev sqrt(365*86400) * 10^8
     */
    int256 internal constant SQRT_YEAR_E8 = 5615.69229926 * 10**8;
    int256 internal constant YEAR = 31536000;
    int256 internal constant SQRT_2_PI_E8 = 250662827;

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
        IPriceCalculator.OptionType _optionType,
        bool _isSell
    ) public pure returns (uint256) {
        require(_spot > 0 && _spot < 10**13, "oracle price should be between 0 and 10^13");
        require(_maturity > 0 && _maturity < 31536000, "the _maturity should not have expired and less than 1 year");
        require(_strike > 0 && _strike < 10**13, "strike price should be between 0 and 10^13");
        require(0 < _x0 && _x0 < 10 * 1e8, "0 < x0 < 1000%");
        require(_amount > 0, "_amount > 0");
        require(0 < _k, "0 < _k");
        int256 sqrtMaturity = (AdvancedMath._sqrt(int256(_maturity)) * 1e16) / SQRT_YEAR_E8;

        if (_optionType == IPriceCalculator.OptionType.CashOrNothingCall) {
            return
                calculateCallOptionPrice(
                    int256(_spot),
                    int256(_strike),
                    sqrtMaturity,
                    int256(_x0),
                    int256(_amount),
                    int256(_k),
                    _isSell,
                    false
                );
        } else if (_optionType == IPriceCalculator.OptionType.CashOrNothingPut) {
            return
                calculateCallOptionPrice(
                    int256(_spot),
                    int256(_strike),
                    sqrtMaturity,
                    int256(_x0),
                    int256(_amount),
                    int256(_k),
                    _isSell,
                    true
                );
        } else {
            revert("unknown option type");
        }
    }

    function calStartPrice(
        uint256 _spot,
        uint256 _strike,
        uint256 _maturity,
        uint256 _volatility,
        IPriceCalculator.OptionType _optionType
    ) internal pure returns (uint256) {
        return calculateOptionPrice(_spot, _strike, _maturity, _volatility, 1e8, 1e2, _optionType, true);
    }

    function calculateCallOptionPrice(
        int256 _spot,
        int256 _strike,
        int256 _sqrtMaturity,
        int256 _x0,
        int256 _amount,
        int256 _k,
        bool _isSell,
        bool _isPut
    ) internal pure returns (uint256) {
        int256 logSigE4;
        int256 diff2;
        {
            int256 spotPerStrikeE4 = (_spot * 1e4) / _strike;
            logSigE4 = AdvancedMath._logTaylor(spotPerStrikeE4);
            int256 d1E4;
            int256 d2E4;
            (d1E4, d2E4) = _calD1D2(logSigE4, _sqrtMaturity, _x0);
            if (_isPut) {
                diff2 = d1E4 - d2E4 + d1E4 * d2E4 * d2E4;
            } else {
                diff2 = -d1E4 + d2E4 - d1E4 * d2E4 * d2E4;
            }
        }
        {
            if ((diff2 >= 0 && !_isSell) || (diff2 < 0 && _isSell)) {
                // normal trapezoidal rule
                int256 price = _calTrapezoidalRule(logSigE4, _sqrtMaturity, _x0, _x0 + (_amount * _k) / 1e8, _isPut);
                return uint256((price * 1e8) / _k);
            }
        }
        // trapezoidal rule
        int256 price2 = _calTrapezoidalRule2(_spot, logSigE4, _sqrtMaturity, _x0, _x0 + (_amount * _k) / 1e8, _isPut);
        return uint256((price2 * 1e8) / _k);
    }

    function _calD1D2(
        int256 _logSigE4,
        int256 _sqrtMaturity,
        int256 _volatilityE8
    ) internal pure returns (int256 d1E4, int256 d2E4) {
        int256 sigE8 = (_volatilityE8 * _sqrtMaturity) / (1e8);
        d1E4 = ((_logSigE4 * 10**8) / sigE8) + (sigE8 / (2 * 10**4));
        d2E4 = d1E4 - (sigE8 / 10**4);
    }

    function _calTrapezoidalRule(
        int256 _logSigE4,
        int256 _sqrtMaturity,
        int256 _x0,
        int256 _x1,
        bool _isPut
    ) internal pure returns (int256) {
        int256 start = _calAoNOptionPrice(_logSigE4, _sqrtMaturity, _x0, _isPut);
        int256 end = _calAoNOptionPrice(_logSigE4, _sqrtMaturity, _x1, _isPut);
        return ((start + end) * (_x1 - _x0)) / (2 * 1e8);
    }

    function _calTrapezoidalRule2(
        int256 _spot,
        int256 _logSigE4,
        int256 _sqrtMaturity,
        int256 _x0,
        int256 _x1,
        bool _isPut
    ) internal pure returns (int256) {
        (int256 d1E4, int256 d2E4) = _calD1D2(_logSigE4, _sqrtMaturity, _x0);
        int256 start = _calAoNOptionPriceWithD(d1E4, _isPut);
        int256 nd1 = AdvancedMath.exp(-(d1E4**2) / 2);
        int256 diff1 = -(_spot * d2E4 * nd1) / (_x0 * 1e8);
        int256 end = start + (diff1 * (_x1 - _x0)) / 1e8;
        return (((start + end) * (_x1 - _x0)) / (2 * 1e8));
    }

    function _calAoNOptionPrice(
        int256 _logSigE4,
        int256 _sqrtMaturity,
        int256 _volatility,
        bool _isPut
    ) internal pure returns (int256) {
        (int256 d1E4, ) = _calD1D2(_logSigE4, _sqrtMaturity, _volatility);
        if (_isPut) {
            return AdvancedMath._calcPnorm(-d1E4);
        } else {
            return AdvancedMath._calcPnorm(d1E4);
        }
    }

    function _calAoNOptionPriceWithD(int256 _d1E4, bool _isPut) internal pure returns (int256) {
        if (_isPut) {
            return AdvancedMath._calcPnorm(-_d1E4);
        } else {
            return AdvancedMath._calcPnorm(_d1E4);
        }
    }
}
