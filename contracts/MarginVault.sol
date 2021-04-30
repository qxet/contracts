// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMarginVault.sol";
import "./interfaces/IPool.sol";

/**
 * @notice MarginVault contract to write option
 */
contract MarginVault is IMarginVault, Ownable {
    mapping(uint256 => Vault) public override(IMarginVault) vaults;
    mapping(uint256 => uint256) public override(IMarginVault) longTovaultIds;

    uint256 vaultCount;

    function write(
        address _owner,
        uint256 _longId,
        uint256 _shortId,
        IOptions.OptionSeries memory _long,
        IOptions.OptionSeries memory _short,
        uint256 _longAmount
    ) external override(IMarginVault) onlyOwner returns (uint256 ethAmount) {
        require(_long.expiry == _short.expiry, "MarginVault: expirations must be same");
        require(_long.optionType == _short.optionType, "MarginVault: option types must be same");
        if (_long.optionType == IPriceCalculator.OptionType.Call) {
            if (_long.strike >= _short.strike) {
                // bear call
                ethAmount = (_longAmount * (_long.strike - _short.strike)) / _short.strike;
            } else {
                // bull call
                ethAmount = 0;
            }
        } else if (_long.optionType == IPriceCalculator.OptionType.Put) {
            if (_long.strike <= _short.strike) {
                // bull put
                ethAmount = (_longAmount * (_short.strike - _long.strike)) / _long.strike;
            } else {
                // bear put
                ethAmount = 0;
            }
        } else {
            revert("MarginVault: invalid option type");
        }
        vaultCount += 1;
        vaults[vaultCount] = Vault(ethAmount, _longId, _longAmount, _shortId, 0, _owner);
        longTovaultIds[_longId] = vaultCount;
    }

    function setProfit(uint256 _longId, uint256 _profit) external override(IMarginVault) onlyOwner {
        Vault storage vault = vaults[longTovaultIds[_longId]];
        vault.profit = _profit;
    }

    function deleteVault(uint256 _vaultId) external override(IMarginVault) onlyOwner {
        delete vaults[_vaultId];
    }
}
