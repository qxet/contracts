// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Pool.sol";
import "./lib/AoNPriceCalculator.sol";

/**
 * @notice Asset-or-nothing Options Pool contract manages the pool of funds to write options
 */
contract AoNPool is Pool {
    constructor(address _asset) Pool(_asset) {}

    /**
     * @notice buy options
     * @param _optionId option id
     * @param _spotPrice spot price
     * @param _amount amount to buy
     * @param _maturity maturity in second
     * @param _strike strike price scaled by 1e8
     * @param _optionType option type
     * @return totalPremium total premium and protocol fee
     */
    function buy(
        uint256 _optionId,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external override(Pool) onlyOwner returns (uint256 totalPremium, uint256) {
        {
            require(_spotPrice == _strike, "AoNPool: only ATM option is available");
            Step memory step = Step(0, 0, 0, _amount, 0);
            {
                uint256 moneyness = (100 * _strike) / _spotPrice;
                (uint256 currentTick, uint256 currentPosition) = getPosition(_maturity, moneyness);
                step.currentTick = currentTick;
                step.position = currentPosition;
            }
            while (step.remain != 0) {
                Tick storage state = ticks[step.currentTick];
                if (step.currentTick > 20) {
                    revert("too large tick");
                }
                uint256 nextTick = step.currentTick + 1;
                if (state.balance - state.lockedAmount == 0) {
                    step.currentTick += 1;
                    continue;
                }
                if (step.position < 1e6 * (step.currentTick**2)) {
                    step.position = 1e6 * (step.currentTick**2);
                }
                // cauculate slope of liner function(x:amount, y:IV)
                // slope is 'moneyness * (upper IV - lower IV) / available balance'
                uint256 kE8 =
                    (1e18 * _strike * (1e6 * ((nextTick)**2) - step.position)) /
                        (_spotPrice * (state.balance - state.lockedAmount));
                {
                    require(state.balance >= state.lockedAmount, "state.balance >= state.lockedAmount");
                    // step.position must be less than upper IV through a step
                    uint256 available =
                        PoolLib.min(
                            (1e18 * PoolLib.sub(1e6 * ((nextTick)**2), step.position)) / kE8,
                            state.balance - state.lockedAmount
                        );
                    if (available >= step.remain) {
                        step.stepAmount = step.remain;
                        step.remain = 0;
                    } else {
                        step.stepAmount = available;
                        require(step.remain >= step.stepAmount, "step.remain >= step.stepAmount");
                        step.remain -= step.stepAmount;
                        step.currentTick = nextTick;
                    }
                    if (step.stepAmount == 0) {
                        break;
                    }
                }

                uint256 premium =
                    AoNPriceCalculator.calculateOptionPrice(
                        _spotPrice,
                        _strike,
                        _maturity,
                        step.position,
                        step.stepAmount / 1e10,
                        kE8,
                        _optionType,
                        false
                    );
                require(step.position <= 1e6 * ((nextTick)**2), "step.position must be less than upper");
                step.position += (kE8 * step.stepAmount) / 1e18;

                premium = (premium * 1e18) / _spotPrice;
                premium += calculateSpread(premium);

                totalPremium += premium;

                updateShortOption(locks[_optionId], step.currentTick, step.stepAmount, premium);

                // update state
                state.lockedAmount += step.stepAmount;
                state.lockedPremium += premium;
                state.premiumPool += premium;
            }

            setPosition(_maturity, (100 * _strike) / _spotPrice, uint64(step.position));
        }

        if (locks[_optionId].amount > 0) {
            locks[_optionId].amount += _amount;
            locks[_optionId].premium += totalPremium;
        } else {
            locks[_optionId].amount = _amount;
            locks[_optionId].premium = totalPremium;
        }

        uint256 protocolFee = calculateProtocolFee(_amount);
        return (totalPremium, protocolFee);
    }

    /**
     * @notice sell options
     * @param _optionId option id
     * @param _spotPrice spot price
     * @param _amount amount to sell
     * @param _maturity maturity in second
     * @param _strike strike price scaled by 1e8
     * @return totalPremium total premium
     */
    function sell(
        uint256 _optionId,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external override(Pool) onlyOwner returns (uint256 totalPremium) {
        require(_maturity > 0 && _maturity < 31536000, "the _maturity should not have expired and less than 1 year");

        Step memory step = Step(0, 0, 0, _amount, 0);
        {
            uint256 moneyness = (100 * _strike) / _spotPrice;
            (uint256 currentTick, uint256 currentPosition) = getPosition(_maturity, moneyness);
            step.currentTick = currentTick;
            step.nextTick = currentTick;
            step.position = currentPosition;
        }
        while (step.remain != 0) {
            Tick storage state = ticks[step.currentTick];
            if (state.premiumPool == 0) {
                if (step.currentTick == 0) {
                    revert("Pool: 1. tick must be positive");
                }
                step.currentTick -= 1;
                continue;
            }
            if (step.position > 1e6 * ((step.currentTick + 1)**2)) {
                step.position = 1e6 * ((step.currentTick + 1)**2);
            }

            // cauculate slope of liner function(x:amount, y:IV)
            // slope is 'moneyness * bs * (position + lower IV) * (position - lower IV) / (2 * available premium pool)'
            uint256 bs = AoNPriceCalculator.calStartPrice(_spotPrice, _strike, _maturity, step.position, _optionType);
            uint256 kE8 =
                (1e10 * bs * _strike * (step.position**2 - (1e6 * (step.currentTick**2))**2)) /
                    (2 * state.premiumPool * (_spotPrice**2));
            {
                uint256 available = (1e18 * PoolLib.sub(step.position, 1e6 * (step.currentTick**2))) / kE8;
                if (available >= step.remain) {
                    step.stepAmount = step.remain;
                    step.remain = 0;
                } else {
                    step.stepAmount = available;
                    require(step.remain >= step.stepAmount, "step.remain >= step.stepAmount");
                    step.remain -= step.stepAmount;
                    if (step.currentTick == 0) {
                        revert("Pool: 2. tick must be positive");
                    }
                    if (_spotPrice >= _strike) {
                        step.nextTick = step.currentTick - 1;
                    } else {
                        step.nextTick = step.currentTick + 1;
                    }
                }
                if (step.stepAmount == 0) {
                    break;
                }
            }

            {
                if (_spotPrice >= _strike) {
                    // OTM and ATM
                    require(step.position >= 1e6 * (step.currentTick**2), "step.position must be greater than lower");
                    step.position -= (kE8 * step.stepAmount) / 1e18;
                }
                uint256 premium =
                    AoNPriceCalculator.calculateOptionPrice(
                        _spotPrice,
                        _strike,
                        _maturity,
                        step.position,
                        step.stepAmount / 1e10,
                        kE8,
                        _optionType,
                        true
                    );

                if (_spotPrice < _strike) {
                    // ITM
                    require(
                        step.position <= 1e6 * ((step.currentTick + 1)**2),
                        "step.position must be less than upper"
                    );
                    step.position += (kE8 * step.stepAmount) / 1e18;
                }

                premium = (premium * 1e18) / _spotPrice;
                premium -= calculateSpread(premium);

                totalPremium += premium;

                // update state
                require(state.premiumPool >= premium, "Pool: no enough pool");
                state.premiumPool -= premium;

                // unlock amount
                updateLongOption(_optionId, state, step.currentTick, step.stepAmount, premium);
            }
            step.currentTick = step.nextTick;
        }
        require(step.remain == 0, "Pool: no enough avaiable balance");

        {
            uint256 moneyness = (100 * _strike) / _spotPrice;
            setPosition(_maturity, moneyness, uint64(step.position));
        }
    }
}
