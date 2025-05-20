/**
 * @file crypto-punks-market.ts
 * @description Handles events from the CryptoPunksMarket contract and updates the subgraph accordingly.
 */

import { BigInt, Bytes, log, store } from '@graphprotocol/graph-ts';

import { Account, Bid, Bundle, Event, Listing, Punk, TransactionExecutionContext, Transfer } from '../generated/schema';

import { Transfer as BlurBiddingTransfer } from "../generated/BlurBiddingERC20/BlurBiddingERC20"
import { Transfer as WrappedTransfer } from "../generated/WrappedPunks/WrappedPunks"

import {
  Assign as AssignEvent,
  Transfer as TransferEvent,
  PunkTransfer as PunkTransferEvent,
  PunkOffered as PunkOfferedEvent,
  PunkBidEntered as PunkBidEnteredEvent,
  PunkBidWithdrawn as PunkBidWithdrawnEvent,
  PunkBought as PunkBoughtEvent,
  PunkNoLongerForSale as PunkNoLongerForSaleEvent,
  PunkTransfer,
} from '../generated/CryptoPunksMarket/CryptoPunksMarket';

import { getFloorFromActiveListings, getGlobalId, getOrCreateAccount, getOrCreatePunk, getOrCreateState, loadPrevBidEvent, loadPrevSaleEvent, setPunkNoLongerForSale, updateOwnership } from './utils/helpers';
import { BIGINT_ONE, BIGINT_ZERO, WRAPPER_ADDRESS, ZERO_ADDRESS, washTrades } from './utils/constants';
import { USDValue } from './utils/conversions';

const TARGET_TOKEN = Bytes.fromHexString("0xb7f7f6c52f2e2fdb1963eab30438024864c313f6")!;
const NATIVE_PLATFORM = 'larvalabs';

/**
 * Handles the Assign event.
 * @param event - The AssignEvent object.
 */
export function handleAssign(event: AssignEvent): void {

  let fromAccount = getOrCreateAccount(ZERO_ADDRESS);
  let toAccount = getOrCreateAccount(event.params.to.toHexString());

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);

  evnt.type = 'Claimed';
  evnt.platform = NATIVE_PLATFORM
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

/**
 * Handles the Transfer event.
 * @param event - The TransferEvent object.
 */
export function handleTransfer(event: TransferEvent): void {
  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();

  let transfer = new Transfer(event.transaction.hash.toHexString());
  transfer.to = to;
  transfer.from = from;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();
}

let punkTransferTokenId: string;
/**
 * Handles the PunkTransfer event.
 * @param event - The PunkTransferEvent object.
 */
export function handlePunkTransfer(event: PunkTransferEvent): void {
  punkTransferTokenId = event.params.punkIndex.toString();

  let from = event.params.from.toHexString();
  let to = event.params.to.toHexString();

  let fromAccount: Account = getOrCreateAccount(from);
  let toAccount: Account = getOrCreateAccount(to);

  // Token Data
  let punk = getOrCreatePunk(punkTransferTokenId);

  // Check if punk is wrapped
  let isWrapped = false;
  let isUnwrapped = false;
  if (to == WRAPPER_ADDRESS) isWrapped = true;
  if (from == WRAPPER_ADDRESS) isUnwrapped = true;
  punk.wrapped = isWrapped;
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

  let eventType = isWrapped ? 'Wrapped' : isUnwrapped ? 'Unwrapped' : 'Transferred';
  evnt.type = eventType;
  evnt.platform = NATIVE_PLATFORM
  evnt.tokenId = event.params.punkIndex;
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
}

let punkBoughtTokenId: string;
/**
 * Handles the PunkBought event.
 * @param event - The PunkBoughtEvent object.
 */
export function handlePunkBought(event: PunkBoughtEvent): void {
  punkBoughtTokenId = event.params.punkIndex.toString();

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

  updateOwnership(
    event.transaction.hash,
    event.block.timestamp,
    punkBoughtTokenId,
    toAccount.id,
    fromAccount.id,
  );

  // If the sale is zero we ignore it UNLESS it was a bid of 0
  // There are ~16 instances of this
  if (!bid && value.equals(BIGINT_ZERO)) return;

  // Event
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);
  evnt.type = 'Sale';
  evnt.tokenId = event.params.punkIndex;
  evnt.platform = NATIVE_PLATFORM
  evnt.fromAccount = fromAccount.id;
  evnt.toAccount = toAccount.id;
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
export function handlePunkOffered(event: PunkOfferedEvent): void {
  punkOfferedTokenId = event.params.punkIndex.toString();

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
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);

  evnt.type = 'Offered';
  evnt.tokenId = event.params.punkIndex;
  evnt.platform = NATIVE_PLATFORM
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

let punkBidEnteredTokenId: string;
/**
 * Handles the PunkBidEntered event.
 * @param event - The PunkBidEnteredEvent object.
 */
export function handlePunkBidEntered(event: PunkBidEnteredEvent): void {
  punkBidEnteredTokenId = event.params.punkIndex.toString();

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
  evnt.tokenId = event.params.punkIndex;
  evnt.platform = NATIVE_PLATFORM
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
export function handlePunkBidWithdrawn(event: PunkBidWithdrawnEvent): void {
  punkBidWithdrawnTokenId = event.params.punkIndex.toString();

  let fromAccount = getOrCreateAccount(event.params.fromAddress.toHexString());

  // Active Bids
  let bid = Bid.load(punkBidWithdrawnTokenId);
  if (bid) store.remove('Bid', punkBidWithdrawnTokenId);

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);
  evnt.platform = NATIVE_PLATFORM
  evnt.type = 'BidWithdrawn';
  evnt.tokenId = event.params.punkIndex;

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
export function handlePunkNoLongerForSale(event: PunkNoLongerForSaleEvent): void {
  punkNoLongerForSaleTokenId = event.params.punkIndex.toString();

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
    evnt.platform = NATIVE_PLATFORM
    evnt.type = 'OfferWithdrawn';
    evnt.tokenId = event.params.punkIndex;

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


/**
 * Handles the PunkTransfer event.
 * @param event - The PunkTransferEvent object.
 */
export function handleWrappedTransfer(event: WrappedTransfer): void {
  prepareThirdPartySale(event);
}


export function prepareThirdPartySale(event: WrappedTransfer):void {
  const id = event.transaction.hash.toHexString()
  let ctx = TransactionExecutionContext.load(id)
  
  if (!ctx) {
    // Cas 1: Transfer arrive avant OrderFulfilled
    log.warning(
      "Transfer arrived BEFORE OrderFulfilled - Creating new context - TxHash: {}, TokenId: {}, From: {}, To: {}",
      [
        id,
        event.params.tokenId.toString(),
        event.params.from.toHexString(),
        event.params.to.toHexString()
      ]
    );
    
    ctx = new TransactionExecutionContext(id)
    ctx.tokenIds = []

    ctx.collection = TARGET_TOKEN;
    ctx.paymentAmount = null;
    ctx.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;
    ctx.isBid = false;
    ctx.from = event.params.from;
    ctx.to = event.params.to;
    ctx.timestamp = event.block.timestamp;
    ctx.eventId = null;
    ctx.save();
  } else {
    // Cas 2: Transfer arrive après OrderFulfilled
    log.warning(
      "Transfer arrived AFTER OrderFulfilled - Updating context - TxHash: {}, TokenId: {}, From: {}, To: {}, ctx.eventId: {}",
      [
        id,
        event.params.tokenId.toString(),
        event.params.from.toHexString(),
        event.params.to.toHexString(),
        ctx.eventId != null ? ctx.eventId! : 'null'
      ]
    );
    
    // Si un Event ou Bundle a déjà été créé (eventId est présent dans le contexte),
    // on le met à jour avec les adresses du Transfer
    if (ctx.eventId) {
      log.info(
        "Updating existing entity with Transfer addresses - tx: {} EntityId: {}, From: {}, To: {}",
        [
          id,
          ctx.eventId!,
          event.params.from.toHexString(),
          event.params.to.toHexString()
        ]
      );
      
      // Première vérification: est-ce un Event?
      let evnt = Event.load(ctx.eventId!);
      if (evnt) {
        // Mise à jour des adresses avec celles du Transfer
        evnt.fromAccount = event.params.from.toHexString();
        evnt.toAccount = event.params.to.toHexString();
        evnt.save();
        
        log.info("Event successfully updated with Transfer addresses", []);
      } else {
        // Si ce n'est pas un Event, c'est peut-être un Bundle
        let bundle = Bundle.load(ctx.eventId!);
        if (bundle) {
          // Mise à jour des adresses du Bundle avec celles du Transfer
          bundle.offerer = event.params.from;
          bundle.buyer = event.params.to;
          bundle.save();
          
          log.info("Bundle successfully updated with Transfer addresses", []);
        } else {
          log.error("Failed to load entity with id: {}", [ctx.eventId!]);
        }
      }
    }
  }

  // IMPORTANT: Les adresses du Transfer ERC-721 sont TOUJOURS prioritaires
  // Elles remplacent celles définies dans OrderFulfilled, même si celui-ci 
  // a déjà été traité et a créé un contexte
  ctx.from = event.params.from;
  ctx.to = event.params.to;

  // Éviter les doublons dans la liste des tokenIds
  const tokenId = event.params.tokenId;
  const tokenList = ctx.tokenIds;
  
  // Vérifier si le tokenId est déjà dans la liste
  let tokenExists = false;
  for (let i = 0; i < tokenList.length; i++) {
    if (tokenList[i].equals(tokenId)) {
      tokenExists = true;
      break;
    }
  }
  
  // Ajouter le tokenId seulement s'il n'est pas déjà présent
  if (!tokenExists) {
    tokenList.push(tokenId);
    ctx.tokenIds = tokenList;
  }

  ctx.save();
}

export function handleERC20BlurTransfer(event: BlurBiddingTransfer) :void {
    const txHash = event.transaction.hash.toHex()
    let ctx = TransactionExecutionContext.load(txHash)
    if (ctx) {
        ctx!.paymentAmount = event.params.value
        ctx!.from = event.params.from
        ctx!.paymentToken = event.address
        ctx!.isBid = true
        ctx!.save()
    }
}

