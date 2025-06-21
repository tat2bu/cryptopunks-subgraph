/**
 * @file crypto-punks-market.ts
 * @description Handles events from the CryptoPunksMarket contract and updates the subgraph accordingly.
 */

import { BigInt, Bytes, ethereum, log, store } from '@graphprotocol/graph-ts';

import { Account, Bid, TransactionExecutionContext, Event, Listing, Punk, Transfer, Bundle } from '../generated/schema';

import {
  PunkOffered as PunkOfferedEvent,
  PunkBidEntered as PunkBidEntered,
  PunkBidWithdrawn as PunkBidWithdrawnEvent,
  PunkBought as PunkBoughtEvent,
  PunkNoLongerForSale as PunkNoLongerForSaleEvent,
} from '../generated/CryptoPunksV1/CryptoPunksV1';

import {
  Assign,
  PunkTransfer
} from '../generated/CryptoPunksV1Token/CryptoPunksV1Token';

import {
  Transfer as WrappedTransfer
} from '../generated/CryptoPunksV1WrappedToken/CryptoPunksV1WrappedToken';

import { Transfer as BlurBiddingTransfer } from "../generated/BlurBiddingERC20/BlurBiddingERC20"

import { getFloorFromActiveListings, getGlobalId, getOrCreateAccount, getOrCreatePunk, getOrCreateState, loadPrevBidEvent, loadPrevSaleEvent, setPunkNoLongerForSale, updateOwnership, updateSaleState } from './utils/helpers';
import { BIGINT_ONE, BIGINT_ZERO, ONLY_ON_TX, ZERO_ADDRESS, washTrades } from './utils/constants';
import { USDValue } from './utils/conversions';

const TARGET_TOKEN = Bytes.fromHexString("0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d")!;
const NATIVE_PLATFORM = 'punkv1';
const WRAPPER_ADDRESS = '0x282bdd42f4eb70e7a9d9f40c8fea0825b7f68c5d'


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


let punkTransferTokenId: string;


export function handleAssign(event: Assign): void {

  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }  

  let to = event.params.to.toHexString();
  let from = ZERO_ADDRESS;

  const tx = event.transaction.hash

  handleTransferInner(event, tx, to, from, event.params.punkIndex, 'Assigned');
}

/**
 * Handles the PunkTransfer event.
 * @param event - The PunkTransferEvent object.
 */
export function handleTransfer(event: PunkTransfer): void {
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }

  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();

  const tx = event.transaction.hash

  let eventType = 'Transferred'

  handleTransferInner(event, tx, to, from, event.params.punkIndex, eventType);
  prepareThirdPartySale(event.transaction.hash, event.params.from, event.params.to, event.block.timestamp, event.params.punkIndex);  
}


/**
 * Handles the PunkTransfer event.
 * @param event - The PunkTransferEvent object.
 */
export function handleWrappedTransfer(event: WrappedTransfer): void {
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }

  let to = event.params.to.toHexString();
  let from = event.params.from.toHexString();

  const tx = event.transaction.hash
  log.debug('handleWrappedTransfer {} {}', [tx.toHexString(), event.params.tokenId.toString()])

  handleTransferInner(event, tx, to, from, event.params.tokenId, 'Transferred');
  // gruik
  prepareThirdPartySale(event.transaction.hash, event.params.from, event.params.to, event.block.timestamp, event.params.tokenId);  

  const punk = getOrCreatePunk(event.params.tokenId.toString())
  punk.wrapped = true
  punk.save()
}

export function handleTransferInner(
  event:ethereum.Event,
  tx:Bytes, 
  to:string, 
  from:string, 
  tokenId:BigInt,
  eventType:string):void {
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }

  if (from == ZERO_ADDRESS && eventType != 'Assigned') {
    eventType = 'Wrapped'
  } else if (from.toLowerCase() == TARGET_TOKEN.toHexString()) {
    eventType = 'Unwrapped'
  }

  let transfer = new Transfer(tx.toHexString());
  transfer.to = to;
  transfer.from = from;
  transfer.transactionHash = tx;
  
  /*
  if (true || transfer.transactionHash.toHexString() == '0x560b87be91c9059a486567f03f237406f453880ac56078448f003ce9e3019ed3'
      || transfer.transactionHash.toHexString() == '0x560b87be91c9059a486567f03f237406f453880ac56078448f003ce9e3019ed3'
      || transfer.to.toLowerCase() == '0x516fc698fb46506aa983a14f40b30c908d86dc82'
      || transfer.from.toLowerCase() == '0x516fc698fb46506aa983a14f40b30c908d86dc82') {
        log.warning('maybe wrap from {} type {} to {} hash {} test1 {} test2 {}', [
          from, eventType, to, transfer.transactionHash.toHexString(), 
          (from == ZERO_ADDRESS).toString(), 
          (from == TARGET_TOKEN.toHexString()).toString()
        ])
  }
  */

  transfer.tokenId = tokenId.toString();
  transfer.save();

  punkTransferTokenId = tokenId.toString();

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
  evnt.platform = NATIVE_PLATFORM;
  evnt.type = eventType;
  evnt.tokenId = tokenId;
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

export function prepareThirdPartySale(hash: Bytes, from: Bytes, to: Bytes, timestamp:BigInt, transferredTokenId:BigInt):void {
  
  const id = hash.toHexString()
  
  let ctx = TransactionExecutionContext.load(id)
  
  if (!ctx) {
    // Cas 1: Transfer arrive avant OrderFulfilled
    log.info(
      "Transfer arrived BEFORE OrderFulfilled - Creating new context - TxHash: {}, TokenId: {}, From: {}, To: {}",
      [
        id,
        transferredTokenId.toString(),
        from.toHexString(),
        to.toHexString()
      ]
    );
    
    ctx = new TransactionExecutionContext(id)
    ctx.tokenIds = []

    ctx.collection = TARGET_TOKEN;
    ctx.paymentAmount = null;
    ctx.paymentToken = Bytes.fromHexString("0x0000000000000000000000000000000000000000")!;
    ctx.isBid = false;
    ctx.from = from;
    ctx.to = to;
    ctx.timestamp = timestamp;
    ctx.eventIds = [];
    ctx.save();
  } else {
    // Cas 2: Transfer arrive après OrderFulfilled
    log.info(
      "Transfer arrived AFTER OrderFulfilled - Updating context - TxHash: {}, TokenId: {}, From: {}, To: {}, ctx.eventIds: {}",
      [
        id,
        transferredTokenId.toString(),
        from.toHexString(),
        to.toHexString(),
        ctx.eventIds.length.toString()
      ]
    );
    
    // Si un Event ou Bundle a déjà été créé (eventId est présent dans le contexte),
    // on le met à jour avec les adresses du Transfer
    if (ctx.eventIds.length > 0) {
      for (let i=0; i<ctx.eventIds.length; i++) {
        const eventId = ctx.eventIds[i]
        log.info(
          "Updating existing entity with Transfer addresses - tx: {} EntityId: {}, From: {}, To: {}",
          [
            id,
            eventId,
            from.toHexString(),
            to.toHexString()
          ]
        );
        
        // Première vérification: est-ce un Event?
        let evnt = Event.load(eventId);
        if (evnt) {
          // Mise à jour des adresses avec celles du Transfer
          evnt.fromAccount = from.toHexString();
          evnt.toAccount = to.toHexString();
          evnt.save();
          
          log.info("Event successfully updated with Transfer addresses", []);
        } else {
          // Si ce n'est pas un Event, c'est peut-être un Bundle
          let bundle = Bundle.load(eventId);
          if (bundle) {
            // Mise à jour des adresses du Bundle avec celles du Transfer
            bundle.offerer = from;
            bundle.buyer = to;
            bundle.save();
            
            log.info("Bundle successfully updated with Transfer addresses", []);
          } else {
            log.error("Failed to load entity with id: {}", [eventId]);
          }
        }
      }
    }
  }

  // IMPORTANT: Les adresses du Transfer ERC-721 sont TOUJOURS prioritaires
  // Elles remplacent celles définies dans OrderFulfilled, même si celui-ci 
  // a déjà été traité et a créé un contexte
  ctx.from = from;
  ctx.to = to;

  // Éviter les doublons dans la liste des tokenIds
  const tokenId = transferredTokenId;
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

let punkBoughtTokenId: string;
/**
 * Handles the PunkBought event.
 * @param event - The PunkBoughtEvent object.
 */
export function handlePunkBought(event: PunkBoughtEvent): void {
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }

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
  evnt.platform = NATIVE_PLATFORM;
  evnt.tokenId = event.params.punkIndex;
  evnt.fromAccount = fromAccount.id;
  evnt.isBid = bid !== null
  evnt.toAccount = toAccount.id;
  value = isWash ? BIGINT_ZERO : value;
  evnt.value = value;
  evnt.usd = USDValue(event.block.timestamp, event.block.number);
  evnt.blockNumber = event.block.number;
  evnt.blockTimestamp = event.block.timestamp;
  evnt.transactionHash = event.transaction.hash;
  evnt.save();
  updateSaleState(evnt)
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
  evnt.platform = NATIVE_PLATFORM;
  evnt.type = 'Offered';
  evnt.tokenId = event.params.punkIndex;

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
export function handlePunkBidEntered(event: PunkBidEntered): void {
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
  evnt.platform = NATIVE_PLATFORM;
  evnt.type = 'BidEntered';
  evnt.tokenId = event.params.punkIndex;

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
  if (ONLY_ON_TX != "" && event.transaction.hash.toHex() != ONLY_ON_TX) {
    return
  }
  
  punkBidWithdrawnTokenId = event.params.punkIndex.toString();

  let fromAccount = getOrCreateAccount(event.params.fromAddress.toHexString());

  // Active Bids
  let bid = Bid.load(punkBidWithdrawnTokenId);
  if (bid) store.remove('Bid', punkBidWithdrawnTokenId);

  // Events
  let evntId = getGlobalId(event);
  let evnt = new Event(evntId);
  evnt.platform = NATIVE_PLATFORM;
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
    evnt.platform = NATIVE_PLATFORM;
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


