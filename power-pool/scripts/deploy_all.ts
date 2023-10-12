import * as hre from "hardhat";
import * as fs from "fs";
import { Signer } from "ethers";
const ethers = hre.ethers;
import { Config } from "./config";

import {
    RandomNumberGenerator__factory,
    RandomNumberGenerator,
    PowerPool__factory,
} from "../typechain-types";

async function main() {
    //Loading accounts
    const accounts: Signer[] = await ethers.getSigners();
    const admin = await accounts[0].getAddress();
    //Loading contracts' factory

    const RandomNumberGenerator: RandomNumberGenerator__factory =
        await ethers.getContractFactory("RandomNumberGenerator");

    // Deploy contracts
    console.log(
        "==================================================================",
    );
    console.log("DEPLOY CONTRACTS");
    console.log(
        "==================================================================",
    );

    console.log("ACCOUNT: " + admin);

    const randomNumber = await RandomNumberGenerator.deploy(
        Config.coordinator,
        Config.subscription_id,
        Config.key_hash
    );
    await randomNumber.waitForDeployment();

    const randomNumberAddress = await randomNumber.getAddress();

    console.log("RandomNumber deployed at: ", randomNumberAddress);

    const PowerPool: PowerPool__factory = await ethers.getContractFactory(
        "PowerPool",
    );
    const powerPool = await PowerPool.deploy(
        Config.ticket_address,
        await randomNumber.getAddress(),
        Config.admin_address,
        Config.operator_address,
        Config.interval_seconds,
        Config.buffer_seconds,
        Config.pool_size,
        Config.treasury_fee,
    );

    await powerPool.waitForDeployment();

    console.log("PowerPool deployed at: ", await powerPool.getAddress());

    await randomNumber.setPowerPoolAddress(await powerPool.getAddress());

    console.log("PowerPool address set");

    const contractAddress = {
        randomNumber: randomNumberAddress,
        powerPool: await powerPool.getAddress(),
    };

    fs.writeFileSync("contracts.json", JSON.stringify(contractAddress));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
