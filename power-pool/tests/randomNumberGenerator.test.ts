import * as hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
    RandomNumberGenerator__factory,
    RandomNumberGenerator,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Greater", () => {
    let user: SignerWithAddress;
    let randomNumber: RandomNumberGenerator;

    beforeEach(async () => {
        const accounts: SignerWithAddress[] = await ethers.getSigners();
        user = accounts[0];

        const RandomNumberGenerator: RandomNumberGenerator__factory =
            await ethers.getContractFactory("RandomNumberGenerator");
        randomNumber = await RandomNumberGenerator.deploy(
            "0x6a2aad07396b36fe02a22b33cf443582f682c82f",
            3187,
            "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314",
        );
        await randomNumber.waitForDeployment();
        console.log(
            "RandomNumberGenerator deployed to:",
            await randomNumber.getAddress(),
        );
        hre.tracer.nameTags[await randomNumber.getAddress()] =
            "RandomNumberGenerator";
    });

    describe("Deployment", () => {
        it("Should deploy successfully", async () => {
            expect(await randomNumber.s_subscriptionId()).to.equal(3187);
        });
    });
});
