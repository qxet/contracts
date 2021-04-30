// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @notice Mock of Chainlink Aggregator contract
 */
contract MockChainlinkAggregator {
    int256 internal lastAnswer;

    function latestAnswer() external view returns (int256) {
        return lastAnswer;
    }

    function setLatestAnswer(int256 _answer) external {
        lastAnswer = _answer;
    }
}
