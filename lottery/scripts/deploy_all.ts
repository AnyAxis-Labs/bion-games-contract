import * as hre from "hardhat";
import * as fs from "fs";
import { Signer } from "ethers";
const ethers = hre.ethers;
import { Config } from "./config";

import {
    RandomNumberGenerator__factory,
    RandomNumberGenerator,
    LotteryGame__factory,
} from "../typechain-types";

async function main() {
    //Loading accounts
    const accounts: Signer[] = await ethers.getSigners();
    const admin = await accounts[0].getAddress();
    //Loading contracts' factory

    const RandomNumberGenerator: RandomNumberGenerator__factory =
        await ethers.getContractFactory("RandomNumberGenerator");

    const Lottery: LotteryGame__factory = await ethers.getContractFactory(
        "LotteryGame",
    );

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
        Config.key_hash,
    );
    await randomNumber.waitForDeployment();

    const randomNumberAddress = await randomNumber.getAddress();

    console.log("RandomNumber deployed at: ", randomNumberAddress);

    const lottery = await Lottery.deploy(
        Config.token_address,
        randomNumberAddress,
    );

    await lottery.waitForDeployment();

    console.log("Lottery deployed at: ", await lottery.getAddress());

    await randomNumber.setLotteryAddress(await lottery.getAddress());

    await lottery.setOperatorAndTreasuryAndInjectorAddresses(
        Config.operator_address,
        Config.treasury_address,
        Config.injector_address,
    );

    const contractAddress = {
        randomNumber: randomNumberAddress,
        lottery: await lottery.getAddress(),
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
