// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IMarginVault.sol";

contract MockMarginVault is IMarginVault {
    mapping(uint256 => Vault) public override(IMarginVault) vaults;
    mapping(uint256 => uint256) public override(IMarginVault) longTovaultIds;

    function write(
        address _owner,
        uint256 _longId,
        uint256 _shortId,
        IOptions.OptionSeries memory _long,
        IOptions.OptionSeries memory _short,
        uint256 _longAmount
    ) external override(IMarginVault) returns (uint256 ethAmount) {}

    function setProfit(uint256 _longId, uint256 _profit) external override(IMarginVault) {}

    function deleteVault(uint256 _vaultId) external override(IMarginVault) {
        delete vaults[_vaultId];
    }
}
