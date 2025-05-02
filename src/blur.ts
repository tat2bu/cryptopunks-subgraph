import { BigInt, ByteArray, Bytes, log } from "@graphprotocol/graph-ts";
import {
    Execution721Packed,
    Execution721MakerFeePacked,
    Execution721TakerFeePacked,
  } from "../generated/BlurExchange/BlurExchange"
import { BlurExecutionContext, Event } from "../generated/schema";
import { getGlobalId } from "./utils/helpers";
import { USDValue } from "./utils/conversions";
  
const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d")!;

function decodeAddressFromLowBits(value: BigInt): Bytes {
    const mask = BigInt.fromUnsignedBytes(Bytes.fromHexString("0xffffffffffffffffffffffffffffffffffffffff")!);
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
    const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  
    const packedTrader = event.params.tokenIdListingIndexTrader;
    const packedCollectionPrice = event.params.collectionPriceSide;
  
    const tokenId = decodeTokenId(packedTrader);
  
    const collection = decodeAddressFromLowBits(packedCollectionPrice);  
  
  
    const context = BlurExecutionContext.load(event.transaction.hash.toHex());
    if (!context) {
      log.warning("Execution721Packed: context not found for tx {}", [id]);
      return;
    }
  
    
    // Ne garder que la collection ciblée
    if (!collection.equals(TARGET_TOKEN)) {
  
      log.warning("TARGET_TOKEN not match tx {} collection {}", [
        event.transaction.hash.toHex(),
        collection.toHexString()
      ])
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

    if (context.paymentAmount) {
        evnt.value = context.paymentAmount!;
      } else {
        evnt.value = price;
      }
    evnt.usd = USDValue(event.block.timestamp, event.block.number);
    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    evnt.save();
  /*
    const sale = new Sale(id);
    sale.bid = isBid;
    sale.platform = "BLUR_V2";
  
    sale.offerer = context.from;
    sale.buyer = context.to;
    sale.recipient = context.to;
    sale.tokenContract = context.collection;
  
  
    sale.tokenId = tokenId;
  
    if (context.paymentAmount) {
      sale.paymentAmount = context.paymentAmount!;
    } else {
      sale.paymentAmount = price;
    }
    sale.paymentToken = context.paymentToken!;
    sale.bid = context.isBid;
  
    sale.timestamp = context.timestamp;
    sale.transaction = event.transaction.hash;
  
    sale.transaction = event.transaction.hash;
    sale.paymentAmountRaw = price;
    sale.save();
  */



    /*
    const partial = new BlurSalePartial(id);
    partial.seller = sale.offerer;
    partial.buyer = sale.buyer;
    partial.timestamp = event.block.timestamp;
    partial.save();
    */
  }