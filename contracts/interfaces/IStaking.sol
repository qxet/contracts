// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStaking {
    function sendProfitERC20(address _account, uint256 _amount) external;
}
