import { PredyStakingInstance, MockERC20Instance } from '../../build/types/truffle-types'
import { formatUnits } from '../utils'

const { expectRevert, time } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const PredyStaking = artifacts.require('PredyStaking.sol')
const MockERC20 = artifacts.require('MockERC20.sol')

contract('PredyStaking', ([alice, bob]) => {
  const maxSupply = new BN(10000)
  const lot = new BN(1000).mul(new BN('10').pow(new BN('18')))
  let predyStaking: PredyStakingInstance
  let mockERC20: MockERC20Instance
  let mockWETH: MockERC20Instance

  before('deploy contracts', async () => {
    mockERC20 = await MockERC20.new('mock predy', 'PREDY')
    mockWETH = await MockERC20.new('mock weth', 'WETH')
    predyStaking = await PredyStaking.new(mockERC20.address, mockWETH.address)
    // mint
    const mintAmount = maxSupply.mul(lot)
    await mockERC20.mint(alice, mintAmount)
    await mockERC20.approve(predyStaking.address, mintAmount, { from: alice })
  })

  describe('buy', () => {
    it('buy staking token', async () => {
      const stakingTokenAmount = 2
      await predyStaking.buy(stakingTokenAmount, { from: alice })
    })

    it('reverts because amount is 0', async () => {
      await expectRevert(predyStaking.buy(0, { from: alice }), 'PredyStaking: amount is 0')
    })

    it('reverts because exceed max supply', async () => {
      const amount = maxSupply.add(new BN(1))
      await expectRevert(predyStaking.buy(amount, { from: alice }), 'PredyStaking: supply reached max limitaion')
    })
  })

  describe('claim', () => {
    const stakingTokenAmount = 2

    it('claim profit', async () => {
      // set up
      await predyStaking.buy(stakingTokenAmount, { from: alice })
      // profit is 10 ETH
      const profit = new BN(10).mul(new BN('10').pow(new BN('18')))
      await mockWETH.mint(bob, profit)
      await mockWETH.approve(predyStaking.address, profit, { from: bob })
      await predyStaking.sendProfitERC20(bob, profit)

      const balance = await predyStaking.balanceOf(alice)

      const balanceBefore = await mockWETH.balanceOf(alice)
      await predyStaking.claimProfit({ from: alice })
      const balanceAfter = await mockWETH.balanceOf(alice)

      // claimed profit is LOT * profit / supply
      assert.equal(balanceAfter.sub(balanceBefore).toString(), balance.mul(profit).div(maxSupply).toString())

      await expectRevert(predyStaking.claimProfit({ from: alice }), 'PredyStaking: 0 profit')
    })

    it('reverts because of 0 balance', async () => {
      await expectRevert(predyStaking.claimProfit({ from: bob }), 'PredyStaking: 0 profit')
    })
  })

  describe('sell', () => {
    const lockupPeriod = 60 * 60 * 24
    const stakingTokenAmount = 2

    it('reverts because of lockup period', async () => {
      // setup
      await predyStaking.buy(stakingTokenAmount, { from: alice })
      // assertions
      await expectRevert(
        predyStaking.sell(stakingTokenAmount, { from: alice }),
        'PredyStaking: action suspended due to lockup',
      )
    })

    it('sell 2 staking tokens', async () => {
      // setup
      await predyStaking.buy(stakingTokenAmount, { from: alice })
      await time.increase(lockupPeriod)

      // sell
      const mockBalanceBefore = await mockERC20.balanceOf(alice)
      const balanceBefore = await predyStaking.balanceOf(alice)
      await predyStaking.sell(stakingTokenAmount, { from: alice })
      const mockBalanceAfter = await mockERC20.balanceOf(alice)
      const balanceAfter = await predyStaking.balanceOf(alice)

      // assertions
      assert.equal(balanceBefore.sub(balanceAfter).toString(), '2')
      assert.equal(formatUnits(mockBalanceAfter.sub(mockBalanceBefore), 18), '2000.0')
    })
  })
})
