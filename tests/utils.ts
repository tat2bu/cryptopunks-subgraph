
import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { OrderFulfilled } from "../generated/Seaport/Seaport";

export function createOrderFulfilledEvent(
  orderHash: Bytes,
  offerer: Address,
  zone: Address,
  recipient: Address,
  offer: ethereum.Tuple[],
  consideration: ethereum.Tuple[]
): OrderFulfilled {
  const mockEvent = newMockEvent();

  const event = new OrderFulfilled(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    [],
    mockEvent.receipt
  );

  event.parameters = [
    new ethereum.EventParam("orderHash", ethereum.Value.fromFixedBytes(orderHash)),
    new ethereum.EventParam("offerer", ethereum.Value.fromAddress(offerer)),
    new ethereum.EventParam("zone", ethereum.Value.fromAddress(zone)),
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient)),
    new ethereum.EventParam("offer", ethereum.Value.fromTupleArray(offer)),
    new ethereum.EventParam("consideration", ethereum.Value.fromTupleArray(consideration))
  ];

  return event;
}