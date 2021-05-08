import {
  OptionsInstance,
  MockChainlinkAggregatorInstance,
  MockStakingInstance,
  MockPoolInstance,
  MockERC20Instance,
  MockMarginVaultInstance,
} from '../../build/types/truffle-types'
const { expectRevert, time } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const Options = artifacts.require('Options.sol')
const MockPool = artifacts.require('MockPool.sol')
const MockMarginVault = artifacts.require('MockMarginVault.sol')
const MockChainlinkAggregator = artifacts.require('MockChainlinkAggregator.sol')
const MockStaking = artifacts.require('MockStaking.sol')
const MockERC20 = artifacts.require('MockERC20.sol')

contract('Options', ([alice]) => {
  let weth: MockERC20Instance
  let options: OptionsInstance
  let mockPool: MockPoolInstance
  let mockMarginVault: MockMarginVaultInstance
  let ethUsdAggregator: MockChainlinkAggregatorInstance
  const uri = ''

  // 4 weeks
  const maturity = 60 * 60 * 24 * 7 * 4
  const spot = new BN(1991).mul(new BN('10').pow(new BN('8')))

  beforeEach('deploy contracts', async () => {
    weth = await MockERC20.new('MOCK', 'MOCK')
    mockMarginVault = await MockMarginVault.new()
    mockPool = await MockPool.new(weth.address)
    ethUsdAggregator = await MockChainlinkAggregator.new()
    const mockStaking: MockStakingInstance = await MockStaking.new('MOCK_STAKING', 'MOCK')
    options = await Options.new(
      uri,
      weth.address,
      mockPool.address,
      mockMarginVault.address,
      ethUsdAggregator.address,
      mockStaking.address,
    )
    await ethUsdAggregator.setLatestAnswer(spot)
  })

  describe('buyERC20Option', () => {
    // 0.1 ETH
    const amount = new BN(1).mul(new BN('10').pow(new BN('17')))
    const maxFeeAmount = amount
    // 1 week
    const aWeek = 60 * 60 * 24 * 7
    // 8 week
    const eightWeeks = aWeek * 8
    const strike = new BN(2000).mul(new BN('10').pow(new BN('8')))

    it('create option', async () => {
      // set up preconditions
      weth.mint(alice, amount)
      weth.approve(options.address, amount, { from: alice })

      await options.buyERC20Option(aWeek, strike, amount, maxFeeAmount)
    })

    it('reverts by small maturity', async () => {
      await expectRevert(
        options.buyERC20Option(0, strike, amount, maxFeeAmount),
        'Options: maturity must be greater than 1 days',
      )
    })

    it('reverts by big maturity', async () => {
      await expectRevert(
        options.buyERC20Option(eightWeeks, strike, amount, maxFeeAmount),
        'Options: maturity must be less than 4 weeks',
      )
    })

    it('reverts by strike', async () => {
      await expectRevert(options.buyERC20Option(aWeek, 0, amount, maxFeeAmount), 'Options: strike must not be 0')
    })

    it('reverts by wrong amount', async () => {
      await expectRevert(options.buyERC20Option(aWeek, strike, 0, maxFeeAmount), 'Options: amount must not be 0')
    })

    it('reverts because fee exceeds maxFeeAmount', async () => {
      await expectRevert(options.buyERC20Option(aWeek, strike, amount, 0), 'Options: total fee exceeds maxFeeAmount')
    })
  })

  describe('sellERC20Option', () => {
    // 0.1 ETH
    const amount = new BN(1).mul(new BN('10').pow(new BN('17')))
    const maxFeeAmount = amount
    const strike = new BN(2000).mul(new BN('10').pow(new BN('8')))
    let optionId: BN

    beforeEach(async () => {
      // set up preconditions
      weth.mint(alice, amount)
      weth.approve(options.address, amount, { from: alice })
      const result = await options.buyERC20Option(maturity, strike, amount, maxFeeAmount, { from: alice })
      optionId = result.logs[1].args.optionId
    })

    it('sell option', async () => {
      // sell
      const balance1 = await options.balanceOf(alice, optionId)
      await options.sellERC20Option(optionId, amount, { from: alice })
      const balance2 = await options.balanceOf(alice, optionId)

      assert.equal(balance1.sub(balance2).toString(), amount.toString())
    })

    it('reverts because option is expired', async () => {
      await time.increase(maturity + 60)
      await expectRevert(options.exerciseERC20(optionId, amount), 'Options: option expired')
    })
  })

  describe('exerciseERC20', () => {
    // 0.1 ETH
    const amount = new BN(1).mul(new BN('10').pow(new BN('17')))
    const maxFeeAmount = amount
    const strike = new BN(1800).mul(new BN('10').pow(new BN('8')))
    let optionId: BN

    beforeEach(async () => {
      // set up preconditions
      weth.mint(mockPool.address, amount)
      weth.mint(alice, amount)
      weth.approve(options.address, amount, { from: alice })
      const result = await options.buyERC20Option(maturity, strike, amount, maxFeeAmount, { from: alice })
      optionId = result.logs[1].args.optionId
    })

    it('exercise option', async () => {
      await options.exerciseERC20(optionId, amount)
    })

    it('reverts because option is expired', async () => {
      await time.increase(maturity + 60)
      await expectRevert(options.exerciseERC20(optionId, amount), 'Options: option expired')
    })
  })
})
