import { LinearBondingCurveInstance, MockERC20Instance } from '../../build/types/truffle-types'
const { expectRevert } = require('@openzeppelin/test-helpers')
import { calculateGas, scale } from '../utils'

const BN = web3.utils.BN

const LinearBondingCurve = artifacts.require('LinearBondingCurve.sol')
const MockERC20 = artifacts.require('MockERC20.sol')

contract('BondingCurve', ([alice, devFund]) => {
  let bondingCurve: LinearBondingCurveInstance
  let mockERC20: MockERC20Instance
  const k = scale(1, 14)
  // 0.00000001 ETH
  const startPrice = scale(1, 12)

  before('deploy contracts', async () => {
    mockERC20 = await MockERC20.new('mock predy', 'PREDY')
    bondingCurve = await LinearBondingCurve.new(mockERC20.address, k, startPrice, { from: devFund })
  })

  describe('buy', () => {
    const totalAmount = scale(1, 20)
    // 1 Predy Token
    const tokenAmount = scale(1, 18)
    // 0.00000002 ETH
    const ethAmount = scale(2, 12)
    // 0.00000000999999995 ETH
    const excessEthAmount = new BN('999999995000')

    it('buy token', async () => {
      await mockERC20.mint(bondingCurve.address, totalAmount)

      const beforeBalance = await web3.eth.getBalance(alice)
      const receipt = await bondingCurve.buy(tokenAmount, { value: ethAmount })
      const gas = await calculateGas(receipt)
      const afterBalance = await web3.eth.getBalance(alice)

      assert.equal(
        new BN(beforeBalance).sub(new BN(afterBalance)).sub(gas).toString(),
        ethAmount.sub(excessEthAmount).toString(),
      )
    })

    it('reverts because of small ether', async () => {
      await expectRevert(bondingCurve.buy(tokenAmount), 'BondingCurve: msg.value is too small')
    })
  })

  describe('sell', () => {
    // 1 Predy Token
    const tokenAmount = scale(1, 18)
    // 0.00000001000000005 ETH
    const refundTotal = new BN('1000000005000')
    const comission = refundTotal.div(new BN(10))
    const ethAmount = refundTotal.sub(comission)

    it('sell token', async () => {
      await mockERC20.approve(bondingCurve.address, tokenAmount)

      const beforeBalance = await web3.eth.getBalance(alice)
      const beforeDevBalance = await web3.eth.getBalance(devFund)
      const receipt = await bondingCurve.sell(tokenAmount)
      const gas = await calculateGas(receipt)
      const afterBalance = await web3.eth.getBalance(alice)
      const afterDevBalance = await web3.eth.getBalance(devFund)

      assert.equal(new BN(afterBalance).sub(new BN(beforeBalance)).add(gas).toString(), ethAmount.toString())
      assert.equal(new BN(afterDevBalance).sub(new BN(beforeDevBalance)).toString(), comission.toString())
    })
  })
})
