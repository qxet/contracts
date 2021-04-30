// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract BondingCurve {
    IERC20 public token;
    uint256 public soldAmount;
    address payable public devFund;
    uint256 public constant comissionRatio = 10;

    event Bought(address indexed account, uint256 amount, uint256 ethAmount);
    event Sold(address indexed account, uint256 amount, uint256 ethAmount, uint256 comission);

    constructor(IERC20 _token) {
        token = _token;
        devFund = payable(msg.sender);
    }

    function buy(uint256 _tokenAmount) external payable {
        uint256 nextSold = soldAmount + _tokenAmount;
        uint256 ethAmount = s(soldAmount, nextSold);
        soldAmount = nextSold;
        require(msg.value >= ethAmount, "BondingCurve: msg.value is too small");
        token.transfer(msg.sender, _tokenAmount);
        if (msg.value > ethAmount) {
            payable(msg.sender).transfer(msg.value - ethAmount);
        }
        emit Bought(msg.sender, _tokenAmount, ethAmount);
    }

    function sell(uint256 _tokenAmount) external {
        uint256 nextSold = soldAmount - _tokenAmount;
        uint256 ethAmount = s(nextSold, soldAmount);
        uint256 comission = ethAmount / comissionRatio;
        uint256 refund = ethAmount - comission;
        require(comission > 0);

        soldAmount = nextSold;
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        devFund.transfer(comission);
        payable(msg.sender).transfer(refund);
        emit Sold(msg.sender, _tokenAmount, refund, comission);
    }

    function s(uint256 x0, uint256 x1) public view virtual returns (uint256);
}
