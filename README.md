# CryptoPunks Subgraph

This subgraph indexes and tracks CryptoPunks marketplace data for [cryptopunks.eth.limo](https://cryptopunks.eth.limo), a community-based marketplace. It provides real-time data about CryptoPunks sales, transfers, bids, and market activities on the Ethereum mainnet.

🔗 **[View this subgraph on The Graph Explorer](https://thegraph.com/explorer/subgraphs/CWCx5K9VPUCgvUCNnY2jX73VTuKy47kRdZ3VVbPKdSvj?view=Query&chain=arbitrum-one)**

## Features

- Track CryptoPunk ownership and transfers
- Monitor marketplace activities (listings, bids, sales)
- Track floor prices and market volume
- USD price conversion for transactions
- Historical event tracking
- Market statistics and analytics

## Schema

### Main Entities

- **Account**: Tracks punk ownership and user activities
- **Punk**: Individual CryptoPunk data and current state
- **Listing**: Active and historical punk listings
- **Bid**: Bid information and history
- **Event**: All marketplace events
- **State**: Global market statistics and state
- **Transfer**: Token transfer records

## Installation

1. Install dependencies:
```bash
yarn install
```

2. Generate types:
```bash
yarn codegen
```

3. Build the subgraph:
```bash
yarn build
```

## Deployment

### Local Deployment
```bash
# Create a local instance
yarn create-local

# Deploy to local node
yarn deploy-local
```

### Production Deployment
```bash
# Deploy to The Graph Studio
yarn deploy
```

## Example Queries

### Get Punk Details with Current Listing
```graphql
{
  punk(id: "1") {
    id
    owner {
      id
    }
    wrapped
    listing {
      value
      usd
    }
    bid {
      value
      fromAccount {
        id
      }
    }
  }
}
```

### Get Recent Sales
```graphql
{
  events(
    first: 10
    orderBy: blockTimestamp
    orderDirection: desc
    where: { type: "SALE" }
  ) {
    tokenId
    value
    usd
    fromAccount {
      id
    }
    toAccount {
      id
    }
    blockTimestamp
  }
}
```

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Add appropriate comments and documentation
- Test your changes thoroughly
- Update the schema documentation if you modify entities
- Keep the code modular and maintainable

## Technical Details

- **Network**: Ethereum Mainnet
- **Contract Address**: `0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb`
- **Start Block**: 3914495
- **Framework**: The Graph Protocol
- **Language**: AssemblyScript

## Dependencies

- @graphprotocol/graph-cli: ^0.87.0
- @graphprotocol/graph-ts: ^0.35.1
- matchstick-as: 0.5.0 (dev)

## License

This project is licensed under the UNLICENSED License - see the [LICENSE](LICENSE) file for details.

## Support

For questions, issues, or support:
- Open an issue in this repository
- Join [The Graph Protocol Discord](https://discord.com/invite/graphprotocol)
- Visit [The Graph Documentation](https://thegraph.com/docs/)