import { assert, test } from "matchstick-as";


import { Bytes, Address, BigInt, ethereum, Entity } from "@graphprotocol/graph-ts";
import { createOrderFulfilledEvent } from "./utils";
import { handleOrderFulfilled } from "../src/seaport";


declare namespace store {
  function get(entityType: string, id: string): Entity | null;
  function keys(entityType: string): Array<string>;
}

test("handleOrderFulfilled traite l'événement correctement", () => {
  
  const orderHash = Bytes.fromHexString("0xe38889b6d8d29ff0170a3d08723a12f68a027ed45fbfc6595dc195cac6c80a71");
  const offerer = Address.fromString("0xA739899b9C4a445C83f0Be152f4F84795c3Bee43");
  const zone = Address.fromString("0x000056F7000000EcE9003ca63978907a00FFD100");
  const recipient = Address.fromString("0xDd91ecd9d883878E719025d15126Cac505Aa99FA");

  const offerTuple = new ethereum.Tuple();
  offerTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))); // itemType
  offerTuple.push(ethereum.Value.fromAddress(Address.fromString("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"))); // token
  offerTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))); // identifier
  offerTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("66000000000000000"))); // amount

  const considerationTuple1 = new ethereum.Tuple();
  considerationTuple1.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2)));
  considerationTuple1.push(ethereum.Value.fromAddress(Address.fromString("0xf07468eAd8cf26c752C676E43C814FEe9c8CF402")));
  considerationTuple1.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2470)));
  considerationTuple1.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)));
  considerationTuple1.push(ethereum.Value.fromAddress(Address.fromString("0xA739899b9C4a445C83f0Be152f4F84795c3Bee43")));

  const considerationTuple2 = new ethereum.Tuple();
  considerationTuple2.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1)));
  considerationTuple2.push(ethereum.Value.fromAddress(Address.fromString("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")));
  considerationTuple2.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)));
  considerationTuple2.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1650000000000000")));
  considerationTuple2.push(ethereum.Value.fromAddress(Address.fromString("0x0000a26b00c1F0DF003000390027140000fAa719")));

  const event = createOrderFulfilledEvent(
    orderHash,
    offerer,
    zone,
    recipient,
    [offerTuple],
    [considerationTuple1, considerationTuple2]
  );

  handleOrderFulfilled(event);
  //assert.fieldEquals("FakeEntity", "debug", "shouldFail", "yes");




});
