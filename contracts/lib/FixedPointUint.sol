// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title FixedPointUint
 * @notice FixedPoint library to calculate numbers with diffrent decimals
 */
library FixedPointLib {
    uint256 private constant SCALING_FACTOR = 1e27;
    uint256 private constant BASE_DECIMALS = 27;

    struct FixedPointUint {
        uint256 value;
    }

    /**
     * @notice converts unsigned int to FixedPointUint object
     */
    function fromUnscaledUint(uint256 a) internal pure returns (FixedPointUint memory) {
        return FixedPointUint(a * SCALING_FACTOR);
    }

    /**
     * @notice converts unsigned int which is scaled with _decimals to FixedPointUint object
     */
    function fromScaledUint(uint256 _a, uint256 _decimals) internal pure returns (FixedPointUint memory) {
        FixedPointUint memory fixedPoint;

        if (_decimals == BASE_DECIMALS) {
            fixedPoint = FixedPointUint(_a);
        } else if (_decimals > BASE_DECIMALS) {
            uint256 exp = _decimals - BASE_DECIMALS;
            fixedPoint = FixedPointUint(_a / 10**exp);
        } else {
            uint256 exp = BASE_DECIMALS - _decimals;
            fixedPoint = FixedPointUint(_a * 10**exp);
        }

        return fixedPoint;
    }

    /**
     * @notice converts FixedPointUint object to unsigned int which is scaled with _decimals
     */
    function toScaledUint(
        FixedPointUint memory _a,
        uint256 _decimals,
        bool _roundDown
    ) internal pure returns (uint256) {
        uint256 scaledUint;

        if (_decimals == BASE_DECIMALS) {
            scaledUint = _a.value;
        } else if (_decimals > BASE_DECIMALS) {
            uint256 exp = _decimals - BASE_DECIMALS;
            scaledUint = _a.value * 10**exp;
        } else {
            uint256 exp = BASE_DECIMALS - _decimals;
            uint256 tailing;
            if (!_roundDown) {
                uint256 remainer = _a.value % 10**exp;
                if (remainer > 0) tailing = 1;
            }
            scaledUint = (_a.value / 10**exp) + tailing;
        }

        return scaledUint;
    }

    function add(FixedPointUint memory a, FixedPointUint memory b) internal pure returns (FixedPointUint memory) {
        return FixedPointUint(a.value + b.value);
    }

    function sub(FixedPointUint memory a, FixedPointUint memory b) internal pure returns (FixedPointUint memory) {
        return FixedPointUint(a.value - b.value);
    }

    function mul(FixedPointUint memory a, FixedPointUint memory b) internal pure returns (FixedPointUint memory) {
        return FixedPointUint((a.value * b.value) / SCALING_FACTOR);
    }

    function div(FixedPointUint memory a, FixedPointUint memory b) internal pure returns (FixedPointUint memory) {
        return FixedPointUint((a.value * SCALING_FACTOR) / b.value);
    }
}
