import { BigInt, Bytes } from '@graphprotocol/graph-ts';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const EACAggregatorProxyStartBlock = BigInt.fromI32(10606501);

export let BIGINT_ZERO = BigInt.fromI32(0);
export let BIGINT_ONE = BigInt.fromI32(1);

export let washTrades = ['0x92488a00dfa0746c300c66a716e6cc11ba9c0f9d40d8c58e792cc7fcebf432d0'];

export const TARGET_TOKEN = Bytes.fromHexString("0xf07468ead8cf26c752c676e43c814fee9c8cf402")!;
