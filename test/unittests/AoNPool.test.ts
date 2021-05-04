import { AoNPoolInstance, MockERC20Instance } from '../../build/types/truffle-types'
import { formatEther, OptionType, scale } from '../utils'
const { expectRevert } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const AoNPool = artifacts.require('AoNPool.sol')
const MockERC20 = artifacts.require('MockERC20.sol')
const AoNPriceCalculator = artifacts.require('AoNPriceCalculator.sol')

interface Tick {
  supply: BN
  balance: BN
  premiumPool: BN
  lockedAmount: BN
  lockedPremium: BN
}

contract('AoNPool', ([alice]) => {
  let pool: AoNPoolInstance
  let weth: MockERC20Instance

  async function getTick(index: number): Promise<Tick> {
    const tick = await pool.ticks(index)
    return {
      supply: tick[0],
      balance: tick[1],
      premiumPool: tick[2],
      lockedAmount: tick[3],
      lockedPremium: tick[4],
    }
  }

  before(async () => {
    const lib = await AoNPriceCalculator.new()
    await AoNPool.link('AoNPriceCalculator', lib.address)
  })

  beforeEach('deploy contracts', async () => {
    weth = await MockERC20.new('MOCK', 'MOCK')
    pool = await AoNPool.new(weth.address)
  })

  describe('buy', () => {
    // 2 ETH
    const depositAmount = scale(2, 18)
    const rangeStart = 2
    const rangeEnd = 4
    const spot = new BN(2200).mul(new BN('10').pow(new BN('8')))

    beforeEach(async () => {
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)
    })

    it('buy an ATM option contract for 1 ETH', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2200).mul(new BN('10').pow(new BN('8')))
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(beforeBalance.sub(afterBalance).toString(), depositAmount.sub(amount).toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.000232496018181817')
      assert.equal(formatEther(tick2.lockedAmount), '1.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.000232496018181817')
    })

    it('reverts because trader can not buy OTM options', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2220).mul(new BN('10').pow(new BN('8')))
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      await expectRevert(
        pool.buy(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall),
        'AoNPool: only ATM option is available',
      )
    })

    it('reverts because trader can not buy ITM options', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2180).mul(new BN('10').pow(new BN('8')))
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      await expectRevert(
        pool.buy(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall),
        'AoNPool: only ATM option is available',
      )
    })

    it('reverts because amount is too big', async () => {
      // set up preconditions
      const optionId = 1
      const strike = spot
      const amount = scale(5, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      await expectRevert(
        pool.buy(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall),
        'too large tick',
      )
    })
  })

  describe('sell', () => {
    // 2 ETH
    const depositAmount = scale(2, 18)
    const rangeStart = 6
    const rangeEnd = 8
    const spot = new BN(2200).mul(new BN('10').pow(new BN('8')))
    // buy option
    const optionId = 1
    const amount = scale(1, 18)
    const strike = new BN(2200).mul(new BN('10').pow(new BN('8')))

    beforeEach(async () => {
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)

      // buy option
      const maturity = 60 * 60 * 24 * 7
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall)
    })

    it('sell option', async () => {
      // sell
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      const maturity = 60 * 60 * 24 * 5
      await pool.sell(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(afterBalance.sub(beforeBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.000009348036090908')
      assert.equal(formatEther(tick2.lockedAmount), '0.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.000009348036090908')
    })

    it('reverts because there are no enough pool balance', async () => {
      // sell
      const amount = scale(3, 18)
      const maturity = 60 * 60 * 24 * 6
      // assertion
      await expectRevert(
        pool.sell(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall),
        'Pool: no enough pool',
      )
    })

    it('reverts because there are no enough premium pool', async () => {
      // sell
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 8
      // assertion
      await expectRevert(
        pool.sell(optionId, spot, amount, maturity, strike, OptionType.CashOrNothingCall),
        'Pool: 1. tick must be positive',
      )
    })
  })
})
