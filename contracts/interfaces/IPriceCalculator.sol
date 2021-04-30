/// from https://github.com/LienFinance/bondmaker
pragma solidity ^0.8.0;

interface IPriceCalculator {
    enum OptionType {Call, Put, CashOrNothingCall, CashOrNothingPut}
}
