import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const EACAggregatorProxyStartBlock = BigInt.fromI32(10606501);

export let BIGINT_ZERO = BigInt.fromI32(0);
export let BIGINT_ONE = BigInt.fromI32(1);
export const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d") as Bytes;

// export const ONLY_ON_TX:string = "0xe0f91066dec4acedd280a2d1d6d8a3e81e8e66664036bba2dc933301968f72fb";
export const ONLY_ON_TX:string = "";

export let washTrades = ['0x92488a00dfa0746c300c66a716e6cc11ba9c0f9d40d8c58e792cc7fcebf432d0'];