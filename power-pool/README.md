<img width="1170" alt="image" src="https://github.com/AnyAxis-Labs/bion-games-contract/assets/53716352/21961f2c-212a-4c6b-9caa-dab43aa2108d"># Important Parameters

## Random Number contract:

- coordinator address: chainlink coordinator address to fulfill random number
- subscriptionId: chainlink vrf subscriptionId
- keyHash: chainlink vrf keyhash

## PowerPool

- ticket address: nft address to use as ticket
- random number address
- operator: wallet has permission to start, end a round
- admin: wallet has permission to change powperpool’s param such has operator, treasury fee, random number address…
- owner: wallet has permission to change admin, set to address that deploy the contract at first
- interval seconds: time of each round
- buffer seconds: operator has to execute round between roundEndTime and roundEndTime + buffer seconds
- pool size
- treasury fee (in bps): percent of ticket to take as treasury fee (eg: 3000 as 30%)

# Deploy process

Step 1: Create chainlink vrf subscription

- Create chainlink vrf subscription at: https://vrf.chain.link/
- Get all required param: coordinator address, subscriptionId, keyHash

Step 2: Deploy contracts

- Update config at `config.ts`
- Deploy random contracts
    - Constructor params: coordinator address, subscription id, key hash
- Deploy power pool
    - Constructor params: ticket address, random number address, admin address, interval seconds, buffer seconds, pool size, treasury fee
- Set power pool address at random contract

run: `yarn hardhat run scripts/deploy_all.ts --network bsctestnet`

Step 3: Verify contracts

run: `yarn hardhat run scripts/verify.ts --network bsctestnet`

# Round process

## Start

<img width="1170" alt="image" src="https://github.com/AnyAxis-Labs/bion-games-contract/assets/53716352/27fee5ce-8c37-4578-b758-5d31e1192cf4">


First round: Genesis start round

Next rounds: execute round: can only call after interval time and between buffer time/after pool size has reached (depend on which condition comes first).

## Calculate reward

After execute round, random number generator request a random number from chainlink and return requestId.

After request has been fulfilled. Call calculate reward to get final winning ticket. (It automatically call when call claim).
