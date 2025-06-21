import { BigInt, ethereum, log, Bytes } from "@graphprotocol/graph-ts"
import { OrdersMatched } from "../generated/WyvernExchange/WyvernExchange"
import { Event, TransactionExecutionContext } from "../generated/schema"
import { getGlobalId } from "./utils/helpers";
import { USDValue } from "./utils/conversions";
import { ONLY_ON_TX } from "./utils/constants";

export function handleOrdersMatched(event: OrdersMatched): void {
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex().toLowerCase() != ONLY_ON_TX.toLowerCase()) {
    return
  }
  
  let context = TransactionExecutionContext.load(event.transaction.hash.toHexString());    

  if (context == null) {
    log.warning("context was null for: tx = {}", [
      event.transaction.hash.toHexString()
    ]);
    return;
  }

  let evntId = getGlobalId(event);
  
  let evnt = new Event(evntId);

  evnt.type = 'Sale';
  evnt.platform = 'opensea';
  evnt.tokenId = context!.tokenIds[0]!;
  evnt.fromAccount = context!.from.toHexString();
  evnt.toAccount = context!.to.toHexString();
  
  log.warning("context was existing for: tx = {} from = {} to = {}", [
    event.transaction.hash.toHexString(),
    context!.from.toHexString(),
    context!.to.toHexString()
  ]);

  evnt.value = event.params.price;
  evnt.usd = USDValue(event.block.timestamp, event.block.number);
  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;
  
  evnt.save();  
}