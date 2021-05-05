import { SimplePriceCalculatorTesterInstance } from '../../build/types/truffle-types'
import { OptionType, scale } from '../utils'

const { expectRevert } = require('@openzeppelin/test-helpers')

const SimplePriceCalculator = artifacts.require('SimplePriceCalculator.sol')
const SimplePriceCalculatorTester = artifacts.require('SimplePriceCalculatorTester.sol')

contract('SimplePriceCalculator', ([]) => {
  let tester: SimplePriceCalculatorTesterInstance

  before(async () => {
    const lib = await SimplePriceCalculator.new()
    await SimplePriceCalculatorTester.link('SimplePriceCalculator', lib.address)
    tester = await SimplePriceCalculatorTester.new()
  })

  describe('call option price', () => {
    // $2200
    const spot = scale(2200, 8)
    const maturity = 60 * 60 * 24 * 7
    // 20%
    const x0 = scale(20, 6)
    const amount = scale(1, 8)
    // 1%
    const k = scale(1, 6)

    it('calculate OTM call option price', async () => {
      // $2500
      const strike = scale(2500, 8)
      const premium = await tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call)
      // asserts
      assert.equal(premium.toString(), '5592400000')
    })

    it('calculate ATM call option price', async () => {
      // ATM
      const strike = spot
      const premium = await tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call)
      // asserts
      assert.equal(premium.toString(), '6355000000')
    })

    it('calculate ITM call option price', async () => {
      // $2000
      const strike = scale(2000, 8)
      const premium = await tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call)
      // asserts
      assert.equal(premium.toString(), '26990500000')
    })

    it('reverts because of too big volatility', async () => {
      // $2000
      const strike = scale(2000, 8)
      // 1050%
      const x0 = scale(1050, 6)

      await expectRevert(
        tester.calculateOptionPrice(spot, strike, maturity, x0, amount, k, OptionType.Call),
        '0 < x0 < 1000%',
      )
    })
  })

  describe('calStartPrice', () => {
    // $2200
    const spot = scale(2200, 8)
    // $2500
    const strike = scale(2500, 8)
    const maturity = 60 * 60 * 24 * 7
    // 20%
    const iv = scale(20, 6)

    it('calculate start price', async () => {
      const k = await tester.calStartPrice(spot, strike, maturity, iv, OptionType.Call)
      // asserts
      assert.equal(k.toString(), '27280000000')
    })
  })
})
