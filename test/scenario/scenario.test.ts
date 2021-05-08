import {
  OptionsInstance,
  PoolInstance,
  MockChainlinkAggregatorInstance,
  MockStakingInstance,
  MockERC20Instance,
  MockMarginVaultInstance,
} from '../../build/types/truffle-types'
import { formatEther, genRangeId, scale } from '../utils'
const { expectRevert, time } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const Options = artifacts.require('Options.sol')
const Pool = artifacts.require('Pool.sol')
const MockMarginVault = artifacts.require('MockMarginVault.sol')
const MockChainlinkAggregator = artifacts.require('MockChainlinkAggregator.sol')
const MockStaking = artifacts.require('MockStaking.sol')
const MockERC20 = artifacts.require('MockERC20.sol')
const PriceCalculator = artifacts.require('PriceCalculator.sol')
const PoolLib = artifacts.require('PoolLib.sol')
const FixedPointLib = artifacts.require('FixedPointLib.sol')

contract('Scenario Test', ([alice, bob]) => {
  let weth: MockERC20Instance
  let mockMarginVault: MockMarginVaultInstance
  let options: OptionsInstance
  let pool: PoolInstance
  let ethUsdAggregator: MockChainlinkAggregatorInstance
  const uri = ''

  const strike = new BN(2220).mul(new BN('10').pow(new BN('8')))

  // 10 ETH
  const depositAmount = new BN(10).mul(new BN('10').pow(new BN('18')))

  async function buy(maturity: number, strike: BN, amount: BN, from: string) {
    const response = await options.buyERC20Option(maturity, strike, amount, { from: from })
    const optionId = response.logs[1].args.optionId
    const premium = response.logs[1].args.premium
    const protocolFee = response.logs[1].args.protocolFee
    return {
      optionId,
      premium,
      protocolFee,
    }
  }

  async function sell(optionId: BN, amount: BN, from: string) {
    const response = await options.sellERC20Option(optionId, amount, { from: from })
    const premium = response.logs[1].args.premium
    const protocolFee = response.logs[1].args.protocolFee
    return {
      optionId,
      premium,
      protocolFee,
    }
  }

  beforeEach(async () => {
    const lib = await PriceCalculator.new()
    await Pool.link('PriceCalculator', lib.address)
    const poolLib = await PoolLib.new()
    await Pool.link('PoolLib', poolLib.address)
    const fixedPointLib = await FixedPointLib.new()
    await Pool.link('FixedPointLib', fixedPointLib.address)

    weth = await MockERC20.new('MOCK', 'MOCK')
    ethUsdAggregator = await MockChainlinkAggregator.new()
    const mockStaking: MockStakingInstance = await MockStaking.new('MOCK_STAKING', 'MOCK')

    pool = await Pool.new(weth.address)
    mockMarginVault = await MockMarginVault.new()
    options = await Options.new(
      uri,
      weth.address,
      pool.address,
      mockMarginVault.address,
      ethUsdAggregator.address,
      mockStaking.address,
    )
    await pool.transferOwnership(options.address)

    // spot price is $2200
    await ethUsdAggregator.setLatestAnswer(scale(2200, 8))
    // deposit
    weth.mint(alice, depositAmount, { from: alice })
    weth.approve(pool.address, depositAmount, { from: alice })
    await pool.depositERC20(depositAmount, 4, 6, { from: alice })
  })

  describe('buy option', () => {
    // 0.2 ETH
    const amount = new BN(2).mul(new BN('10').pow(new BN('17')))
    // 0.02 ETH
    const smallAmount = new BN(2).mul(new BN('10').pow(new BN('16')))

    it('buy option and exercise', async () => {
      // set up preconditions
      const strike = scale(1900, 8)
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })
      // spot price is $1900
      await ethUsdAggregator.setLatestAnswer(scale(1900, 8))

      // create option
      const before1 = await weth.balanceOf(bob)
      const result = await buy(60 * 60 * 24 * 7, strike, amount, bob)
      const after1 = await weth.balanceOf(bob)
      await time.increase(60 * 60 * 24)

      // spot price is $2000
      const spotPrice = scale(2000, 8)
      await ethUsdAggregator.setLatestAnswer(spotPrice)

      // exercise
      const before2 = await weth.balanceOf(bob)
      await options.exerciseERC20(result.optionId, amount, { from: bob })
      const after2 = await weth.balanceOf(bob)

      // check premium
      assert.equal(after1.sub(before1).toString(), result.premium.add(result.protocolFee).neg().toString())
      // check payout
      // 2 * $100 / $2000
      assert.equal(after2.sub(before2).toString(), amount.mul(spotPrice.sub(strike)).div(spotPrice))
    })

    it('buy options and exercise', async () => {
      // set up preconditions
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })

      // buy options
      const optionIds = []
      for (let i = 0; i < 3; i++) {
        const result = await buy(60 * 60 * 24 * 7, strike, smallAmount, bob)
        optionIds.push(result.optionId)
      }

      await time.increase(60 * 60 * 24)

      // $2250
      const spot = new BN(2250).mul(new BN('10').pow(new BN('8')))
      await ethUsdAggregator.setLatestAnswer(spot)

      for (const id of optionIds) {
        await options.exerciseERC20(id, smallAmount, { from: bob })
      }
    })

    it('buy option and can not exercise', async () => {
      // set up preconditions
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })

      // create option
      const result = await buy(60 * 60 * 24 * 28, strike, amount, bob)
      const optionId = result.optionId

      // 28 days later
      await time.increase(60 * 60 * 24 * 28 - 60)

      // $2210
      const spot = new BN(2210).mul(new BN('10').pow(new BN('8')))
      await ethUsdAggregator.setLatestAnswer(spot)

      await expectRevert(
        options.exerciseERC20(optionId, amount, { from: bob }),
        'Options: price must be greater than strike price',
      )
    })

    it('buy and sell option', async () => {
      // set up preconditions
      const amount = scale(1, 18)
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })
      // spot price is $2250
      await ethUsdAggregator.setLatestAnswer(scale(2250, 8))

      const position1 = await pool.positions(0, 3)

      const before1 = await weth.balanceOf(bob)
      const result = await buy(60 * 60 * 24 * 7, strike, amount, bob)
      const after1 = await weth.balanceOf(bob)
      const optionId = result.optionId

      const position2 = await pool.positions(0, 3)
      assert.isTrue(position2.gt(position1))

      // spot price is $2260
      await ethUsdAggregator.setLatestAnswer(scale(2260, 8))

      await expectRevert(options.sellERC20Option(optionId, amount, { from: bob }), 'Pool: 1. tick must be positive')

      // spot price is $2230
      await ethUsdAggregator.setLatestAnswer(scale(2230, 8))

      // sell option
      const before2 = await weth.balanceOf(bob)
      const sellReceipt = await sell(optionId, amount, bob)
      const after2 = await weth.balanceOf(bob)

      const position3 = await pool.positions(0, 3)
      assert.isTrue(position2.gt(position3))

      assert.equal(after1.sub(before1).toString(), result.premium.add(result.protocolFee).neg().toString())
      assert.equal(after2.sub(before2).toString(), sellReceipt.premium.toString())

      // 7 days later
      await time.increase(60 * 60 * 24 * 7 + 60)

      await options.unlock(optionId)

      const poolProfit = result.premium.sub(sellReceipt.premium)
      const available = await pool.getAvailableBalance(4, 6)
      assert.equal(available.toString(), depositAmount.add(poolProfit).toString())
      console.log('poolProfit', depositAmount.add(poolProfit).toString())

      const rangeId = genRangeId(4, 6)
      const beforeLPToken = await pool.balanceOf(alice, rangeId)

      await pool.withdrawERC20(depositAmount.add(poolProfit), rangeId, { from: alice })
      const afterLPToken = await pool.balanceOf(alice, rangeId)
      assert.equal(formatEther(beforeLPToken.sub(afterLPToken)), '10.0')
    })
  })
})
