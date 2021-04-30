/// from https://github.com/LienFinance/bondmaker
pragma solidity ^0.8.0;

library AdvancedMath {
    /**
     * @dev sqrt(2*PI) * 10^8
     */
    int256 internal constant SQRT_2PI_E8 = 250662827;
    int256 internal constant PI_E8 = 314159265;
    int256 internal constant E_E8 = 271828182;
    int256 internal constant INV_E_E8 = 36787944; // 1/e
    int256 internal constant LOG2_E8 = 30102999;
    int256 internal constant LOG3_E8 = 47712125;

    int256 internal constant p = 23164190;
    int256 internal constant b1 = 31938153;
    int256 internal constant b2 = -35656378;
    int256 internal constant b3 = 178147793;
    int256 internal constant b4 = -182125597;
    int256 internal constant b5 = 133027442;

    uint8 private constant PRECISION = 32; // fractional bits
    uint256 public constant FIXED_ONE = uint256(1) << PRECISION; // 0x100000000
    int256 public constant FIXED_64 = 1 << 64; // 0x100000000

    function _abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }

    /**
     * @dev Calcurate an approximate value of the square root of x by Babylonian method.
     */
    function _sqrt(int256 x) internal pure returns (int256 y) {
        require(x >= 0, "cannot calculate the square root of a negative number");
        int256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /**
     * @dev Calcurate exp
     * TODO: check available input range
     */
    function exp(int256 _x) internal pure returns (int256) {
        bool _isNeg = _x < 0;
        if (_isNeg) {
            _x = -_x;
        }
        uint256 value = _exp(uint256(_x));
        if (_isNeg) {
            return 1e16 / int256(value);
        }
        return int256(value);
    }

    function _exp(uint256 _x) internal pure returns (uint256) {
        return
            1e8 +
            _x +
            (_x**2) /
            (2 * 1e8) +
            (_x**3) /
            (6 * 1e16) +
            (_x**4) /
            (24 * 1e24) +
            (_x**5) /
            (120 * 1e32) +
            (_x**6) /
            (720 * 1e40) +
            (_x**7) /
            (5040 * 1e48);
    }

    /**
     * @dev Returns log(x) for any positive x.
     */
    function _logTaylor(int256 inputE4) internal pure returns (int256 outputE4) {
        require(inputE4 > 1, "input should be positive number");
        int256 inputE8 = inputE4 * 10**4;
        // input x for _logTayler1 is adjusted to 1/e < x < 1.
        while (inputE8 < INV_E_E8) {
            inputE8 = (inputE8 * E_E8) / 10**8;
            outputE4 -= 10**4;
        }
        while (inputE8 > 10**8) {
            inputE8 = (inputE8 * INV_E_E8) / 10**8;
            outputE4 += 10**4;
        }
        outputE4 += _logTaylor1(inputE8 / 10**4 - 10**4);
    }

    /**
     * @notice Calculate an approximate value of the logarithm of input value by
     * Taylor expansion around 1.
     * @dev log(x + 1) = x - 1/2 x^2 + 1/3 x^3 - 1/4 x^4 + 1/5 x^5
     *                     - 1/6 x^6 + 1/7 x^7 - 1/8 x^8 + ...
     */
    function _logTaylor1(int256 inputE4) internal pure returns (int256 outputE4) {
        outputE4 =
            inputE4 -
            inputE4**2 /
            (2 * 10**4) +
            inputE4**3 /
            (3 * 10**8) -
            inputE4**4 /
            (4 * 10**12) +
            inputE4**5 /
            (5 * 10**16) -
            inputE4**6 /
            (6 * 10**20) +
            inputE4**7 /
            (7 * 10**24) -
            inputE4**8 /
            (8 * 10**28);
    }

    /**
     * @notice Calculate the cumulative distribution function of standard normal
     * distribution.
     * @dev Abramowitz and Stegun, Handbook of Mathematical Functions (1964)
     * http://people.math.sfu.ca/~cbm/aands/
     */
    function _calcPnorm(int256 inputE4) internal pure returns (int256 outputE8) {
        require(inputE4 < 440 * 10**4 && inputE4 > -440 * 10**4, "input is too large");
        int256 _inputE4 = inputE4 > 0 ? inputE4 : inputE4 * (-1);
        int256 t = 10**16 / (10**8 + (p * _inputE4) / 10**4);
        int256 X2 = (inputE4 * inputE4) / 2;
        int256 exp2X2 =
            10**8 +
                X2 +
                (X2**2 / (2 * 10**8)) +
                (X2**3 / (6 * 10**16)) +
                (X2**4 / (24 * 10**24)) +
                (X2**5 / (120 * 10**32)) +
                (X2**6 / (720 * 10**40));
        int256 Z = (10**24 / exp2X2) / SQRT_2PI_E8;
        int256 y = (b5 * t) / 10**8;
        y = ((y + b4) * t) / 10**8;
        y = ((y + b3) * t) / 10**8;
        y = ((y + b2) * t) / 10**8;
        y = 10**8 - (Z * ((y + b1) * t)) / 10**16;
        return inputE4 > 0 ? y : 10**8 - y;
    }
}
