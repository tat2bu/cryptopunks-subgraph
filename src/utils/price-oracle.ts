/**
 * @file price-oracle.ts
 * @description This file contains functions for interacting with the Chainlink price oracle.
 */

import { BigInt, Address } from "@graphprotocol/graph-ts"
import { AggregatorV3Interface } from "../../generated/CryptoPunksMarket/AggregatorV3Interface"
import { EACAggregatorProxyStartBlock } from "./constants"

/**
 * Retrieves the latest ETH/USD price from the Chainlink price feed.
 * @param block - The current block number.
 * @returns The latest price as a BigInt, or -1 if the price cannot be retrieved.
 */
export function getLatestPrice(block: BigInt): BigInt {
  // Check if the current block is before the EACAggregatorProxy contract deployment
  if (block.lt(EACAggregatorProxyStartBlock)) {
    return BigInt.fromI32(-1)
  }

  // Chainlink ETH/USD Price Feed address on Ethereum mainnet
  let oracleAddress = Address.fromString("0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419")
  let contract = AggregatorV3Interface.bind(oracleAddress)
  let result = contract.try_latestRoundData()

  // If the call to the oracle reverts, return -1
  if (result.reverted) {
    return BigInt.fromI32(-1)
  }

  // Return the latest price (second value in the returned tuple)
  return result.value.value1
}