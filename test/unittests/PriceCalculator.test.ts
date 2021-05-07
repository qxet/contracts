import { PriceCalculatorTesterInstance } from '../../build/types/truffle-types'
import { OptionType, scale } from '../utils'

const { expectRevert } = require('@openzeppelin/test-helpers')

const PriceCalculator = artifacts.require('PriceCalculator.sol')
const PriceCalculatorTester = artifacts.require('PriceCalculatorTester.sol')

contract('PriceCalculator', ([]) => {
  let tester: PriceCalculatorTesterInstance

  before(async () => {
    const lib = await PriceCalculator.new()
    await PriceCalculatorTester.link('PriceCalculator', lib.address)
    tester = await PriceCalculatorTester.new()
  })

  describe('calculateOptionPrice', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 40%
    const x0 = scale(40, 6)
    const amount = scale(1, 8)
    // 1%
    const k = scale(1, 6)
    describe('call option price', () => {
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

        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '40455000')
        assert.equal(premiumSell.toString(), '40022200')
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
        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '4913640000')
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
        assert.equal(premiumBuy.toString(), '20210063000')
        assert.equal(premiumSell.toString(), '20208289600')
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

      it('reverts because maturity expired', async () => {
        // $2000
        const strike = scale(2000, 8)
        const maturity = 0

        await expectRevert(
          tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call, false),
          'the _maturity should not have expired and less than 1 year',
        )
      })

      it('reverts because of the maturity more than 1 year', async () => {
        // $2000
        const strike = scale(2000, 8)
        // 366 days
        const maturity = 60 * 60 * 24 * 366

        await expectRevert(
          tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call, false),
          'the _maturity should not have expired and less than 1 year',
        )
      })
    })

    describe('put option price', () => {
      it('calculate OTM put option price', async () => {
        // $2500
        const strike = scale(2500, 8)
        const premiumBuy = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          true,
        )
        const d = await tester.calD1D2(spot, strike, maturity, x0)
        const diff = await tester.calDiff(spot, strike, maturity, x0)
        console.log('OTM d1', d[0].toString())
        console.log('OTM d2', d[1].toString())
        console.log('OTM diff', diff.toString())

        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '30040455000')
        assert.equal(premiumSell.toString(), '30040022200')
      })

      it('calculate ATM put option price', async () => {
        // ATM
        const strike = spot
        const premiumBuy = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          true,
        )
        const d = await tester.calD1D2(spot, strike, maturity, x0)
        const diff = await tester.calDiff(spot, strike, maturity, x0)
        console.log('ATM d1', d[0].toString())
        console.log('ATM d2', d[1].toString())
        console.log('ATM diff', diff.toString())
        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '4913640000')
        assert.equal(premiumSell.toString(), '4914355600')
      })

      it('calculate ITM put option price', async () => {
        // $2000
        const strike = scale(2000, 8)
        const premiumBuy = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.Put,
          true,
        )
        const d = await tester.calD1D2(spot, strike, maturity, x0)
        const diff = await tester.calDiff(spot, strike, maturity, x0)
        console.log('ITM d1', d[0].toString())
        console.log('ITM d2', d[1].toString())
        console.log('ITM diff', diff.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '210063000')
        assert.equal(premiumSell.toString(), '208289600')
      })
    })
  })

  describe('calStartPrice', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 40%
    const volatility = scale(40, 6)
    // 49%
    const upperIV = scale(49, 6)

    it('calculate OTM start price', async () => {
      // $2500
      const strike = scale(2500, 8)
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, upperIV, OptionType.Call)

      assert.equal(k.toString(), '6871238')
    })

    it('calculate ATM start price', async () => {
      // ATM
      const strike = spot
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, upperIV, OptionType.Call)
      assert.equal(k.toString(), '485715978')
    })
  })
})
