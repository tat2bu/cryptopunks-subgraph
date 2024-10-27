# CryptoPunks Subgraph

This subgraph indexes and tracks data from the CryptoPunks NFT collection on the Ethereum blockchain. It provides a comprehensive view of CryptoPunks transactions, ownership, bids, listings, and market statistics using The Graph Protocol.

## Overview

The CryptoPunks subgraph is built using The Graph, a decentralized protocol for indexing and querying blockchain data. This subgraph specifically tracks various events from the CryptoPunksMarket smart contract, creating and maintaining entities such as Punks, Accounts, Bids, Listings, Events, and State to provide a rich dataset for querying CryptoPunks-related information.

## Features

- Track Punk ownership and transfers
- Monitor bids and listings
- Record sales and price history
- Calculate floor prices and market statistics
- Convert ETH values to USD using Chainlink price feed
- Historical price data for early transactions

## The Graph Protocol

This subgraph is built on The Graph, an indexing protocol for querying networks like Ethereum. It allows for efficient, decentralized, and real-time data indexing from blockchain events and state changes. The Graph uses GraphQL as a query language, providing a powerful and flexible way to request exactly the data you need.

## Key Components

1. Schema (`schema.graphql`): Defines the data structure for the subgraph.
2. Subgraph Manifest (`subgraph.yaml`): Configuration file for the subgraph.
3. Mapping (`src/crypto-punks-market.ts`): Contains the event handling logic.
4. Helpers (`src/utils/`): Utility functions for various operations.

## Getting Started

1. Install dependencies:
   ```
   yarn install
   ```

2. Generate types:
   ```
   yarn codegen
   ```

3. Build the subgraph:
   ```
   yarn build
   ```

4. Deploy the subgraph:
   ```
   yarn deploy
   ```

## Key Features Explained

### Event Handling

The subgraph handles various events from the CryptoPunksMarket contract, including Assign, Transfer, PunkTransfer, PunkOffered, PunkBidEntered, PunkBidWithdrawn, PunkBought, and PunkNoLongerForSale.

These event handlers update the subgraph's state based on on-chain events, ensuring accurate and up-to-date data.

### Price Conversion

The subgraph uses two methods for ETH to USD conversion:

1. Chainlink Price Feed: For recent transactions, it queries the Chainlink ETH/USD price feed in real-time.
2. Historical Price Data: For older transactions (before the Chainlink feed was available), it uses a predefined set of historical price points.

### Floor Price Calculation

The subgraph calculates and updates the floor price based on active listings.

## Contributing

Contributions to improve the subgraph are welcome. Please submit issues and pull requests on the project's GitHub repository.

## License

This project is licensed under the Creative Commons CC0 1.0 Universal license. See the [LICENSE](LICENSE) file for details.