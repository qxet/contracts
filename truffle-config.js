require('ts-node/register')

module.exports = {
  networks: {
    local: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    }
  },
  plugins: ['solidity-coverage'],
  compilers: {
    solc: {
      version: '0.8.2',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      artifactType: 'truffle-v5',
      excludeContracts: ['Migrations'],
      showTimeSpent: true,
      currency: 'USD'
    },
  },
}
