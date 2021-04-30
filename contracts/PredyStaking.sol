// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IStaking.sol";

/**
 * @notice Staking token with incentive distribution.
 */
contract PredyStaking is ERC20, IStaking {
    /// @dev PREDY token
    IERC20 public immutable PREDY;
    IERC20 public immutable token;

    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant LOT_PRICE = 1_000e18;

    uint256 public lockupPeriod = 1 days;

    uint256 totalProfit;
    mapping(address => uint256) lastProfit;
    mapping(address => uint256) savedProfit;

    mapping(address => uint256) public lastBoughtTimestamp;
    mapping(address => bool) public _revertTransfersInLockUpPeriod;

    event Claimed(address account, uint256 profit);
    event ProfitReceived(address asset, uint256 amount);

    modifier lockupFree {
        require(
            lastBoughtTimestamp[msg.sender] + (lockupPeriod) <= block.timestamp,
            "PredyStaking: action suspended due to lockup"
        );
        _;
    }

    constructor(ERC20 _predy, ERC20 _token) ERC20("predy staking", "sPREDY") {
        PREDY = _predy;
        token = _token;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function claimProfit() external returns (uint256 profit) {
        profit = saveProfit(msg.sender);
        require(profit > 0, "PredyStaking: 0 profit");
        savedProfit[msg.sender] = 0;
        _transferProfit(profit);
        emit Claimed(msg.sender, profit);
    }

    function buy(uint256 amount) external {
        lastBoughtTimestamp[msg.sender] = block.timestamp;
        require(amount > 0, "PredyStaking: amount is 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "PredyStaking: supply reached max limitaion");
        _mint(msg.sender, amount);
        PREDY.transferFrom(msg.sender, address(this), amount * (LOT_PRICE));
    }

    function sell(uint256 amount) external lockupFree {
        _burn(msg.sender, amount);
        PREDY.transfer(msg.sender, amount * (LOT_PRICE));
    }

    /**
     * @notice Used for ...
     */
    function revertTransfersInLockUpPeriod(bool value) external {
        _revertTransfersInLockUpPeriod[msg.sender] = value;
    }

    function profitOf(address account) external view returns (uint256) {
        return savedProfit[account] + (getUnsaved(account));
    }

    function getUnsaved(address account) internal view returns (uint256 profit) {
        return ((totalProfit - lastProfit[account]) * balanceOf(account)) / (MAX_SUPPLY);
    }

    function saveProfit(address account) internal returns (uint256 profit) {
        uint256 unsaved = getUnsaved(account);
        lastProfit[account] = totalProfit;
        profit = savedProfit[account] + unsaved;
        savedProfit[account] = profit;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal override {
        if (from != address(0)) saveProfit(from);
        if (to != address(0)) saveProfit(to);
        if (
            lastBoughtTimestamp[from] + lockupPeriod > block.timestamp &&
            lastBoughtTimestamp[from] > lastBoughtTimestamp[to]
        ) {
            require(!_revertTransfersInLockUpPeriod[to], "the recipient does not accept blocked funds");
            lastBoughtTimestamp[to] = lastBoughtTimestamp[from];
        }
    }

    function sendProfitERC20(address _account, uint256 _amount) external override {
        token.transferFrom(_account, address(this), _amount);
        totalProfit += _amount;
        emit ProfitReceived(address(0), _amount);
    }

    function _transferProfit(uint256 amount) internal {
        token.transfer(msg.sender, amount);
    }
}
