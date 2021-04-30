// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IPriceCalculator.sol";

interface IOptions {
    struct OptionSeries {
        uint256 expiry;
        uint256 strike;
        IPriceCalculator.OptionType optionType;
    }
}
