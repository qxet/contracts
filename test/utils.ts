const { ethers } = require('ethers')

const BN = web3.utils.BN

export enum OptionType {
  Call,
  Put,
  CashOrNothingCall,
  CashOrNothingPut,
}

export async function calculateGas(response: Truffle.TransactionResponse) {
  const tx = await web3.eth.getTransaction(response.tx)
  const gasPrice = tx.gasPrice
  const settleGas = new BN(response.receipt.gasUsed).mul(new BN(gasPrice))
  return settleGas
}

export function scale(x: number, digit: number): BN {
  return new BN(x).mul(new BN(10).pow(new BN(digit)))
}

export function genRangeId(s: number, e: number): number {
  return s + 1e2 * e
}

export function formatEther(n: BN): string {
  return ethers.utils.formatEther(ethers.BigNumber.from(n.toString()))
}

export function formatUnits(n: BN, decimals: number): string {
  return ethers.utils.formatUnits(ethers.BigNumber.from(n.toString()), decimals)
}
