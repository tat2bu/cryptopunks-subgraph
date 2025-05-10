/**
 * @file crypto-punks-market.ts
 * @description Handles events from the CryptoPunksMarket contract and updates the subgraph accordingly.
 */

import { BigInt, Bytes, store } from '@graphprotocol/graph-ts';

import { Account, Bid, BlurExecutionContext, Event, Listing, Punk, Transfer } from '../generated/schema';

import {
  PhunkOffered as PhunkOfferedEvent,
  PhunkBidEntered as PhunkBidEntered,
  PhunkBidWithdrawn as PhunkBidWithdrawnEvent,
  PhunkBought as PhunkBoughtEvent,
  PhunkNoLongerForSale as PunkNoLongerForSaleEvent,
} from '../generated/CryptoPhunks/CryptoPhunks';
import { Transfer as BlurBiddingTransfer } from "../generated/BlurBiddingERC20/BlurBiddingERC20"
import {
  Transfer as PhunkTransfer
} from '../generated/CryptoPhunks/CryptoPhunksToken';

import { getFloorFromActiveListings, getGlobalId, getOrCreateAccount, getOrCreatePunk, getOrCreateState, loadPrevBidEvent, loadPrevSaleEvent, setPunkNoLongerForSale, updateOwnership } from './utils/helpers';
import { BIGINT_ONE, BIGINT_ZERO, ZERO_ADDRESS, washTrades } from './utils/constants';
import { USDValue } from './utils/conversions';

/**
 * Handles the Assign event.
 * @param event - The AssignEvent object.
 */
/*
export function handleAssign(event: AssignEvent): void {

  let fromAccount = getOrCreateAccount(ZERO_ADDRESS);
  let toAccount = getOrCreateAccount(event.params.to.toHexString());

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);

  evnt.type = 'Claimed';
  evnt.tokenId = event.params.punkIndex;

  evnt.fromAccount = ZERO_ADDRESS;
  evnt.toAccount = toAccount.id;
  evnt.value = BIGINT_ZERO;

  evnt.usd = USDValue(event.block.timestamp, event.block.number);

  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;

  evnt.save();

  updateOwnership(
    event.transaction.hash,
    event.block.timestamp,
    event.params.punkIndex.toString(),
    toAccount.id,
    fromAccount.id,
  );
}
*/

const TARGET_TOKEN = Bytes.fromHexString("0xf07468ead8cf26c752c676e43c814fee9c8cf402")!;
const NATIVE_PLATFORM = 'notlarvalabs';


let punkTransferTokenId: string;


/**
 * Handles the PunkTransfer event.
 * @param event - The PunkTransferEvent object.
 */
export function handleTransfer(event: PhunkTransfer): void {

  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();

  let transfer = new Transfer(event.transaction.hash.toHexString());
  transfer.to = to;
  transfer.from = from;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  punkTransferTokenId = event.params.tokenId.toString();

  let fromAccount: Account = getOrCreateAccount(from);
  let toAccount: Account = getOrCreateAccount(to);

  // Token Data
  let punk = getOrCreatePunk(punkTransferTokenId);

  // Check if punk is wrapped
  punk.save();

  let newOwnerIsBidder = false;
  let bid = Bid.load(punkTransferTokenId);
  if (bid) {
    let bidderAccount = getOrCreateAccount(bid.fromAccount);
    if (bidderAccount.id.toLowerCase() == toAccount.id.toLowerCase()) {
      newOwnerIsBidder = true;
    }
  }

  setPunkNoLongerForSale(punkTransferTokenId, newOwnerIsBidder);

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);

  evnt.type = 'Transferred';
  evnt.tokenId = event.params.tokenId;
  evnt.platform = NATIVE_PLATFORM;
  evnt.fromAccount = fromAccount.id;
  evnt.toAccount = toAccount.id;
  evnt.value = BIGINT_ZERO;
  evnt.usd = USDValue(event.block.timestamp, event.block.number);

  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;

  let state = getOrCreateState(event.block.timestamp);
  let newActiveListings = state.activeListings;
  if (newActiveListings.indexOf(punkTransferTokenId) > -1) {
    newActiveListings = newActiveListings.filter((id) => id != punkTransferTokenId);
  }

  state.activeListings = newActiveListings;

  let newFloor = getFloorFromActiveListings(state);
  state.floor = newFloor;

  state.usd = USDValue(event.block.timestamp, event.block.number);
  state.save();

  evnt.save();

  updateOwnership(
    event.transaction.hash,
    event.block.timestamp,
    punkTransferTokenId,
    toAccount.id,
    fromAccount.id,
  );

  prepareThirdPartySale(event);
}


let punkBoughtTokenId: string;
/**
 * Handles the PunkBought event.
 * @param event - The PunkBoughtEvent object.
 */
export function handlePhunkBought(event: PhunkBoughtEvent): void {
  punkBoughtTokenId = event.params.phunkIndex.toString();

  let isWash = washTrades.includes(event.transaction.hash.toHexString());

  let fromAccount = getOrCreateAccount(event.params.fromAddress.toHexString());
  let toAccount = getOrCreateAccount(event.params.toAddress.toHexString());
  let value = event.params.value;

  // Issue in te CP contract
  // https://github.com/larvalabs/cryptopunks/issues/19
  let bid = Bid.load(punkBoughtTokenId);
  if (toAccount.id == ZERO_ADDRESS) {
    if (bid) {
      toAccount = getOrCreateAccount(bid.fromAccount);
      value = bid.value;
    }
    setPunkNoLongerForSale(punkBoughtTokenId, true);
  } else if (bid && bid.fromAccount.toLowerCase() == toAccount.id.toLowerCase()) {
    setPunkNoLongerForSale(punkBoughtTokenId, true);
  } else {
    setPunkNoLongerForSale(punkBoughtTokenId, false);
  }

  /*
  updateOwnership(
    event.transaction.hash,
    event.block.timestamp,
    punkBoughtTokenId,
    toAccount.id,
    fromAccount.id,
  );
  */

  // If the sale is zero we ignore it UNLESS it was a bid of 0
  // There are ~16 instances of this
  if (!bid && value.equals(BIGINT_ZERO)) return;

  // Event
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);
  evnt.type = 'Sale';
  evnt.tokenId = event.params.phunkIndex;
  evnt.platform = NATIVE_PLATFORM;
  evnt.fromAccount = fromAccount.id;
  evnt.toAccount = toAccount.id;
  value = isWash ? BIGINT_ZERO : value;
  evnt.value = value;
  evnt.usd = USDValue(event.block.timestamp, event.block.number);
  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;
  evnt.save();

  // State
  let state = getOrCreateState(event.block.timestamp);
  let topSale = state.topSale;
  let prevSaleEvent = loadPrevSaleEvent(topSale);

  let prevEventSaleValue: BigInt;
  if (prevSaleEvent && prevSaleEvent.value && prevSaleEvent.value.gt(BIGINT_ZERO)) {
    prevEventSaleValue = prevSaleEvent.value;
    if (value.gt(prevEventSaleValue)) state.topSale = evntId;
  } else {
    state.topSale = evntId;
  }

  let newActiveListings = state.activeListings;
  if (newActiveListings.indexOf(punkBoughtTokenId) > -1) {
    newActiveListings = newActiveListings.filter((id) => id != punkBoughtTokenId);
  }
  state.activeListings = newActiveListings;

  let newFloor = getFloorFromActiveListings(state);
  state.floor = newFloor;
  state.sales = state.sales.plus(BIGINT_ONE);
  state.volume = state.volume.plus(value);
  state.usd = USDValue(event.block.timestamp, event.block.number);
  state.save();
}

let punkOfferedTokenId: string;
/**
 * Handles the PunkOffered event.
 * @param event - The PunkOfferedEvent object.
 */
export function handlePhunkOffered(event: PhunkOfferedEvent): void {
  punkOfferedTokenId = event.params.phunkIndex.toString();

  let fromAccount = getOrCreateAccount(event.transaction.from.toHexString());
  let toAccount = getOrCreateAccount(event.params.toAddress.toHexString());

  // Punk
  let punk = Punk.load(punkOfferedTokenId);
  if (!punk) punk = new Punk(punkOfferedTokenId);

  // Active Listings
  let listing = Listing.load(punkOfferedTokenId);
  if (!listing) listing = new Listing(punkOfferedTokenId);
  let isPrivate = false;
  
  listing.punk = punk.id;
  listing.value = event.params.minValue;
  listing.usd = USDValue(event.block.timestamp, event.block.number);
  listing.fromAccount = fromAccount.id;
  listing.toAccount = toAccount.id;

  if (toAccount.id != ZERO_ADDRESS) isPrivate = true;
  listing.isPrivate = isPrivate;

  listing.blockNumber = event.block.number;
  listing.blockTimestamp = event.block.timestamp;
  listing.transactionHash = event.transaction.hash;
  listing.save();

  // Events
  if (!listing.isPrivate) {
    let evntId = getGlobalId(event);
    let evnt = new Event(evntId);
    evnt.platform = NATIVE_PLATFORM;
    evnt.type = 'Offered';
    evnt.tokenId = event.params.phunkIndex;

    evnt.fromAccount = fromAccount.id;
    evnt.toAccount = toAccount.id;
    evnt.value = event.params.minValue;

    evnt.usd = USDValue(event.block.timestamp, event.block.number);

    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    evnt.save();

    let state = getOrCreateState(event.block.timestamp);
    let newListingState = state.listings.plus(BIGINT_ONE);
    state.listings = newListingState;
  
    let activeListings: string[] = [];
    if (state.activeListings) activeListings = state.activeListings;
    activeListings.push(punkOfferedTokenId);
  
    state.activeListings = activeListings;
  
    let listingVal = event.params.minValue;
    if (
      toAccount.id != ZERO_ADDRESS && 
      listingVal.notEqual(BIGINT_ZERO) && 
      listingVal.lt(state.floor)
    ) {
      state.floor = listingVal;  
    }
    state.usd = USDValue(event.block.timestamp, event.block.number);
  
    state.save();
  }
}

let punkBidEnteredTokenId: string;
/**
 * Handles the PunkBidEntered event.
 * @param event - The PunkBidEnteredEvent object.
 */
export function handlePhunkBidEntered(event: PhunkBidEntered): void {
  punkBidEnteredTokenId = event.params.phunkIndex.toString();

  let fromAccount = getOrCreateAccount(event.params.fromAddress.toHexString());

  // Punk
  let punk = Punk.load(punkBidEnteredTokenId);
  if (punk == null) punk = new Punk(punkBidEnteredTokenId);

  // Active Bid
  let bid = Bid.load(punkBidEnteredTokenId);
  if (!bid) bid = new Bid(punkBidEnteredTokenId);
  
  bid.punk = punk.id;
  bid.value = event.params.value;
  bid.usd = USDValue(event.block.timestamp, event.block.number);
  bid.fromAccount = fromAccount.id;
  bid.blockNumber = event.block.number;
  bid.blockTimestamp = event.block.timestamp;
  bid.transactionHash = event.transaction.hash;
  bid.save();

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);

  evnt.type = 'BidEntered';
  evnt.platform = NATIVE_PLATFORM;
  evnt.tokenId = event.params.phunkIndex;

  evnt.fromAccount = fromAccount.id;
  evnt.toAccount = ZERO_ADDRESS;
  evnt.value = event.params.value;

  evnt.usd = USDValue(event.block.timestamp, event.block.number);

  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;

  evnt.save();

  let state = getOrCreateState(event.block.timestamp);

  let topBid = state.topBid;
  let prevBidEvent = loadPrevBidEvent(topBid);

  let prevEventBidValue: BigInt;
  if (prevBidEvent && prevBidEvent.value && prevBidEvent.value.gt(BIGINT_ZERO)) {
    prevEventBidValue = prevBidEvent.value;
    if (event.params.value.gt(prevEventBidValue)) state.topBid = evntId;
  } else {
    state.topBid = evntId;
  }
  state.usd = USDValue(event.block.timestamp, event.block.number);

  state.bids = state.bids.plus(BIGINT_ONE);
  state.save();
}

let punkBidWithdrawnTokenId: string;
/**
 * Handles the PunkBidWithdrawn event.
 * @param event - The PunkBidWithdrawnEvent object.
 */
export function handlePhunkBidWithdrawn(event: PhunkBidWithdrawnEvent): void {
  punkBidWithdrawnTokenId = event.params.phunkIndex.toString();

  let fromAccount = getOrCreateAccount(event.params.fromAddress.toHexString());

  // Active Bids
  let bid = Bid.load(punkBidWithdrawnTokenId);
  if (bid) store.remove('Bid', punkBidWithdrawnTokenId);

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);
  evnt.platform = NATIVE_PLATFORM;
  evnt.type = 'BidWithdrawn';
  evnt.tokenId = event.params.phunkIndex;

  evnt.fromAccount = fromAccount.id;
  evnt.toAccount = ZERO_ADDRESS;
  evnt.value = event.params.value;

  evnt.usd = USDValue(event.block.timestamp, event.block.number);

  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;

  evnt.save();
}

let punkNoLongerForSaleTokenId: string;
/**
 * Handles the PunkNoLongerForSale event.
 * @param event - The PunkNoLongerForSaleEvent object.
 */
export function handlePhunkNoLongerForSale(event: PunkNoLongerForSaleEvent): void {
  punkNoLongerForSaleTokenId = event.params.phunkIndex.toString();

  setPunkNoLongerForSale(punkNoLongerForSaleTokenId);

  let isBuy = false;
  let transfer = Transfer.load(event.transaction.hash.toHexString());
  if (transfer) {
    transfer.tokenId = punkNoLongerForSaleTokenId;
    isBuy = true;
  }

  let state = getOrCreateState(event.block.timestamp);

  if (!isBuy) {
    // Events
    let evntId = getGlobalId(event);
    let evnt = new Event(evntId);

    evnt.type = 'OfferWithdrawn';
    evnt.tokenId = event.params.phunkIndex;
    evnt.platform = NATIVE_PLATFORM;

    evnt.fromAccount = ZERO_ADDRESS;
    evnt.toAccount = ZERO_ADDRESS;
    evnt.value = BIGINT_ZERO;

    evnt.usd = USDValue(event.block.timestamp, event.block.number);

    evnt.blockNumber = event.block.number;
    evnt.blockTimestamp = event.block.timestamp;
    evnt.transactionHash = event.transaction.hash;
    
    evnt.save();

    let delistings = state.delistings;
    delistings = delistings.plus(BIGINT_ONE);
    state.delistings = delistings;
  }

  let newActiveListings = state.activeListings;
  if (state.activeListings.includes(punkNoLongerForSaleTokenId)) {
    newActiveListings = state.activeListings.filter((id) => id != punkNoLongerForSaleTokenId);
  }
  state.activeListings = newActiveListings;

  let newFloor = getFloorFromActiveListings(state);
  state.floor = newFloor;
  state.usd = USDValue(event.block.timestamp, event.block.number);

  state.save();
}


export function prepareThirdPartySale(event: PhunkTransfer):void {
  const id = event.transaction.hash.toHex()
  let ctx = BlurExecutionContext.load(id)

  if (!ctx) {
    ctx = new BlurExecutionContext(id)
    ctx.tokenIds = []

    ctx.collection = TARGET_TOKEN;
    ctx.from = event.params.from;
    ctx.to = event.params.to;
    ctx.paymentAmount = null;
    ctx.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;
    ctx.isBid = false;
    ctx.hasExecution = false;
    ctx.timestamp = event.block.timestamp;
  }

  const tokenId = event.params.tokenId
  const tokenList = ctx.tokenIds
  tokenList.push(tokenId)
  ctx.tokenIds = tokenList

  ctx.save()  
}

export function handleERC20BlurTransfer(event: BlurBiddingTransfer) :void {
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