import { OrderFulfilled } from "../generated/Seaport/Seaport"
import { Bundle, FeeRecipient, Event } from "../generated/schema"
import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { USDValue } from "./utils/conversions";
import { getGlobalId, updateSaleState } from "./utils/helpers";

const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d") as Bytes;

export function handleOrderFulfilled(event: OrderFulfilled): void {
  
  let offerer = event.params.offerer;
  let recipient = event.params.recipient;
  let offer = event.params.offer;
  let consideration = event.params.consideration;

  let nfts: Bytes[] = [];
  let nftIds: BigInt[] = [];
  let paymentToken: Bytes | null = null;
  let paymentAmount = BigInt.zero();
  let matchFound = false;
  let isBid = offer.length > 0 && (offer[0].itemType == 0 || offer[0].itemType == 1);

  
  if (isBid) {
    for (let i = 0; i < consideration.length; i++) {
      let item = consideration[i];
      if (item.itemType == 2 || item.itemType == 3) {
        if (item.token.equals(TARGET_TOKEN)) {
          matchFound = true;
        }
        nfts.push(item.token);
        nftIds.push(item.identifier);
      }
    }
  } else {
    for (let i = 0; i < offer.length; i++) {
      let item = offer[i];
      
      if (item.itemType == 2 || item.itemType == 3) {
        if (item.token.equals(TARGET_TOKEN)) {
          matchFound = true;
        }
        nfts.push(item.token);
        nftIds.push(item.identifier);
      }
    }
  }

  if (!matchFound) {
    return;
  }

  for (let j = 0; j < consideration.length; j++) {
    let item = consideration[j];
    if (item.itemType == 0 || item.itemType == 1) {
      paymentToken = item.token;
      paymentAmount = paymentAmount.plus(item.amount);
    } else {
      let feeRecipient = new FeeRecipient(event.transaction.hash.toHex() + "-" + j.toString());
      feeRecipient.recipient = item.recipient;
      feeRecipient.amount = item.amount;
      feeRecipient.event = event.transaction.hash.toHex();
      feeRecipient.save();
    }
  }
  const buyer = isBid ? offerer : recipient;
  const seller = isBid ? recipient : offerer;
  
  /*
  log.info("handleOrderFulfilled triggered: seller = {}, buyer = {}, isBid = {} ", [
    seller.toHexString(),
    buyer.toHexString(),
    isBid.toString()
  ]);
  */

  if (nfts.length == 1) {
    /*
    let sale = new Sale(event.transaction.hash.toHex() + "-" + event.logIndex.toString());
    sale.platform = 'opensea';
    sale.bid = isBid;
    sale.offerer = seller;
    sale.buyer = buyer;
    sale.recipient = recipient;    
    sale.tokenContract = nfts[0];
    sale.tokenId = nftIds[0];
    if (paymentToken !== null) {
      sale.paymentToken = paymentToken as Bytes;
    } else {
      sale.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000") as Bytes;
    }    
    sale.paymentAmount = paymentAmount;
    sale.paymentAmountRaw = paymentAmount;
    sale.timestamp = event.block.timestamp;
    sale.transaction = event.transaction.hash;
    sale.save();
    */
    
    let evntId = getGlobalId(event);
    let evnt = new Event(evntId);
    
    evnt.type = 'Sale';
    evnt.platform = 'opensea';
    evnt.tokenId = nftIds[0];
    evnt.fromAccount = seller.toHexString();
    evnt.toAccount = buyer.toHexString();
    //return;
  
    evnt.value = paymentAmount;
    evnt.usd = USDValue(event.block.timestamp, event.block.number);
    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    evnt.save();   
  } else {
    let bundle = new Bundle(event.transaction.hash.toHex());
    bundle.platform = 'opensea';
    bundle.offerer = seller;
    bundle.buyer = buyer;
    bundle.recipient = recipient;    
    bundle.tokenContracts = nfts;
    bundle.tokenIds = nftIds;
    if (paymentToken !== null) {
      bundle.paymentToken = paymentToken as Bytes;
    } else {
      bundle.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000") as Bytes;
    }
    bundle.paymentAmount = paymentAmount;
    bundle.timestamp = event.block.timestamp;
    bundle.transaction = event.transaction.hash;
    bundle.save();
  }
}