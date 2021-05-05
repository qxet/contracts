const MockChainlinkAggregator = artifacts.require('MockChainlinkAggregator');
const MockERC20 = artifacts.require('MockERC20');
const PredyToken = artifacts.require('PredyToken');
const OptionsFactory = artifacts.require('OptionsFactory');
const PoolFactory = artifacts.require('PoolFactory');
const MarginVault = artifacts.require('MarginVault');
const PredyStaking = artifacts.require('PredyStaking');
const PriceCalculator = artifacts.require('PriceCalculator');

module.exports = async (deployer, network) => {
    const devAccount = '0xAf388d888bC46b2d6bf2Eac43296E5D9CE2e49A5';
    await deployer.deploy(MockChainlinkAggregator);
    await deployer.deploy(MockERC20, "MOCK", "MOCK");
    const aggregator = await MockChainlinkAggregator.deployed()
    const asset = await MockERC20.deployed()
    await asset.mint(devAccount, '100000000000000000000')

    const token = await PredyToken.deployed()

    await deployer.deploy(PredyStaking, token.address, asset.address);
    const feeRecepient = await PredyStaking.deployed()

    await deployer.deploy(MarginVault);
    const marginVault = await MarginVault.deployed()

    await deployer.deploy(PriceCalculator);
    const priceCalculator = await PriceCalculator.deployed()
    await PoolFactory.link('PriceCalculator', priceCalculator.address)
    await deployer.deploy(OptionsFactory);
    await deployer.deploy(PoolFactory);
    const optionsFactory = await OptionsFactory.deployed()
    const poolFactory = await PoolFactory.deployed()

    await poolFactory.createPool(
        asset.address
    )
    const pool = await poolFactory.getPool(asset.address)
    await optionsFactory.createOptions(
        asset.address,
        pool,
        marginVault.address,
        aggregator.address,
        feeRecepient.address,
    )
    const options = await optionsFactory.getOptions(asset.address)
    poolFactory.transferOwnership(asset.address, options)

    console.log('addresses', options, pool)
};
