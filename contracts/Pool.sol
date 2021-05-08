// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOptions.sol";
import "./interfaces/IPool.sol";
import "./lib/PriceCalculator.sol";
import "./lib/AdvancedMath.sol";
import "./lib/PoolLib.sol";
import {FixedPointLib as FPL} from "./lib/FixedPointLib.sol";

/**
 * @notice Pool contract manages the pool of funds to write options
 */
contract Pool is IPool, ERC1155, Ownable {
    using FPL for FPL.FixedPointUint;
    address immutable asset;

    // tickId => tick object
    mapping(uint256 => Tick) public ticks;
    // maturity => moneyness => position
    uint64[5][3] public positions;
    // locked option id => locked option
    mapping(uint256 => IPool.LockedOption) public locks;

    event Deposited(address account, address asset, uint256 amount, uint256 mint);
    event Withdrawn(address account, address asset, uint256 amount, uint256 burn);

    /// @dev buy and sell step information
    struct Step {
        uint256 currentTick;
        uint256 nextTick;
        uint256 stepAmount;
        uint256 remain;
        uint256 position;
    }

    /**
     */
    constructor(address _asset) ERC1155("") {
        asset = _asset;
    }

    /**
     * @notice deposit funds to pool
     * @param _amount amount of asset
     * @param _tickStart lower tick
     * @param _tickEnd upper tick
     */
    function depositERC20(
        uint256 _amount,
        uint256 _tickStart,
        uint256 _tickEnd
    ) public {
        require(_amount > 0, "Pool: amounts must not be 0");
        FPL.FixedPointUint memory amount = FPL.fromScaledUint(_amount, 18);
        IERC20(asset).transferFrom(msg.sender, address(this), _amount);
        uint256 mint = amount.mul(getSupplyPerBalance(_tickStart, _tickEnd)).toScaledUint(18, false);
        PoolLib.addBalance(ticks, _tickStart, _tickEnd, mint, _amount);
        // mint LP tokens
        uint256 rangeId = PoolLib.genRangeId(_tickStart, _tickEnd);
        _mint(msg.sender, rangeId, mint, "");
        emit Deposited(msg.sender, asset, _amount, mint);
    }

    /**
     * @notice withdraw funds from pool
     * @param _amount amount of asset
     * @param _rangeId range id represents lower tick to upper tick
     */
    function withdrawERC20(uint256 _amount, uint256 _rangeId) external {
        require(_amount > 0);
        (uint256 tickStart, uint256 tickEnd) = PoolLib.getRange(_rangeId);
        FPL.FixedPointUint memory amount = FPL.fromScaledUint(_amount, 18);
        uint256 burn = amount.mul(getSupplyPerBalance(tickStart, tickEnd)).toScaledUint(18, false);
        require(getAvailableBalance(tickStart, tickEnd) >= _amount, "Pool: amount is too big");
        PoolLib.removeBalance(ticks, tickStart, tickEnd, burn, _amount);
        _burn(msg.sender, _rangeId, burn);
        IERC20(asset).transfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, asset, _amount, burn);
    }

    /**
     * @notice get supply per balance
     * @param _tickStart lower tick
     * @param _tickEnd upper tick
     */
    function getSupplyPerBalance(uint256 _tickStart, uint256 _tickEnd) public view returns (FPL.FixedPointUint memory) {
        uint256 totalSupply;
        uint256 balance;
        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            totalSupply += ticks[i].supply;
            if (ticks[i].balance + ticks[i].premiumPool >= ticks[i].lockedPremium) {
                balance += ticks[i].balance + ticks[i].premiumPool - ticks[i].lockedPremium;
            }
        }
        if (totalSupply > 0 && balance > 0) {
            return FPL.fromScaledUint(totalSupply, 18).div(FPL.fromScaledUint(balance, 18));
        } else {
            return FPL.fromUnscaledUint(1);
        }
    }

    /**
     * @notice get total balance of pool
     * @param _tickStart lower tick
     * @param _tickEnd upper tick
     */
    function getBalance(uint256 _tickStart, uint256 _tickEnd) public view returns (uint256) {
        uint256 balance;
        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            if (ticks[i].balance + ticks[i].premiumPool >= ticks[i].lockedPremium) {
                balance += (ticks[i].balance + ticks[i].premiumPool - ticks[i].lockedPremium);
            }
        }
        return balance;
    }

    /**
     * @notice get pool balance value which is available for write option
     * @param _tickStart lower tick
     * @param _tickEnd upper tick
     */
    function getAvailableBalance(uint256 _tickStart, uint256 _tickEnd) public view returns (uint256) {
        uint256 balance;
        for (uint256 i = _tickStart; i < _tickEnd; i++) {
            IPool.Tick storage tick = ticks[i];
            if (tick.balance + tick.premiumPool >= tick.lockedPremium + tick.lockedAmount) {
                balance += (tick.balance + tick.premiumPool - tick.lockedPremium - tick.lockedAmount);
            }
        }
        return balance;
    }

    function getLockedOption(uint256 _optionId) public view returns (LockedOption memory) {
        return locks[_optionId];
    }

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
    ) external virtual override(IPool) onlyOwner returns (uint256 totalPremium, uint256) {
        {
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
                if (step.currentTick > 20) {
                    revert("too large tick");
                }
                if (state.balance == 0) {
                    step.currentTick += 1;
                    continue;
                }
                if (step.position < 1e6 * (step.currentTick**2)) {
                    step.position = 1e6 * (step.currentTick**2);
                }
                // cauculate slope of liner function(x:amount, y:IV)
                // slope is 'moneyness * (upper IV - lower IV) / available balance'
                uint256 kE8 =
                    (1e18 * _strike * (1e6 * ((step.currentTick + 1)**2) - step.position)) /
                        (_spotPrice * (state.balance - state.lockedAmount));
                {
                    // step.position must be less than upper IV through a step
                    uint256 available =
                        PoolLib.min(
                            (1e18 * PoolLib.sub(1e6 * ((step.currentTick + 1)**2), step.position)) / kE8,
                            state.balance - state.lockedAmount
                        );
                    if (available >= step.remain) {
                        step.stepAmount = step.remain;
                        step.remain = 0;
                    } else {
                        step.stepAmount = available;
                        require(step.remain >= step.stepAmount, "step.remain >= step.stepAmount");
                        step.remain -= step.stepAmount;
                        step.nextTick = step.currentTick + 1;
                    }
                    if (step.stepAmount == 0) {
                        break;
                    }
                }
                uint256 premium =
                    PriceCalculator.calculateOptionPrice(
                        _spotPrice,
                        _strike,
                        _maturity,
                        step.position,
                        step.stepAmount / 1e10,
                        kE8,
                        _optionType,
                        false
                    );
                premium = (premium * 1e18) / _spotPrice;
                premium += calculateSpread(premium);

                totalPremium += premium;

                updateShortOption(locks[_optionId], step.currentTick, step.stepAmount, premium);

                require(step.position <= 1e6 * ((step.currentTick + 1)**2), "step.position must be less than upper");
                step.position += (kE8 * step.stepAmount) / 1e18;
                // update state
                state.lockedAmount += step.stepAmount;
                state.lockedPremium += premium;
                state.premiumPool += premium;

                step.currentTick = step.nextTick;
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
    ) external virtual override(IPool) onlyOwner returns (uint256 totalPremium) {
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
            uint256 bs =
                PriceCalculator.calStartPrice(
                    _spotPrice,
                    _strike,
                    _maturity,
                    1e6 * (step.currentTick**2),
                    step.position,
                    _optionType
                );
            uint256 kE8 = (1e26 * _strike * bs) / (state.premiumPool * (_spotPrice**2));
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
                    step.nextTick = step.currentTick - 1;
                }
                if (step.stepAmount == 0) {
                    break;
                }
            }
            require(step.position >= 1e6 * (step.currentTick**2), "step.position must be greater than lower");
            step.position -= (kE8 * step.stepAmount) / 1e18;
            {
                uint256 premium =
                    PriceCalculator.calculateOptionPrice(
                        _spotPrice,
                        _strike,
                        _maturity,
                        step.position,
                        step.stepAmount / 1e10,
                        kE8,
                        _optionType,
                        true
                    );
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

    /**
     * @notice exercise options that trader holds
     * @param _id option id
     * @param _amount amount to exercise
     * @param _payout payout
     */
    function exercise(
        uint256 _id,
        uint256 _amount,
        uint256 _payout
    ) external override(IPool) onlyOwner {
        LockedOption storage option = locks[_id];
        require(option.amount >= _amount, "Pool: no amount left");

        uint256 total;
        for (uint256 i = 0; i < option.shorts.length; i++) {
            total += option.shorts[i].amount;
        }

        for (uint256 i = 0; i < option.shorts.length; i++) {
            uint256 tickId = option.shorts[i].tickId;
            require(ticks[tickId].balance > (option.shorts[i].amount * _payout) / total, "Pool: ");
            ticks[tickId].balance -= (option.shorts[i].amount * _payout) / total;
        }

        unlockPartially(_id, _amount);
    }

    /**
     * @notice exercise long options that pool holds
     * @param _id option id
     * @param _profit profit
     */
    function exercisePoolLongs(uint256 _id, uint256 _profit) external override(IPool) onlyOwner {
        LockedOption storage option = locks[_id];

        // increase balance for long
        uint256 totalPayout;
        uint256 unlockAmount;
        for (uint256 i = 0; i < option.longs.length; i++) {
            uint256 tickId = option.longs[i].tickId;
            uint256 payout = (option.longs[i].amount * _profit) / 1e18;
            ticks[tickId].balance += payout;
            totalPayout += payout;
            unlockAmount += option.longs[i].amount;
        }

        if (unlockAmount == 0) {
            return;
        }

        // decrease balance for short
        for (uint256 i = 0; i < option.shorts.length; i++) {
            uint256 tickId = option.shorts[i].tickId;
            uint256 payout = (option.shorts[i].amount * totalPayout) / unlockAmount;
            require(ticks[tickId].balance >= payout, "Pool: ");
            ticks[tickId].balance -= payout;
        }
        unlockPartially(_id, unlockAmount);
    }

    /**
     * @notice unlock funds after expiration
     */
    function unlock(uint256 _id) external override(IPool) onlyOwner {
        LockedOption storage option = locks[_id];
        require(option.amount > 0, "Pool: no amount left");

        unlockPartially(_id, option.amount);
        // TODO:
        // case exercise -> buy

        delete locks[_id];
    }

    function unlockPartially(uint256 _id, uint256 _amount) internal {
        LockedOption storage option = locks[_id];
        require(option.amount > 0, "Pool: no amount left");

        for (uint256 i = 0; i < option.shorts.length; i++) {
            uint256 tickId = option.shorts[i].tickId;
            uint256 a = (option.shorts[i].amount * _amount) / option.amount;
            uint256 p = (option.shorts[i].premium * _amount) / option.amount;
            ticks[tickId].lockedAmount -= a;
            ticks[tickId].lockedPremium -= p;
            option.shorts[i].amount -= a;
            option.shorts[i].premium -= p;
        }
        option.amount -= _amount;
    }

    function sendERC20(address _to, uint256 _amount) external override(IPool) onlyOwner {
        IERC20 token = IERC20(asset);
        token.transfer(_to, _amount);
    }

    function calculateSpread(uint256 _amount) internal pure returns (uint256) {
        return (_amount * 2) / 100;
    }

    function calculateProtocolFee(uint256 _amount) internal pure returns (uint256) {
        return (_amount * 8) / 1000;
    }

    function setPosition(
        uint256 _m,
        uint256 _moneyness,
        uint64 _newIV
    ) internal {
        (uint256 maturity, uint256 moneyness) = PoolLib._calMaturityAndMoneyness(_m, _moneyness);
        if (moneyness <= 4) {
            positions[maturity][moneyness] = _newIV;
        }
        if (moneyness >= 1) {
            positions[maturity][moneyness - 1] = _newIV;
        }
    }

    function getPosition(uint256 _m, uint256 _moneyness) internal view returns (uint256, uint256) {
        (uint256 maturity, uint256 moneyness) = PoolLib._calMaturityAndMoneyness(_m, _moneyness);
        if (positions[maturity][moneyness] <= 0) {
            return (0, 0);
        }
        uint256 iv;
        if (moneyness == 0) {
            iv = positions[maturity][0];
        } else if (1 <= moneyness && moneyness <= 4) {
            uint64 prePos = positions[maturity][moneyness - 1];
            iv =
                prePos +
                ((_moneyness - PoolLib.getSeparation(moneyness)) * (positions[maturity][moneyness] - prePos)) /
                6;
        } else if (moneyness == 5) {
            iv = positions[maturity][4];
        }
        uint256 sqrtIV = uint256(AdvancedMath._sqrt(int256(iv)));
        uint256 rest = sqrtIV % 1e3;
        uint256 tick = (sqrtIV - rest) / 1e3;
        return (tick, iv);
    }

    function updateShortOption(
        LockedOption storage _option,
        uint256 _tickId,
        uint256 _amount,
        uint256 _premium
    ) internal {
        for (uint256 i = 0; i < _option.shorts.length; i++) {
            if (_option.shorts[i].tickId == _tickId) {
                _option.shorts[i].amount += _amount;
                _option.shorts[i].premium += _premium;
                return;
            }
        }
        _option.shorts.push(LockedPerTick(_tickId, _amount, _premium));
    }

    function updateLongOption(
        uint256 _optionId,
        Tick storage _tick,
        uint256 _tickId,
        uint256 _amount,
        uint256 _premium
    ) internal {
        LockedOption storage option = locks[_optionId];
        // offset collaterals
        uint256 remain = _amount;
        for (uint256 i = 0; i < option.shorts.length; i++) {
            if (_tickId == option.shorts[i].tickId) {
                // unlock amount
                if (option.shorts[i].amount >= _amount) {
                    _tick.lockedAmount -= _amount;
                    option.shorts[i].amount -= _amount;
                    remain = 0;
                } else {
                    remain = _amount - option.shorts[i].amount;
                    _tick.lockedAmount -= option.shorts[i].amount;
                    option.shorts[i].amount = 0;
                }
                // unlock premium
                if (option.shorts[i].premium >= _premium) {
                    _tick.lockedPremium -= _premium;
                    option.shorts[i].premium -= _premium;
                } else {
                    _tick.lockedPremium -= option.shorts[i].premium;
                    option.shorts[i].premium = 0;
                }
            }
        }

        // the tick should have long position if there remain
        if (remain > 0) {
            for (uint256 i = 0; i < option.longs.length; i++) {
                if (option.longs[i].tickId == _tickId) {
                    option.longs[i].amount += remain;
                    return;
                }
            }
            option.longs.push(LockedPerTick(_tickId, remain, 0));
        }
    }
}
