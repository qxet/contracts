// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IStaking.sol";

contract MockStaking is ERC20, IStaking {
    constructor(string memory name, string memory short) ERC20(name, short) {}

    function sendProfitERC20(address _account, uint256 _amount) external override {
        require(_amount > 0);
    }
}
