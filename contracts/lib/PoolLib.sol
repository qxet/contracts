// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPool.sol";

/**
 * @title PoolLib
 */
library PoolLib {
    function addBalance(
        mapping(uint256 => IPool.Tick) storage ticks,
        uint256 _tickStart,
        uint256 _tickEnd,
        uint256 _issued,
        uint256 _amount
    ) internal {
        require(_tickStart < _tickEnd, "Pool: tickStart < tickEnd");
        uint256 issuedPerTick = _issued / (_tickEnd - _tickStart);
        uint256 amountPerTick = _amount / (_tickEnd - _tickStart);
        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            IPool.Tick storage tick = ticks[i];
            tick.supply += issuedPerTick;
            uint256 total = tick.balance + tick.premiumPool;
            if (total == 0) {
                tick.balance += amountPerTick;
            } else {
                tick.balance += (amountPerTick * tick.balance) / total;
                tick.premiumPool += (amountPerTick * tick.premiumPool) / total;
            }
        }
    }

    function removeBalance(
        mapping(uint256 => IPool.Tick) storage ticks,
        uint256 _tickStart,
        uint256 _tickEnd,
        uint256 _burn,
        uint256 _amount
    ) internal {
        require(_tickStart < _tickEnd, "Pool: tickStart < tickEnd");
        uint256 burnPerTick = _burn / (_tickEnd - _tickStart);

        uint256 total;
        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            IPool.Tick memory tick = ticks[i];
            total += tick.balance + tick.premiumPool - tick.lockedPremium;
        }

        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            IPool.Tick storage tick = ticks[i];
            tick.balance -= (tick.balance * _amount) / total;
            tick.premiumPool -= ((tick.premiumPool - tick.lockedPremium) * _amount) / total;
            tick.supply -= burnPerTick;
        }
    }

    function getSeparation(uint256 moneyness) internal pure returns (uint256) {
        if (moneyness == 1) {
            return 85;
        } else if (moneyness == 2) {
            return 91;
        } else if (moneyness == 3) {
            return 97;
        } else if (moneyness == 4) {
            return 103;
        } else if (moneyness == 5) {
            return 109;
        }
    }

    function _calMaturityAndMoneyness(uint256 _m, uint256 _moneyness) internal pure returns (uint256, uint256) {
        uint256 maturity;
        if (_m <= 1 weeks) {
            maturity = 0;
        } else if (_m <= 4 weeks) {
            maturity = 1;
        } else {
            maturity = 2;
        }
        uint256 moneyness;
        if (_moneyness < 85) {
            moneyness = 0;
        } else if (_moneyness < 91) {
            moneyness = 1;
        } else if (_moneyness < 97) {
            moneyness = 2;
        } else if (_moneyness < 103) {
            moneyness = 3;
        } else if (_moneyness < 109) {
            moneyness = 4;
        } else {
            moneyness = 5;
        }
        return (maturity, moneyness);
    }

    // Range
    function genRangeId(uint256 _tickStart, uint256 _tickEnd) public pure returns (uint256) {
        return _tickStart + 1e2 * _tickEnd;
    }

    function getRange(uint256 _rangeId) public pure returns (uint256 _start, uint256 _end) {
        _start = _rangeId % 1e2;
        _end = _rangeId / 1e2;
    }

    function min(uint256 _a, uint256 _b) internal pure returns (uint256) {
        if (_a < _b) {
            return _a;
        } else {
            return _b;
        }
    }

    function sub(uint256 _a, uint256 _b) internal pure returns (uint256) {
        if (_a >= _b) {
            return _a - _b;
        } else {
            return 0;
        }
    }
}
