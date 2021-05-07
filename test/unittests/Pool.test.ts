import { PoolInstance, MockERC20Instance } from '../../build/types/truffle-types'
import { formatEther, genRangeId, OptionType, scale } from '../utils'
const { expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const Pool = artifacts.require('Pool.sol')
const MockERC20 = artifacts.require('MockERC20.sol')
const PriceCalculator = artifacts.require('PriceCalculator.sol')

interface Tick {
  supply: BN
  balance: BN
  premiumPool: BN
  lockedAmount: BN
  lockedPremium: BN
}

interface LockedPerTick {
  tickId: BN
  amount: BN
  premium: BN
}

interface LockedOption {
  amount: BN
  premium: BN
  shorts: LockedPerTick[]
  longs: LockedPerTick[]
}

contract('Pool', ([alice]) => {
  let pool: PoolInstance
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

  async function getLocked(optionId: BN): Promise<LockedOption> {
    const lockedOption = await pool.getLockedOption(optionId)
    return {
      amount: new BN(lockedOption.amount),
      premium: new BN(lockedOption.premium),
      shorts: lockedOption.shorts.map((s) => ({
        tickId: s.tickId,
        amount: new BN(s.amount),
        premium: new BN(s.premium),
      })),
      longs: lockedOption.longs.map((l) => ({
        tickId: l.tickId,
        amount: new BN(l.amount),
        premium: new BN(l.premium),
      })),
    }
  }

  before(async () => {
    const lib = await PriceCalculator.new()
    await Pool.link('PriceCalculator', lib.address)
  })

  beforeEach('deploy contracts', async () => {
    weth = await MockERC20.new('MOCK', 'MOCK')
    pool = await Pool.new(weth.address)
  })

  describe('depositETH', () => {
    // 1.2 ETH
    const depositAmount = new BN(12).mul(new BN('10').pow(new BN('17')))
    const rangeStart = 1
    const rangeEnd = 3
    const rangeId = genRangeId(rangeStart, rangeEnd)

    it('deposit 1.2 ETH', async () => {
      // set up preconditions
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      // test
      const beforeBalance = await pool.balanceOf(alice, rangeId)
      const receipt = await pool.depositERC20(depositAmount, rangeStart, rangeEnd)
      const afterBalance = await pool.balanceOf(alice, rangeId)
      // asserts
      assert.equal(afterBalance.sub(beforeBalance).toString(), depositAmount.toString())
      expectEvent(receipt, 'Deposited', {
        account: alice,
        asset: weth.address,
        amount: depositAmount.toString(),
        mint: depositAmount.toString(),
      })
    })
  })

  describe('withdrawETH', () => {
    // 1.2 ETH
    const depositAmount = new BN(12).mul(new BN('10').pow(new BN('17')))
    const rangeStart = 1
    const rangeEnd = 3
    const rangeId = genRangeId(rangeStart, rangeEnd)

    it('withdraw 1.2 ETH', async () => {
      // set up preconditions
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)
      // withdraw
      const beforeBalance = await pool.balanceOf(alice, rangeId)
      const receipt = await pool.withdrawERC20(depositAmount, rangeId)
      const afterBalance = await pool.balanceOf(alice, rangeId)
      // asserts
      assert.equal(afterBalance.sub(beforeBalance).toString(), depositAmount.neg().toString())
      expectEvent(receipt, 'Withdrawn', {
        account: alice,
        asset: weth.address,
        amount: depositAmount.toString(),
        burn: depositAmount.toString(),
      })
    })

    it('reverts because amount is too big', async () => {
      // set up preconditions
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)
      // withdraw
      await expectRevert(pool.withdrawERC20(depositAmount.mul(new BN(2)), rangeId), 'Pool: amount is too big')
    })
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
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(beforeBalance.sub(afterBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.00364566258')
      assert.equal(formatEther(tick2.lockedAmount), '1.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.00364566258')
    })

    it('buy an OTM option contract for 1 ETH', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2220).mul(new BN('10').pow(new BN('8')))
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(beforeBalance.sub(afterBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      const tick3 = await getTick(rangeStart + 1)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.000912702894272727')
      assert.equal(formatEther(tick2.lockedAmount), '0.990991098125163761')
      assert.equal(formatEther(tick2.lockedPremium), '0.000912702894272727')
      assert.equal(formatEther(tick3.supply), '1.0')
      assert.equal(formatEther(tick3.balance), '1.0')
      assert.equal(formatEther(tick3.premiumPool), '0.00001568496190909')
      assert.equal(formatEther(tick3.lockedAmount), '0.009008901874836239')
      assert.equal(formatEther(tick3.lockedPremium), '0.00001568496190909')
    })

    it('buy an ITM option contract for 1 ETH', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2180).mul(new BN('10').pow(new BN('8')))
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(beforeBalance.sub(afterBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.010034615313')
      assert.equal(formatEther(tick2.lockedAmount), '1.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.010034615313')
    })

    it('buy an ATM option contract for 2 ETH', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2200).mul(new BN('10').pow(new BN('8')))
      const amount = scale(2, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(beforeBalance.sub(afterBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.00364566258')
      assert.equal(formatEther(tick2.lockedAmount), '1.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.00364566258')
    })

    it('reverts because amount is too big', async () => {
      // set up preconditions
      const optionId = 1
      const strike = new BN(2220).mul(new BN('10').pow(new BN('8')))
      const amount = scale(5, 18)
      const maturity = 60 * 60 * 24 * 7

      // buy
      await expectRevert(pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call), 'too large tick')
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
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
    })

    it('sell option', async () => {
      // sell
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      const maturity = 60 * 60 * 24 * 6
      await pool.sell(optionId, spot, amount, maturity, strike, OptionType.Call)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(afterBalance.sub(beforeBalance).toString(), amount.toString())
      const tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.premiumPool), '0.002342804667545453')
      assert.equal(formatEther(tick2.lockedAmount), '0.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.002342804667545453')
    })

    it('reverts because there are no enough pool balance', async () => {
      // sell
      const amount = scale(2, 18)
      const maturity = 60 * 60 * 24 * 6
      // assertion
      await expectRevert(
        pool.sell(optionId, spot, amount, maturity, strike, OptionType.Call),
        'Pool: 1. tick must be positive',
      )
    })

    it('reverts because there are no enough premium pool', async () => {
      // sell
      const amount = scale(1, 18)
      const maturity = 60 * 60 * 24 * 8
      // assertion
      await expectRevert(
        pool.sell(optionId, spot, amount, maturity, strike, OptionType.Call),
        'Pool: 1. tick must be positive',
      )
    })
  })

  describe('exercise and unlock', () => {
    // 2 ETH
    const depositAmount = scale(2, 18)
    const rangeStart = 2
    const rangeEnd = 4
    const spot = new BN(2200).mul(new BN('10').pow(new BN('8')))
    // buy option
    const optionId = 1
    const amount = scale(1, 18)
    const strike = new BN(2200).mul(new BN('10').pow(new BN('8')))
    let premium: BN

    beforeEach(async () => {
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)

      // buy option
      const maturity = 60 * 60 * 24 * 7
      const result = await pool.buy.call(optionId, spot, amount, maturity, strike, OptionType.Call)
      await pool.buy(optionId, spot, amount, maturity, strike, OptionType.Call)
      premium = result[0]
    })

    it('exercise options and fail to unlock', async () => {
      const payout = scale(1, 17)

      // exercise
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.exercise(optionId, amount, payout)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      // 0.9 ETH
      const expectedAvailableBalance = amount.sub(payout).add(premium)
      assert.equal(afterBalance.sub(beforeBalance).toString(), expectedAvailableBalance.toString())
      let tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '0.9')
      assert.equal(tick2.premiumPool.toString(), premium.toString())
      assert.equal(formatEther(tick2.lockedAmount), '0.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.0')

      await time.increase(60 * 60 * 24 * 7)

      // can't unlock because options were already exercised
      await expectRevert(pool.unlock(optionId), 'Pool: no amount left')
    })

    it('unlock options', async () => {
      await time.increase(60 * 60 * 24 * 7 + 60)

      // unlock
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.unlock(optionId)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      // 0.9 ETH
      const expectedAvailableBalance = amount.add(premium)
      assert.equal(afterBalance.sub(beforeBalance).toString(), expectedAvailableBalance.toString())
      let tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(tick2.premiumPool.toString(), premium.toString())
      assert.equal(formatEther(tick2.lockedAmount), '0.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.0')
    })

    it('sell and unlock options', async () => {
      const maturity = 60 * 60 * 24 * 6
      const sellPremium = await pool.sell.call(optionId, spot, amount, maturity, strike, OptionType.Call)
      await pool.sell(optionId, spot, amount, maturity, strike, OptionType.Call)
      await time.increase(60 * 60 * 24 * 7 + 60)

      // unlock
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.unlock(optionId)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      const expectedAvailableBalance = premium.sub(sellPremium)
      assert.equal(afterBalance.sub(beforeBalance).toString(), expectedAvailableBalance.toString())
    })

    it('unlock partially', async () => {
      const payout = scale(5, 16)
      const halfAmount = amount.div(new BN(2))

      // exercise
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.exercise(optionId, halfAmount, payout)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      // 0.9 ETH
      assert.equal(formatEther(afterBalance.sub(beforeBalance)), '0.45182283129')
      let tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '0.95')
      assert.equal(formatEther(tick2.premiumPool), '0.00364566258')
      assert.equal(formatEther(tick2.lockedAmount), '0.5')
      assert.equal(formatEther(tick2.lockedPremium), '0.00182283129')

      await time.increase(60 * 60 * 24 * 7)

      const beforeBalance2 = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.unlock(optionId)
      const afterBalance2 = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      // 0.9 ETH
      assert.equal(formatEther(afterBalance2.sub(beforeBalance2)), '0.50182283129')
      tick2 = await getTick(rangeStart)
      assert.equal(formatEther(tick2.supply), '1.0')
      assert.equal(formatEther(tick2.balance), '0.95')
      assert.equal(formatEther(tick2.premiumPool), '0.00364566258')
      assert.equal(formatEther(tick2.lockedAmount), '0.0')
      assert.equal(formatEther(tick2.lockedPremium), '0.0')
    })
  })

  describe('exercisePoolLongs', () => {
    // 3 ETH
    const depositAmount = scale(3, 18)
    const rangeStart = 2
    const rangeEnd = 5
    const spot = new BN(2200).mul(new BN('10').pow(new BN('8')))
    // buy option
    const optionId = 1
    const optionId2 = 2
    const strike = spot
    const maturity = 60 * 60 * 24 * 7
    let premium: BN

    beforeEach(async () => {
      weth.mint(alice, depositAmount)
      weth.approve(pool.address, depositAmount, { from: alice })
      await pool.depositERC20(depositAmount, rangeStart, rangeEnd)
    })

    it('exercise options which pool holds', async () => {
      // buy option
      await pool.buy(optionId, spot, scale(2, 18), maturity, strike, OptionType.Call)
      await pool.buy(optionId2, spot, scale(1, 18), maturity, strike, OptionType.Call)
      await pool.sell(optionId, spot, scale(2, 18), maturity, strike, OptionType.Call)

      await time.increase(maturity - 60)

      // 0.1 ETH
      const profit = scale(1, 17)

      let tick2Before = await getTick(2)
      let tick3Before = await getTick(3)
      let tick4Before = await getTick(4)
      assert.equal(formatEther(tick2Before.balance), '1.0')
      assert.equal(formatEther(tick2Before.lockedAmount), '1.0')
      assert.equal(formatEther(tick3Before.balance), '1.0')
      assert.equal(formatEther(tick3Before.lockedAmount), '0.020956377483419668')
      assert.equal(formatEther(tick4Before.balance), '1.0')
      assert.equal(formatEther(tick4Before.lockedAmount), '1.0')

      const option1Before = await getLocked(optionId)
      console.log(option1Before.amount.toString(), option1Before.shorts)
      // exercise
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.exercisePoolLongs(optionId, profit)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      const option1After = await getLocked(optionId)

      // asserts
      assert.equal(formatEther(option1Before.amount.sub(option1After.amount)), '1.020956377483419668')
      assert.equal(formatEther(afterBalance.sub(beforeBalance)), '0.511913276467571647')
      let tick2 = await getTick(2)
      let tick3 = await getTick(3)
      let tick4 = await getTick(4)
      // zero sum
      assert.equal(formatEther(tick2.balance.add(tick3.balance).add(tick4.balance)), '3.000000000000000001')
      assert.equal(
        formatEther(tick2.lockedAmount.add(tick3.lockedAmount).add(tick4.lockedAmount)),
        '1.499780415121386211',
      )
      assert.equal(formatEther(tick2.balance), '0.900000000000000001')
      assert.equal(formatEther(tick2.lockedAmount), '0.489521811258290166')
      assert.equal(formatEther(tick3.balance), '0.997904362251658034')
      assert.equal(formatEther(tick3.lockedAmount), '0.010258603863096045')
      assert.equal(formatEther(tick4.balance), '1.102095637748341966')
      assert.equal(formatEther(tick4.lockedAmount), '1.0')

      await pool.unlock(optionId)

      tick2 = await getTick(2)
      tick3 = await getTick(3)
      tick4 = await getTick(4)
      // zero sum
      assert.equal(formatEther(tick2.lockedAmount.add(tick3.lockedAmount).add(tick4.lockedAmount)), '1.0')
    })

    it('exercise nothing', async () => {
      // buy option
      await pool.buy(optionId, spot, scale(2, 18), maturity, strike, OptionType.Call)
      await pool.buy(optionId2, spot, scale(1, 18), maturity, strike, OptionType.Call)
      await pool.sell(optionId2, spot, scale(2, 18), maturity, strike, OptionType.Call)

      await time.increase(maturity - 60)

      // 0.1 ETH
      const profit = scale(1, 17)

      let tick2Before = await getTick(2)
      let tick3Before = await getTick(3)
      let tick4Before = await getTick(4)
      assert.equal(formatEther(tick2Before.balance), '1.0')
      assert.equal(formatEther(tick2Before.lockedAmount), '1.0')
      assert.equal(formatEther(tick3Before.balance), '1.0')
      assert.equal(formatEther(tick3Before.lockedAmount), '1.0')
      assert.equal(formatEther(tick4Before.balance), '1.0')
      assert.equal(formatEther(tick4Before.lockedAmount), '0.0')

      // exercise
      const beforeBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)
      await pool.exercisePoolLongs(optionId, profit)
      const afterBalance = await pool.getAvailableBalance(rangeStart, rangeEnd)

      // asserts
      assert.equal(formatEther(afterBalance.sub(beforeBalance)), '0.0')
      let tick2 = await getTick(2)
      let tick3 = await getTick(3)
      let tick4 = await getTick(4)
      assert.equal(formatEther(tick2.balance), '1.0')
      assert.equal(formatEther(tick2.lockedAmount), '1.0')
      assert.equal(formatEther(tick3.balance), '1.0')
      assert.equal(formatEther(tick3.lockedAmount), '1.0')
      assert.equal(formatEther(tick4.balance), '1.0')
      assert.equal(formatEther(tick4.lockedAmount), '0.0')
    })
  })
})
