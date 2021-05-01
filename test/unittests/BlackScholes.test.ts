import { BlackScholesTesterInstance } from '../../build/types/truffle-types'
import { OptionType, scale } from '../utils'

const { expectRevert } = require('@openzeppelin/test-helpers')

const BlackScholes = artifacts.require('BlackScholes.sol')
const BlackScholesTester = artifacts.require('BlackScholesTester.sol')

contract('BlackScholesTester', ([]) => {
  let tester: BlackScholesTesterInstance

  before(async () => {
    const lib = await BlackScholes.new()
    await BlackScholesTester.link('BlackScholes', lib.address)
    tester = await BlackScholesTester.new()
  })
  describe('call option price', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 40%
    const x0 = scale(40, 6)
    const amount = scale(1, 8)
    // 1%
    const k = scale(1, 6)

    it('calculate OTM call option price', async () => {
      // $2500
      const strike = scale(2500, 8)
      const premium = await tester.calD1D2(spot, strike, maturity, x0)
      console.log(premium[0].toString())
      console.log(premium[1].toString())
    })

    it('calculate ATM call option price', async () => {
      // ATM
      const strike = spot
      const premium = await tester.calD1D2(spot, strike, maturity, x0)
      console.log(premium[0].toString())
      console.log(premium[1].toString())
    })

    it('calculate ITM call option price', async () => {
      // $2000
      const strike = scale(2000, 8)
      const premium = await tester.calD1D2(spot, strike, maturity, x0)
      console.log(premium[0].toString())
      console.log(premium[1].toString())
    })
  })
  describe('call option price', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 40%
    const x0 = scale(40, 6)
    const amount = scale(1, 8)
    // 1%
    const k = scale(1, 6)

    it('calculate OTM call option price', async () => {
      // $2500
      const strike = scale(2500, 8)
      const premiumBuy = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        false,
      )
      const premiumSell = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        true,
      )
      const d = await tester.calD1D2(spot, strike, maturity, x0)
      const diff = await tester.calDiff(spot, strike, maturity, x0)
      console.log('OTM d1', d[0].toString())
      console.log('OTM d2', d[1].toString())
      console.log('OTM diff', diff.toString())

      //安い
      console.log(premiumBuy.toString())
      // 高い
      console.log(premiumSell.toString())
      // asserts
      assert.equal(premiumBuy.toString(), '40463600')
      assert.equal(premiumSell.toString(), '40052100')
    })

    it('calculate ATM call option price', async () => {
      // ATM
      const strike = spot
      const premiumBuy = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        false,
      )
      const premiumSell = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        true,
      )
      const d = await tester.calD1D2(spot, strike, maturity, x0)
      const diff = await tester.calDiff(spot, strike, maturity, x0)
      console.log('ATM d1', d[0].toString())
      console.log('ATM d2', d[1].toString())
      console.log('ATM diff', diff.toString())
      // 高い
      console.log(premiumBuy.toString())
      //安い
      console.log(premiumSell.toString())
      // asserts
      assert.equal(premiumBuy.toString(), '4913693900')
      assert.equal(premiumSell.toString(), '4914355600')
    })

    it('calculate ITM call option price', async () => {
      // $2000
      const strike = scale(2000, 8)
      const premiumBuy = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        false,
      )
      const premiumSell = await tester.calculateOptionPrice(
        spot,
        strike,
        maturity,
        x0,
        amount,
        k,
        OptionType.Call,
        true,
      )
      const d = await tester.calD1D2(spot, strike, maturity, x0)
      const diff = await tester.calDiff(spot, strike, maturity, x0)
      console.log('ITM d1', d[0].toString())
      console.log('ITM d2', d[1].toString())
      console.log('ITM diff', diff.toString())
      // asserts
      assert.equal(premiumBuy.toString(), '20210149300')
      assert.equal(premiumSell.toString(), '20208419600')
    })

    it('reverts because of too big volatility', async () => {
      // $2000
      const strike = scale(2000, 8)
      // 1050%
      const x0 = scale(1050, 6)

      await expectRevert(
        tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call, false),
        '0 < x0 < 1000%',
      )
    })
  })

  describe('calStartPrice', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 40%
    const volatility = scale(40, 6)
    const amount = scale(1, 8)
    // 1%
    const k = scale(1, 6)

    it('calculate OTM start price', async () => {
      // $2500
      const strike = scale(2500, 8)
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, OptionType.Call)

      assert.equal(k.toString(), '35000000')
    })

    it('calculate ATM start price', async () => {
      // ATM
      const strike = spot
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, OptionType.Call)
      assert.equal(k.toString(), '4852000000')
    })
  })
})
