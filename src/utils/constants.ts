import { BigInt, Bytes } from '@graphprotocol/graph-ts';

/**
 * Common constants used throughout the CryptoPunks subgraph
 */

/** Ethereum zero address constant */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** CryptoPunks Wrapper contract address (lowercase) */
export const WRAPPER_ADDRESS = '0xb7f7f6c52f2e2fdb1963eab30438024864c313f6'.toLowerCase();
export const C721_WRAPPER_ADDRESS = '0x000000000000003607fce1ac9e043a86675c5c2f'.toLowerCase();

/** Block number when the Chainlink ETH/USD price feed was deployed */
export const EACAggregatorProxyStartBlock = BigInt.fromI32(10606501);

/** BigInt constant for zero */
export let BIGINT_ZERO = BigInt.fromI32(0);

/** BigInt constant for one */
export let BIGINT_ONE = BigInt.fromI32(1);
// export const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d") as Bytes;

/** Array of known wash trade transaction hashes to filter out */
export let washTrades = [
  '0x92488a00dfa0746c300c66a716e6cc11ba9c0f9d40d8c58e792cc7fcebf432d0',
  '0xa4fa9c0976e550a27184c1ffd17f55f770c9afa429b7cd8495004302a82722c5'
];

// export const ONLY_ON_TX:string = "0xe0f91066dec4acedd280a2d1d6d8a3e81e8e66664036bba2dc933301968f72fb";
export const ONLY_ON_TX:string = "";
// export const ONLY_ON_TX:string = "0xf4bf0d474fb8fcaa069799e754ad9a6fbd4b7a46eb2d02963f51468521af7121";

export const TARGET_TOKENS = [
  Bytes.fromHexString("0xb7f7f6c52f2e2fdb1963eab30438024864c313f6")!,
  Bytes.fromHexString("0x000000000000003607fce1ac9e043a86675c5c2f")!,
];
