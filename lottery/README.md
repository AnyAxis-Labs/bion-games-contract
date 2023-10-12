# Important Parameters

## Random Number contract:

-   coordinator address: chainlink coordinator address to fulfill random number
-   subscriptionId: chainlink vrf subscriptionId
-   keyHash: chainlink vrf keyhash

## Lottery

-   injectorAddress: address to add token to lottery
-   operatorAddress: address to end and start a lottery
-   treasuryAddress: address to receive treasury

# Deploy process

Step 1: Create chainlink vrf subscription

-   Create chainlink vrf subscription at: https://vrf.chain.link/
-   Get all required param: coordinator address, subscriptionId, keyHash

Step 2: Deploy contracts

-   Update config at `config.ts`
-   Deploy random contracts
    -   Constructor params: coordinator address, subscription id, key hash
-   Deploy lottery
    -   Constructor params: token address
-   Set power pool address at random contract

run: `yarn hardhat run scripts/deploy_all.ts --network bsctestnet`

Step 3: Verify contracts

run: `yarn hardhat run scripts/verify.ts --network bsctestnet`
