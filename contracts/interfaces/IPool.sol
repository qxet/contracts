// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOptions.sol";
import "./IPriceCalculator.sol";

interface IPool {
    /**
     * @notice tick is a section of IV
     *   Tick has information about the status of the funds
     * @param supply amount of LP token issued
     * @param balance amount of fund for selling options
     * @param premiumPool amount of fund for buying options
     * @param lockedAmount locked funds for selling options
     * @param lockedPremium locked funds for buying options
     */
    struct Tick {
        uint256 supply;
        uint256 balance;
        uint256 premiumPool;
        uint256 lockedAmount;
        uint256 lockedPremium;
    }

    /**
     * @notice written options
     * @param amount amount of options pool wrote
     * @param premium premium pool received
     * @param shorts LockedPerTick which has short position
     * @param longs LockedPerTick which has long position
     */
    struct LockedOption {
        uint256 amount;
        uint256 premium;
        LockedPerTick[] shorts;
        LockedPerTick[] longs;
    }

    /**
     * @notice tick position
     * @param tickId tick id
     * @param amount amount of option tick has
     * @param premium amount of premium tick received
     */
    struct LockedPerTick {
        uint256 tickId;
        uint256 amount;
        uint256 premium;
    }

    function buy(
        uint256 _id,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external returns (uint256 totalPremium, uint256 protocolFee);

    function sell(
        uint256 _id,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external returns (uint256 totalPremium);

    function exercise(
        uint256 _id,
        uint256 _amount,
        uint256 _payout
    ) external;

    function exercisePoolLongs(uint256 _id, uint256 _spot) external;

    function unlock(uint256 _id) external;

    function sendERC20(address _to, uint256 _amount) external;
}
