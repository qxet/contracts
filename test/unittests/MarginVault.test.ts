import { MarginVaultInstance } from '../../build/types/truffle-types'
import { OptionType, scale } from '../utils'
const { expectRevert, time } = require('@openzeppelin/test-helpers')

const BN = web3.utils.BN

const MarginVault = artifacts.require('MarginVault.sol')

contract('MarginVault', ([alice]) => {
  let marginVault: MarginVaultInstance
  let expiry: string
  const amount = scale(1, 8)

  before('deploy contracts', async () => {
    marginVault = await MarginVault.new()
    expiry = (await time.latest()).add(new BN(60 * 60 * 24)).toString()
  })

  describe('write', () => {
    it('write call bear spread', async () => {
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Call,
      }
      const short = {
        expiry,
        strike: scale(800, 8).toString(),
        optionType: OptionType.Call,
      }
      const eth = await marginVault.write.call(alice, longId, shortId, long, short, amount)
      assert.equal(eth.toString(), scale(25, 6).toString())
    })

    it('write call bull spread', async () => {
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Call,
      }
      const short = {
        expiry,
        strike: scale(1200, 8).toString(),
        optionType: OptionType.Call,
      }
      await marginVault.write(alice, longId, shortId, long, short, amount)
    })

    it('write put bear spread', async () => {
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Put,
      }
      const short = {
        expiry,
        strike: scale(800, 8).toString(),
        optionType: OptionType.Put,
      }
      await marginVault.write(alice, longId, shortId, long, short, amount)
    })

    it('write put bull spread', async () => {
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Put,
      }
      const short = {
        expiry,
        strike: scale(1200, 8).toString(),
        optionType: OptionType.Put,
      }
      const eth = await marginVault.write.call(alice, longId, shortId, long, short, amount)
      assert.equal(eth.toString(), scale(2, 7).toString())
    })

    it('reverts by different maturity', async () => {
      const differentExpiry = (await time.latest()).add(new BN(60 * 60 * 24 * 2)).toString()
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Put,
      }
      const short = {
        expiry: differentExpiry,
        strike: scale(1200, 8).toString(),
        optionType: OptionType.Put,
      }
      await expectRevert(
        marginVault.write(alice, longId, shortId, long, short, amount),
        'MarginVault: expirations must be same',
      )
    })

    it('reverts by different option type', async () => {
      const longId = 1
      const shortId = 2
      const long = {
        expiry,
        strike: scale(1000, 8).toString(),
        optionType: OptionType.Call,
      }
      const short = {
        expiry,
        strike: scale(1200, 8).toString(),
        optionType: OptionType.Put,
      }
      await expectRevert(
        marginVault.write(alice, longId, shortId, long, short, amount),
        'MarginVault: option types must be same',
      )
    })
  })
})
