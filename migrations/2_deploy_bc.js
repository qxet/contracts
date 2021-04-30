const PredyToken = artifacts.require('PredyToken');
const LinearBondingCurve = artifacts.require('LinearBondingCurve');
const BN = web3.utils.BN;
const totalSupply = new BN(10).pow(new BN(26))

module.exports = async (deployer, network) => {
    await deployer.deploy(PredyToken, totalSupply);
    const token = await PredyToken.deployed()
    await deployer.deploy(LinearBondingCurve, token.address, 1, 1);
};
