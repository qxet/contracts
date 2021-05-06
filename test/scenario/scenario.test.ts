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

  beforeEach(async () => {
    const lib = await PriceCalculator.new()
    await Pool.link('PriceCalculator', lib.address)

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
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })
      // spot price is $2200
      await ethUsdAggregator.setLatestAnswer(scale(2200, 8))

      // create option
      const before1 = await weth.balanceOf(bob)
      const result = await options.buyERC20Option(60 * 60 * 24 * 7, strike, amount, { from: bob })
      const after1 = await weth.balanceOf(bob)
      const optionId = result.logs[1].args.optionId
      await time.increase(60 * 60 * 24)

      // spot price is $2250
      await ethUsdAggregator.setLatestAnswer(scale(2250, 8))

      // exercise
      const before2 = await weth.balanceOf(bob)
      await options.exerciseERC20(optionId, amount, { from: bob })
      const after2 = await weth.balanceOf(bob)

      assert.equal(before1.sub(after1).toString(), '2647674885727271')
      assert.equal(after2.sub(before2).toString(), '2666666666666666')
    })

    it('buy options and exercise', async () => {
      // set up preconditions
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })
      // create option
      async function createOption() {
        const result = await options.buyERC20Option(60 * 60 * 24 * 7, strike, smallAmount, { from: bob })
        const optionId = result.logs[1].args.optionId
        return optionId
      }
      const optionIds = []
      optionIds.push(await createOption())
      optionIds.push(await createOption())
      optionIds.push(await createOption())
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
      const result = await options.buyERC20Option(60 * 60 * 24 * 28, strike, amount, { from: bob })
      const optionId = result.logs[1].args.optionId

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
      const amount = new BN(1).mul(new BN('10').pow(new BN('18')))
      weth.mint(bob, amount, { from: alice })
      weth.approve(options.address, amount, { from: bob })
      // spot price is $2250
      await ethUsdAggregator.setLatestAnswer(scale(2250, 8))

      const position1 = await pool.positions(0, 3)

      const before1 = await weth.balanceOf(bob)
      const result = await options.buyERC20Option(60 * 60 * 24 * 7, strike, amount, { from: bob })
      const after1 = await weth.balanceOf(bob)
      const optionId = result.logs[1].args.optionId

      console.log('premium buy')
      console.log(result.logs[1].args.premium.toString())
      // 37653988930666666

      const position2 = await pool.positions(0, 3)
      console.log('position1', position1.toString())
      console.log('position2', position2.toString())

      // spot price is $2260
      await ethUsdAggregator.setLatestAnswer(scale(2260, 8))

      await expectRevert(options.sellERC20Option(optionId, amount, { from: bob }), 'Pool: 1. tick must be positive')

      // spot price is $2230
      await ethUsdAggregator.setLatestAnswer(scale(2230, 8))

      // sell option
      const before2 = await weth.balanceOf(bob)
      const beforeBalance = await pool.getAvailableBalance(4, 6)
      console.log('before balance', beforeBalance.toString())
      const sellReceipt = await options.sellERC20Option(optionId, amount, { from: bob })
      const after2 = await weth.balanceOf(bob)

      const position3 = await pool.positions(0, 3)

      console.log('premium buy')
      console.log(result.logs[1].args.premium.toString())
      console.log(result.logs[1].args.protocolFee.toString())
      console.log('premium sell')
      console.log(sellReceipt.receipt.logs[1].args.premium.toString())
      console.log('positions')
      console.log(position1.toString())
      console.log(position2.toString())
      console.log(position3.toString())

      assert.equal(formatEther(before1.sub(after1)), '0.025626303224266666')
      assert.equal(formatEther(after2.sub(before2)), '0.011443540289686099')

      // 7 days later
      await time.increase(60 * 60 * 24 * 7 + 60)

      let available = await pool.getAvailableBalance(4, 6)
      console.log('available', available.toString())

      await options.unlock(optionId)

      available = await pool.getAvailableBalance(4, 6)
      console.log('available', available.toString())
      const rangeId = genRangeId(4, 6)
      const beforeLPToken = await pool.balanceOf(alice, rangeId)
      await pool.withdrawERC20(depositAmount, rangeId, { from: alice })
      const afterLPToken = await pool.balanceOf(alice, rangeId)
      assert.equal(beforeLPToken.sub(afterLPToken).toString(), '9993821000000000000')
    })
  })
})
