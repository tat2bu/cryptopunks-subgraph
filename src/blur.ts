import { BigInt, ByteArray, Bytes, log } from "@graphprotocol/graph-ts";
import {
    Execution721Packed,
    Execution721MakerFeePacked,
    Execution721TakerFeePacked,
} from "../generated/BlurExchange/BlurExchange"
import { TransactionExecutionContext, Event } from "../generated/schema";
import { getGlobalId, updateSaleState } from "./utils/helpers";
import { USDValue } from "./utils/conversions";

import {
    Transfer as BlurTransfer
  } from '../generated/BlurBiddingERC20/BlurBiddingERC20';
import { ONLY_ON_TX, TARGET_TOKEN } from "./utils/constants";

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
    if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
        return
    }
    
    const packedTrader = event.params.tokenIdListingIndexTrader;
    const packedCollectionPrice = event.params.collectionPriceSide;

    const tokenId = decodeTokenId(packedTrader);
    
    
    const collection = decodeAddressFromLowBits(packedCollectionPrice);
    
    // Ne garder que la collection ciblée
    if (!collection.equals(TARGET_TOKEN)) {
/*
        log.debug("TARGET_TOKEN not match tx {} collection {}", [
            event.transaction.hash.toHex(),
            collection.toHexString()
        ])
*/
        return;
    }
    
    const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();

    const context = TransactionExecutionContext.load(event.transaction.hash.toHexString());
    if (!context) {
        log.debug("Execution721Packed: context not found for tx {}", [id]);
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


    let tokenCount: BigInt = context.tokenIds != null && context.tokenIds.length > 0
        ? BigInt.fromI32(context.tokenIds.length)
        : BigInt.fromI32(1);


    evnt.value = BigInt.zero();

    if (context.paymentAmount) {
        evnt.value = context.paymentAmount!;
        evnt.value = context.paymentAmount!.div(tokenCount);
    } else {
        evnt.value = price;
        evnt.value = price.div(tokenCount);
    }
    
    evnt.usd = USDValue(event.block.timestamp, event.block.number);
    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.isBid = isBid
    evnt.transactionHash = event.transaction.hash;
    evnt.save();

    if (!context.eventIds) {
        context.eventIds = [];
    }
    const eventIds = context.eventIds
    eventIds.push(evnt.id)
    context.eventIds = eventIds
    context.save()
    
    log.debug('added event id {} to context {} —> {}', [
        evnt.id,
        context.id,
        context.eventIds.length.toString()
    ])

    updateSaleState(evnt)
    
}

export function handleTransfer(event: BlurTransfer): void {
    if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
        return
    }
    const txHash = event.transaction.hash.toHexString()
    let ctx = TransactionExecutionContext.load(txHash)
    if (ctx) {
        // Mettre à jour les informations de paiement
        if (!ctx!.paymentAmount) {
            ctx!.paymentAmount = BigInt.fromI32(0)
        }
        ctx!.paymentAmount = ctx!.paymentAmount!.plus(event.params.value)
        ctx!.paymentToken = event.address
        ctx!.isBid = true
        
        // Ne pas modifier les adresses from/to ici
        // Elles sont définies par le handleTransfer de CryptoPunks
        // ou par handleExecution721Packed si le Transfer ERC-721 
        // n'a pas encore été traité
        
        ctx!.save()

        if (ctx.eventIds != null) {
            for (let i=0; i<ctx.eventIds!.length; i++) {
                const eventId = ctx.eventIds![i]
                let evnt = Event.load(eventId);
                if (evnt) {
                    let tokenCount: BigInt = ctx.tokenIds != null && ctx.tokenIds.length > 0
                        ? BigInt.fromI32(ctx.tokenIds.length)
                        : BigInt.fromI32(1);

                    evnt.value = ctx.paymentAmount!.div(tokenCount);
                    
                    log.debug("HERE {}/{} Event {} successfully updated with paymentAmount {}", [
                        tokenCount.toString(),
                        ctx.tokenIds!.length.toString(),
                        eventId,
                        evnt.value.toString()
                    ]);
                    evnt.save();
                }
            }
        }

        log.debug('blur log for tx {} with event id {}', [
            ctx.id,
            ctx.eventIds != null ? ctx.eventIds!.length.toString() : 'null'
        ])
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