import { OrderFulfilled } from "../generated/Seaport/Seaport"
import { Bundle, FeeRecipient, Event, TransactionExecutionContext } from "../generated/schema"
import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { USDValue } from "./utils/conversions";
import { getGlobalId, updateSaleState } from "./utils/helpers";
import { ONLY_ON_TX, TARGET_TOKENS, ZERO_ADDRESS } from "./utils/constants";

export function handleOrderFulfilled(event: OrderFulfilled): void {


  let recipient = event.params.recipient;

  let offer = event.params.offer;
  let consideration = event.params.consideration;

  let nfts: Bytes[] = [];
  let nftIds: BigInt[] = [];
  let paymentToken: Bytes | null = null;
  let paymentAmount = BigInt.zero();
  let matchFound = false;
  //let isBid = offer.length > 0 && (offer[0].itemType == 2 || offer[0].itemType == 3);
  let isBid = consideration.filter(c => c.recipient.toHexString().toLowerCase() === '0x0000a26b00c1F0DF003000390027140000fAa719'.toLowerCase()).length > 0;

  log.warning("[SEAPORT] isBid triggered: tx = {}, isBid = {}, index = {}", [
    event.transaction.hash.toHexString(),
    isBid.toString(),
    event.logIndex.toString()
  ]);

  if (isBid && event.params.zone && !event.params.zone.equals(Address.zero())) {
  
      log.warning("[SEAPORT] Ignoring zone {} for tx and event {} {}", [
          event.params.zone.toHexString().toLowerCase(),
          event.transaction.hash.toHex(),
          event.logIndex.toString()
      ])
    // do not index fees transactions
    return
  }

  for (let i = 0; i < offer.length; i++) {
    let item = offer[i];

    if (item.itemType == 2 || item.itemType == 3) {
      if (TARGET_TOKENS.includes(item.token)) {
        matchFound = true;
      }
      nfts.push(item.token);
      nftIds.push(item.identifier);
    }

    if (item.itemType == 0 || item.itemType == 1) {
      paymentToken = item.token;
      paymentAmount = paymentAmount.plus(item.amount);
    }
  }

  for (let i = 0; i < consideration.length; i++) {
    let item = consideration[i];
    if (item.itemType == 2 || item.itemType == 3) {
      if (TARGET_TOKENS.includes(item.token)) {
        matchFound = true;
      }
      nfts.push(item.token);
      nftIds.push(item.identifier);
    }
    if (item.itemType == 0 || item.itemType == 1) {
      paymentToken = item.token;
      paymentAmount = paymentAmount.plus(item.amount);
    } else {
      // fees
      /*
      let feeRecipient = new FeeRecipient(event.transaction.hash.toHex() + "-" + j.toString());
      feeRecipient.recipient = item.;
      feeRecipient.amount = item.amount;
      feeRecipient.event = event.transaction.hash.toHex();
      feeRecipient.save();
      */
    }
  }
  if (!matchFound) {
    if (ONLY_ON_TX != "") {
      log.warning("[SEAPORT] No match found for tx = {} index = {}", [
        event.transaction.hash.toHexString(),
        event.logIndex.toString()
      ]);
    }
    return;
  }

  /*
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
  */

  let evntId = getGlobalId(event);
  let context = TransactionExecutionContext.load(event.transaction.hash.toHexString());

  if (!context) {

    log.warning("[SEAPORT] creatingContext for: tx = {}, index = {}", [
      event.transaction.hash.toHexString(),
      event.logIndex.toString()
    ]);
    context = new TransactionExecutionContext(event.transaction.hash.toHexString())
    context.tokenIds = []
    context.from = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;
    context.to = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;

    context.collection = TARGET_TOKENS[0]; // TODO: check if this is correct
    context.paymentAmount = null;
    context.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;
    context.isBid = isBid;
    context.timestamp = event.block.timestamp;
    context.eventIds = [evntId]
    context.tokenIds = nftIds
    context.save()
  } else {
    for (let i = 0; i < nftIds.length; i++) {
      if (context.tokenIds.includes(nftIds[i])) {

        log.warning("[SEAPORT] handleOrderFulfilled token already indexed: tx = {}, token = {}, index = {}", [
          event.transaction.hash.toHexString(),
          nftIds[i].toString(),
          event.logIndex.toString()
        ]);
        return;
      }
    }

  }

  log.warning("[SEAPORT] handleOrderFulfilled triggered: tx = {}, isBid = {}, amount = {}, nfts = {} ", [
    event.transaction.hash.toHexString(),
    isBid.toString(),
    paymentAmount.toString(),
    nfts.length.toString()
  ]);


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

    let evnt = new Event(evntId);

    evnt.type = 'Sale';
    evnt.platform = 'opensea';
    evnt.tokenId = nftIds[0];
    evnt.fromAccount = context!.from.toHexString();
    evnt.toAccount = context!.to.toHexString();
    evnt.isBid = isBid
    //return;

    log.warning("[SEAPORT] context was existing for: tx = {} from = {} to = {} amount = {}", [
      event.transaction.hash.toHexString(),
      context!.from.toHexString(),
      context!.to.toHexString(),
      paymentAmount.toString()
    ]);
    evnt.value = paymentAmount;
    
    evnt.usd = USDValue(event.block.timestamp, event.block.number);
    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    const eventIds = context.eventIds
    eventIds.push(evnt.id)
    context.eventIds = eventIds
    context.save()
    evnt.save();
  } else {
    let bundle = new Bundle(event.transaction.hash.toHex());
    bundle.platform = 'opensea';
    bundle.offerer = context!.from;
    bundle.buyer = context!.to;
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