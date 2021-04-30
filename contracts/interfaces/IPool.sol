// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOptions.sol";
import "./IPriceCalculator.sol";

interface IPool {
    /**
     * @notice tick is a section of IV
     *   It has information about the status of the funds in a tick.
     */
    struct Tick {
        uint256 supply;
        uint256 balance;
        uint256 premiumPool;
        uint256 lockedAmount;
        uint256 lockedPremium;
    }

    /**
     * @notice written options compressed
     */
    struct LockedOption {
        uint256 amount;
        uint256 premium;
        LockedPerTick[] shorts;
        LockedPerTick[] longs;
    }

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

    function receiveERC20(address _account, uint256 _amount) external;

    function sendERC20(address _to, uint256 _amount) external;
}
