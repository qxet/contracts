Predy Pool
=====

![](https://github.com/predyprotocol/contracts/workflows/Test/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/predyprotocol/contracts/badge.svg?branch=main)](https://coveralls.io/github/predyprotocol/contracts?branch=main)

Predy is an option-specific AMM protocol.

# Introduction

We propose a solution to the problem of option protocols on Ethereum. Existing problems include the low supply of options and high prices. These problems are caused by the difficulty in setting option prices. In order to set the price (premium) of an option, it is necessary to estimate the IV(Implied Volatility). There is a difficulty in accurately estimating the implied volatility and efficiently setting it in a smart contract by decentralized manner.

## Proposal: Option pools independent of the IV oracle.

Create an option pool that can effectively adjust prices without relying on arbitrage.

There is no need to centralize the IV in this option pool.
There is also no need to rely on Oracle, and there is the potential to support more than just ETH and BTC.

### About Pools

TODO

* Concentrating liquidity in a specific range of IVs can increase the pool's funding efficiency.
* Option prices change dynamically depending on the condition of the pool, purchase or sale.

### Predy Features

* Traders can buy 1 day, 1 week, or 2 week options at any time.
* Not dependent on the IV oracle (management cannot intentionally set a low IV)
* Can be used for more than just ETH and BTC
* Pool is capital efficient, since liquidity is concentrated in a specific IV range
* Traders can formulate Call spread and Put spread strategies.

## Smart Contract

### Option

* You can buy and sell ETH and BTC options at any time.
* American Type Options
* Tokens are ERC1155 compliant

### Pool

* The pool can be supplied with ETH and BTC to earn trading fees.
* LPs can provide funds to a specific IV range.
* The price of the options is determined by the Black sholes Model, but it fluctuates according to supply and demand.

### BondingCurve

* Conduct a fair and open PREDY token launch
* To ensure the liquidity of the initial protocol.
* To development fund

### Staking

By staking PREDY tokens, you get a profit share of the protocol.

### Reward

You earn additional PREDY tokens by funding the pool or buying and selling options.
