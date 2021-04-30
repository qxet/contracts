// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOptions.sol";

interface IMarginVault {
    struct Vault {
        uint256 collateral;
        uint256 longId;
        uint256 longAmount;
        uint256 shortId;
        uint256 profit;
        address owner;
    }

    function vaults(uint256)
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            address
        );

    function longTovaultIds(uint256) external view returns (uint256);

    function write(
        address _owner,
        uint256 _longId,
        uint256 _shortId,
        IOptions.OptionSeries memory _long,
        IOptions.OptionSeries memory _short,
        uint256 _longAmount
    ) external returns (uint256 ethAmount);

    function setProfit(uint256 _longId, uint256 _profit) external;

    function deleteVault(uint256 _vaultId) external;
}
