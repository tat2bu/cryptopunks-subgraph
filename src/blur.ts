import { BigInt, ByteArray, Bytes, log } from "@graphprotocol/graph-ts";
import {
    Execution721Packed,
    Execution721MakerFeePacked,
    Execution721TakerFeePacked,
} from "../generated/BlurExchange/BlurExchange"
import { BlurExecutionContext, Event } from "../generated/schema";
import { getGlobalId, updateSaleState } from "./utils/helpers";
import { USDValue } from "./utils/conversions";

import {
    Transfer as BlurTransfer
  } from '../generated/BlurBiddingERC20/BlurBiddingERC20';

const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d")!;

function decodeAddressFromLowBits(value: BigInt): Bytes {
    const maskBytes = Bytes.fromHexString("0xffffffffffffffffffffffffffffffffffffffff") as ByteArray;
    const mask = BigInt.fromUnsignedBytes(maskBytes);

    const address = value.bitAnd(mask);
    const hex = address.toHexString().slice(-40).padStart(40, "0");
    return Bytes.fromHexString("0x" + hex)!;
}

export function decodeTokenId(value: BigInt): BigInt {
    let hex = value.toHexString().replace("0x", "").padStart(64, "0")
    let tokenHex = hex.slice(18, 22)  // octets 9 & 10
    let raw = Bytes.fromHexString("0x" + tokenHex) as ByteArray
    return BigInt.fromUnsignedBytes(raw.reverse() as ByteArray)
}

export function decodePrice(value: BigInt, isBid: boolean): BigInt {
    if (!isBid) {
        // cas ASK : bits 160–255
        return value.rightShift(160)
    }

    // Dans le cas des BIDs, collectionPriceSide NE contient PAS le prix.
    // Le vrai montant sera injecté depuis l'événement ERC20 Transfer.
    return BigInt.zero()
}

export function handleExecution721Packed(event: Execution721Packed): void {

    
    const packedTrader = event.params.tokenIdListingIndexTrader;
    const packedCollectionPrice = event.params.collectionPriceSide;

    const tokenId = decodeTokenId(packedTrader);
    
    
    const collection = decodeAddressFromLowBits(packedCollectionPrice);
    
    // Ne garder que la collection ciblée
    if (!collection.equals(TARGET_TOKEN)) {

        log.warning("TARGET_TOKEN not match tx {} collection {}", [
            event.transaction.hash.toHex(),
            collection.toHexString()
        ])
        return;
    }
    
    const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();

    const context = BlurExecutionContext.load(event.transaction.hash.toHex());
    if (!context) {
        log.warning("Execution721Packed: context not found for tx {}", [id]);
        return;
    }
    
    const isBid = context.from == event.transaction.from


    const price = decodePrice(event.params.collectionPriceSide, isBid)
    
    let evntId = getGlobalId(event);
    let evnt = new Event(evntId);
    
    evnt.type = 'Sale';
    evnt.platform = 'blur';
    evnt.tokenId = tokenId;
    evnt.fromAccount = context.from.toHexString();
    evnt.toAccount = context.to.toHexString();
    //return;

    if (context.paymentAmount) {
        evnt.value = context.paymentAmount!;
    } else {
        evnt.value = price;
    }
    evnt.usd = USDValue(event.block.timestamp, event.block.number);
    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    debugEvent(evnt);
    evnt.save();

    updateSaleState(evnt)
}

export function handleTransfer(event: BlurTransfer): void {
    const txHash = event.transaction.hash.toHex()
    let ctx = BlurExecutionContext.load(txHash)
    if (ctx) {
        ctx!.paymentAmount = event.params.value
        ctx!.from = event.params.from
        ctx!.paymentToken = event.address
        ctx!.isBid = true
        ctx!.save()
    }
}


export function debugEvent(evnt: Event): void {
    log.info("─[ Debug Event ]─────────────────────────────", []);

    log.info("id: {}", [evnt.id]);
    log.info("type: {}", [evnt.type]);
    log.info("platform: {}", [evnt.platform]);
    log.info("tokenId: {}", [evnt.tokenId.toString()]);
    log.info("transactionHash: {}", [evnt.transactionHash.toHexString()]);
    log.info("blockNumber: {}", [evnt.blockNumber.toString()]);
    log.info("blockTimestamp: {}", [evnt.blockTimestamp.toString()]);
    log.info("value: {}", [evnt.value.toString()]);

    if (evnt.fromAccount !== null) {
        log.info("fromAccount: {}", [evnt.fromAccount!]);
    } else {
        log.info("fromAccount: null", []);
    }

    if (evnt.toAccount !== null) {
        log.info("toAccount: {}", [evnt.toAccount!]);
    } else {
        log.info("toAccount: null", []);
    }

    if (evnt.usd !== null) {
        log.info("usd: {}", [evnt.usd!.toString()]);
    } else {
        log.info("usd: null", []);
    }

    log.info("──────────────────────────────────────────────", []);
}