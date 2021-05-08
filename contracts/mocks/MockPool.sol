// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IPriceCalculator.sol";

contract MockPool is IPool, ERC20 {
    address asset;

    /**
     */
    constructor(address _asset) ERC20("Predy LP", "PRE-LP") {
        asset = _asset;
    }

    /**
     * @param _amount amount
     */
    function depositERC20(uint256 _amount) external {}

    function withdrawERC20(uint256 _amount) public {}

    /**
     * @notice get share per LP token
     */
    function getSupplyPerBalance() public view returns (uint256) {
        return 1e8;
    }

    /**
     * @notice get total balance of pool
     */
    function getBalance() public view returns (uint256) {
        return 1e8;
    }

    /**
     * @notice get pool balance value which is available for write option
     */
    function getAvailableBalance() public view returns (uint256) {
        return 1e8;
    }

    function buy(
        uint256 _id,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external override(IPool) returns (uint256 totalPremium, uint256 protocolFee) {
        totalPremium = _amount / 20;
        protocolFee = (8 * _amount) / 1000;
    }

    function sell(
        uint256 _id,
        uint256 _spotPrice,
        uint256 _amount,
        uint256 _maturity,
        uint256 _strike,
        IPriceCalculator.OptionType _optionType
    ) external override(IPool) returns (uint256 totalPremium) {}

    function exercise(
        uint256 _id,
        uint256 _amount,
        uint256 _payout
    ) external override(IPool) {}

    function exercisePoolLongs(uint256 _id, uint256 _profit) external override(IPool) {}

    function unlock(uint256 _id) external override(IPool) {}

    function sendERC20(address _to, uint256 _amount) external override(IPool) {
        IERC20 token = IERC20(asset);
        token.transfer(_to, _amount);
    }
}
