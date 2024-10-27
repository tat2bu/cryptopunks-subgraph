/**
 * @file topics.ts
 * @description This file defines the Topic class and provides a list of Ethereum event topics
 * related to the CryptoPunks contract, along with utility functions for topic handling.
 */

/**
 * Represents an Ethereum event topic.
 */
export class Topic {
  name: string;
  topic: string;

  /**
   * Creates a new Topic instance.
   * @param name - The human-readable name of the topic.
   * @param topic - The hexadecimal string representation of the topic.
   */
  constructor(name: string, topic: string) {
    this.name = name;
    this.topic = topic;
  }
}

/**
 * An array of predefined Topic instances for CryptoPunks-related events.
 */
export let topics: Topic[] = [
  new Topic('Assign', '0x8a0e37b73a0d9c82e205d4d1a3ff3d0b57ce5f4d7bccf6bac03336dc101cb7ba'),
  new Topic('Transfer', '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'),
  new Topic('PunkTransfer', '0x05af636b70da6819000c49f85b21fa82081c632069bb626f30932034099107d8'),
  new Topic('PunkOffered', '0x3c7b682d5da98001a9b8cbda6c647d2c63d698a4184fd1d55e2ce7b66f5d21eb'),
  new Topic('PunkBidEntered', '0x5b859394fabae0c1ba88baffe67e751ab5248d2e879028b8c8d6897b0519f56a'),
  new Topic('PunkBidWithdrawn', '0x6f30e1ee4d81dcc7a8a478577f65d2ed2edb120565960ac45fe7c50551c87932'),
  new Topic('PunkBought', '0x58e5d5a525e3b40bc15abaa38b5882678db1ee68befd2f60bafe3a7fd06db9e3'),
  new Topic('PunkNoLongerForSale', '0xb0e0a660b4e50f26f0b7ce75c24655fc76cc66e3334a54ff410277229fa10bd4'),
];

let newTopic: string;

/**
 * Retrieves the name of a topic given its hexadecimal string representation.
 * @param topic - The hexadecimal string representation of the topic.
 * @returns The name of the topic if found, or an empty string if not found.
 */
export function getTopicName(topic: string): string {
  newTopic = topic.toLowerCase();
  let topicIndex = topics.findIndex((topicEntry) => topicEntry.topic.toLowerCase() == newTopic);
  if (topicIndex === -1) {
    return '';
  }
  return topics[topicIndex].name;
}