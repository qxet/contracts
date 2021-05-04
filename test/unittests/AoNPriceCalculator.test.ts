import { BlackScholesTesterInstance } from '../../build/types/truffle-types'
import { OptionType, scale } from '../utils'

const { expectRevert } = require('@openzeppelin/test-helpers')

const AoNPriceCalculator = artifacts.require('AoNPriceCalculator.sol')
const AoNPriceCalculatorTester = artifacts.require('AoNPriceCalculatorTester.sol')

contract('AoNPriceCalculator', ([]) => {
  let tester: BlackScholesTesterInstance

  before(async () => {
    const lib = await AoNPriceCalculator.new()
    await AoNPriceCalculatorTester.link('AoNPriceCalculator', lib.address)
    tester = await AoNPriceCalculatorTester.new()
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
    describe('asset or nothing call option price', () => {
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
          OptionType.CashOrNothingCall,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingCall,
          true,
        )

        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '1240200')
        assert.equal(premiumSell.toString(), '1198900')
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
          OptionType.CashOrNothingCall,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingCall,
          true,
        )
        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '51108500')
        assert.equal(premiumSell.toString(), '51114900')
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
          OptionType.CashOrNothingCall,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingCall,
          true,
        )
        // asserts
        assert.equal(premiumBuy.toString(), '96264200')
        assert.equal(premiumSell.toString(), '96184700')
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

    describe('asset or nothing put option price', () => {
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
          OptionType.CashOrNothingPut,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingPut,
          true,
        )
        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '98897000')
        assert.equal(premiumSell.toString(), '98759700')
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
          OptionType.CashOrNothingPut,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingPut,
          true,
        )
        console.log(premiumBuy.toString())
        console.log(premiumSell.toString())
        // asserts
        assert.equal(premiumBuy.toString(), '48885000')
        assert.equal(premiumSell.toString(), '48906600')
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
          OptionType.CashOrNothingPut,
          false,
        )
        const premiumSell = await tester.calculateOptionPrice(
          spot,
          strike,
          maturity,
          x0,
          amount,
          k,
          OptionType.CashOrNothingPut,
          true,
        )
        // asserts
        assert.equal(premiumBuy.toString(), '3815200')
        assert.equal(premiumSell.toString(), '3544500')
      })
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
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, OptionType.CashOrNothingCall)

      assert.equal(k.toString(), '1000000')
    })

    it('calculate ATM start price', async () => {
      // ATM
      const strike = spot
      const k = await tester.calStartPrice(spot, strike, maturity, volatility, OptionType.CashOrNothingCall)
      assert.equal(k.toString(), '51000000')
    })
  })
})
