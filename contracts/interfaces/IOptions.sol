// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IPriceCalculator.sol";

interface IOptions {
    struct OptionSeries {
        uint64 expiry;
        uint64 strike;
        IPriceCalculator.OptionType optionType;
    }
}
