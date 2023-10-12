import * as hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
    PowerPool__factory,
    PowerPool,
    RandomNumberGenerator__factory,
    RandomNumberGenerator,
    TestTicket__factory,
    TestTicket,
    TestCoordinator__factory,
    TestCoordinator,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const INTERVAL_SECONDS = 60 * 60 * 24; // 1 day
const BUFFER_SECONDS = 60 * 10; // 10 minutes
const POOL_SIZE = 10;
const TREASURY_FEE = 3000; // 10%

describe("Greater", () => {
    let owner: SignerWithAddress;
    let operator: SignerWithAddress;
    let user_1: SignerWithAddress;
    let user_2: SignerWithAddress;

    let powerPool: PowerPool;
    let randomNumber: RandomNumberGenerator;
    let ticket: TestTicket;
    let coordinator: TestCoordinator;

    beforeEach(async () => {
        const accounts: SignerWithAddress[] = await ethers.getSigners();
        owner = accounts[0];
        operator = accounts[1];
        user_1 = accounts[2];
        user_2 = accounts[3];

        const TestCoordinator: TestCoordinator__factory =
            await ethers.getContractFactory("TestCoordinator");

        coordinator = await TestCoordinator.deploy();

        const RandomNumberGenerator: RandomNumberGenerator__factory =
            await ethers.getContractFactory("RandomNumberGenerator");
        randomNumber = await RandomNumberGenerator.deploy(
            await coordinator.getAddress(),
            3187,
            "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314",
        );

        const TestTicket: TestTicket__factory = await ethers.getContractFactory(
            "TestTicket",
        );
        ticket = await TestTicket.deploy();

        await ticket.connect(user_1).mintMany(20);
        await ticket.connect(user_2).mintMany(20);

        const PowerPool: PowerPool__factory = await ethers.getContractFactory(
            "PowerPool",
        );
        powerPool = await PowerPool.deploy(
            await ticket.getAddress(),
            await randomNumber.getAddress(),
            owner.address,
            operator.address,
            INTERVAL_SECONDS,
            BUFFER_SECONDS,
            POOL_SIZE,
            TREASURY_FEE,
        );

        await randomNumber.setPowerPoolAddress(await powerPool.getAddress());

        await ticket
            .connect(user_1)
            .setApprovalForAll(await powerPool.getAddress(), true);
        await ticket
            .connect(user_2)
            .setApprovalForAll(await powerPool.getAddress(), true);

        hre.tracer.nameTags[await powerPool.getAddress()] = "PowerPool";
        hre.tracer.nameTags[await randomNumber.getAddress()] =
            "RandomNumberGenerator";
        hre.tracer.nameTags[await ticket.getAddress()] = "Ticket";
    });

    describe("Deployment", () => {
        it("Should deploy successfully", async () => {
            expect(await powerPool.ticket()).to.equal(
                await ticket.getAddress(),
            );
            expect(await powerPool.randomNumberGenerator()).to.equal(
                await randomNumber.getAddress(),
            );
            expect(await powerPool.owner()).to.equal(owner.address);
            expect(await powerPool.adminAddress()).to.equal(owner.address);
            expect(await powerPool.operatorAddress()).to.equal(
                operator.address,
            );
            expect(await powerPool.intervalSeconds()).to.equal(
                INTERVAL_SECONDS,
            );
            expect(await powerPool.bufferSeconds()).to.equal(BUFFER_SECONDS);
            expect(await powerPool.poolSize()).to.equal(POOL_SIZE);
            expect(await powerPool.treasuryFee()).to.equal(TREASURY_FEE);
        });
    });

    describe("Genesis start", () => {
        it("Should not start genesis if not operator", async () => {
            await expect(
                powerPool.connect(user_1).genesisStartRound(),
            ).to.be.revertedWith("Not operator");
        });

        it("Should not play when genesis not started", async () => {
            await expect(
                powerPool.connect(user_1).play(0, [1]),
            ).to.be.revertedWith("Round not playable");
        });

        it("Should genesis start successfully", async () => {
            await expect(
                powerPool.connect(operator).genesisStartRound(),
            ).to.emit(powerPool, "StartRound");
            let timestamp = await time.latest();
            expect(await powerPool.genesisStartOnce()).to.equal(true);
            let epoch = await powerPool.currentEpoch();

            let round = await powerPool.rounds(epoch);
            expect(round.startTimestamp).to.equal(timestamp);
            expect(round.endTimestamp).to.equal(timestamp + INTERVAL_SECONDS);
            expect(round.oracleState).to.equal(0);
            expect(round.totalTicket).to.equal(0);
        });
    });

    describe("Play", () => {
        beforeEach(async () => {
            await powerPool.connect(operator).genesisStartRound();
        });

        it("Should able to play after genesis started", async () => {
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");

            let round = await powerPool.rounds(epoch);
            expect(round.totalTicket).to.equal(5);
            let tokenIds = await powerPool.getTokenIds(epoch);
            expect(tokenIds.length).to.equal(5);
            expect(tokenIds[0]).to.equal(1);
            expect(tokenIds[1]).to.equal(2);
            expect(tokenIds[2]).to.equal(3);
            expect(tokenIds[3]).to.equal(4);
            expect(tokenIds[4]).to.equal(5);

            expect(await powerPool.ledger(epoch, 0)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 1)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 2)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 3)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 4)).to.equal(user_1.address);

            let userTokenIds = await powerPool.getUserTokenIds(
                epoch,
                user_1.address,
            );
            expect(userTokenIds.length).to.equal(5);
            expect(userTokenIds[0]).to.equal(1);
            expect(userTokenIds[1]).to.equal(2);
            expect(userTokenIds[2]).to.equal(3);
            expect(userTokenIds[3]).to.equal(4);
            expect(userTokenIds[4]).to.equal(5);

            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23, 24, 25]),
            ).to.emit(powerPool, "Play");

            round = await powerPool.rounds(epoch);
            expect(round.totalTicket).to.equal(10);
            tokenIds = await powerPool.getTokenIds(epoch);
            expect(tokenIds.length).to.equal(10);
            expect(tokenIds[5]).to.equal(21);
            expect(tokenIds[6]).to.equal(22);
            expect(tokenIds[7]).to.equal(23);
            expect(tokenIds[8]).to.equal(24);
            expect(tokenIds[9]).to.equal(25);

            expect(await powerPool.ledger(epoch, 5)).to.equal(user_2.address);
            expect(await powerPool.ledger(epoch, 6)).to.equal(user_2.address);
            expect(await powerPool.ledger(epoch, 7)).to.equal(user_2.address);
            expect(await powerPool.ledger(epoch, 8)).to.equal(user_2.address);
            expect(await powerPool.ledger(epoch, 9)).to.equal(user_2.address);

            userTokenIds = await powerPool.getUserTokenIds(
                epoch,
                user_2.address,
            );
            expect(userTokenIds.length).to.equal(5);
            expect(userTokenIds[0]).to.equal(21);
            expect(userTokenIds[1]).to.equal(22);
            expect(userTokenIds[2]).to.equal(23);
            expect(userTokenIds[3]).to.equal(24);
            expect(userTokenIds[4]).to.equal(25);

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");
            let timestamp = await time.latest();

            await expect(
                powerPool.connect(operator).calculateReward(epoch),
            ).to.revertedWith("Request not fulfilled");
            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [13],
            );

            expect(await powerPool.claimable(epoch, user_1.address)).to.be.true;

            expect(await powerPool.claimable(epoch, user_2.address)).to.be
                .false;

            await powerPool.connect(operator).calculateReward(epoch);

            round = await powerPool.rounds(epoch);
            expect(round.oracleState).to.equal(2);
            expect(round.winningTiket).to.equal(3);
            expect(round.totalTicket).to.equal(10);
            expect(round.rewardAmount).to.equal(7);
            expect(round.treasuryAmount).to.equal(3);
            expect(round.rewardClaimed).to.be.false;
            expect(round.treasuryClaimed).to.be.false;
            expect(round.endTimestamp).to.equal(timestamp);

            await powerPool.connect(user_1).claim([epoch]);
            expect(await ticket.ownerOf(1)).to.equal(user_1.address);
            expect(await ticket.ownerOf(2)).to.equal(user_1.address);
            expect(await ticket.ownerOf(3)).to.equal(user_1.address);
            expect(await ticket.ownerOf(4)).to.equal(user_1.address);
            expect(await ticket.ownerOf(5)).to.equal(user_1.address);
            expect(await ticket.ownerOf(21)).to.equal(user_1.address);
            expect(await ticket.ownerOf(22)).to.equal(user_1.address);

            await expect(
                powerPool.connect(user_2).claim([epoch]),
            ).to.be.rejectedWith("Not eligible for claim");

            await powerPool.connect(owner).claimTreasury([epoch]);
            expect(await ticket.ownerOf(23)).to.equal(owner.address);
            expect(await ticket.ownerOf(24)).to.equal(owner.address);
            expect(await ticket.ownerOf(25)).to.equal(owner.address);
        });
    });

    describe("Round not full", () => {
        beforeEach(async () => {
            await powerPool.connect(operator).genesisStartRound();
            await time.increase(INTERVAL_SECONDS);
            await powerPool.connect(operator).executeRound();

            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23]),
            ).to.emit(powerPool, "Play");
        });

        it("Should not able to execute round if round not full", async () => {
            await expect(
                powerPool.connect(operator).executeRound(),
            ).to.be.revertedWith(
                "Can only end round after endTimestamp or round full",
            );
        });

        it("Should able to play after endTimeStamp", async () => {
            let epoch = await powerPool.currentEpoch();
            await time.increase(INTERVAL_SECONDS);
            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [3],
            );

            expect(await powerPool.claimable(epoch, user_1.address)).to.be.true;

            expect(await powerPool.claimable(epoch, user_2.address)).to.be
                .false;

            await powerPool.connect(user_1).claim([epoch]);
            expect(await ticket.ownerOf(1)).to.equal(user_1.address);
            expect(await ticket.ownerOf(2)).to.equal(user_1.address);
            expect(await ticket.ownerOf(3)).to.equal(user_1.address);
            expect(await ticket.ownerOf(4)).to.equal(user_1.address);
            expect(await ticket.ownerOf(5)).to.equal(user_1.address);
            expect(await ticket.ownerOf(21)).to.equal(user_1.address);

            await powerPool.connect(owner).claimTreasury([epoch]);
            expect(await ticket.ownerOf(22)).to.equal(owner.address);
            expect(await ticket.ownerOf(23)).to.equal(owner.address);
        });
    });

    describe("Play multiple rounds", () => {
        beforeEach(async () => {
            await powerPool.connect(operator).genesisStartRound();
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");
            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23, 24, 25]),
            ).to.emit(powerPool, "Play");

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [13],
            );
        });

        it("Should able to play again in single round", async () => {
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [6, 7, 8]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_2).play(epoch, [26, 27, 28, 29, 30]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_1).play(epoch, [9, 10]),
            ).to.emit(powerPool, "Play");

            let round = await powerPool.rounds(epoch);
            expect(round.totalTicket).to.equal(10);

            expect(await powerPool.ledger(epoch, 0)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 1)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 2)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 8)).to.equal(user_1.address);
            expect(await powerPool.ledger(epoch, 9)).to.equal(user_1.address);

            let userTokenIds = await powerPool.getUserTokenIds(
                epoch,
                user_1.address,
            );
            expect(userTokenIds.length).to.equal(5);
            expect(userTokenIds[0]).to.equal(6);
            expect(userTokenIds[1]).to.equal(7);
            expect(userTokenIds[2]).to.equal(8);
            expect(userTokenIds[3]).to.equal(9);
            expect(userTokenIds[4]).to.equal(10);

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [10],
            );

            expect(await powerPool.claimable(epoch, user_1.address)).to.be.true;

            await expect(
                powerPool.connect(user_2).claim([epoch]),
            ).to.be.revertedWith("Not eligible for claim");
            await expect(
                powerPool.connect(user_2).claim([epoch - 1n]),
            ).to.be.revertedWith("Not eligible for claim");
            await powerPool.connect(user_1).claim([epoch, epoch - 1n]);

            expect(await ticket.ownerOf(1)).to.equal(user_1.address);
            expect(await ticket.ownerOf(2)).to.equal(user_1.address);
            expect(await ticket.ownerOf(3)).to.equal(user_1.address);
            expect(await ticket.ownerOf(4)).to.equal(user_1.address);
            expect(await ticket.ownerOf(5)).to.equal(user_1.address);
            expect(await ticket.ownerOf(21)).to.equal(user_1.address);
            expect(await ticket.ownerOf(22)).to.equal(user_1.address);

            expect(await ticket.ownerOf(6)).to.equal(user_1.address);
            expect(await ticket.ownerOf(7)).to.equal(user_1.address);
            expect(await ticket.ownerOf(8)).to.equal(user_1.address);
            expect(await ticket.ownerOf(26)).to.equal(user_1.address);
            expect(await ticket.ownerOf(27)).to.equal(user_1.address);
            expect(await ticket.ownerOf(28)).to.equal(user_1.address);
            expect(await ticket.ownerOf(29)).to.equal(user_1.address);

            await powerPool.connect(owner).claimTreasury([epoch, epoch - 1n]);
            expect(await ticket.ownerOf(23)).to.equal(owner.address);
            expect(await ticket.ownerOf(24)).to.equal(owner.address);
            expect(await ticket.ownerOf(25)).to.equal(owner.address);

            expect(await ticket.ownerOf(9)).to.equal(owner.address);
            expect(await ticket.ownerOf(10)).to.equal(owner.address);
            expect(await ticket.ownerOf(30)).to.equal(owner.address);
        });
    });

    describe("Round not able to play", () => {
        it("Play too early", async () => {
            await powerPool.connect(operator).genesisStartRound();
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch + 1n, [1, 2, 3, 4, 5]),
            ).to.revertedWith("Play too early/late");
        });

        it("Play too late", async () => {
            await powerPool.connect(operator).genesisStartRound();
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");
            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23, 24, 25]),
            ).to.emit(powerPool, "Play");

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await expect(
                powerPool.connect(user_1).play(epoch, [6]),
            ).to.revertedWith("Play too early/late");
        });

        it("Round not playable", async () => {
            await powerPool.connect(operator).genesisStartRound();
            let epoch = await powerPool.currentEpoch();

            time.increase(INTERVAL_SECONDS);

            await expect(
                powerPool.connect(user_1).play(epoch, [6]),
            ).to.revertedWith("Round not playable");
        });

        it("Round full", async () => {
            await powerPool.connect(operator).genesisStartRound();
            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");
            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23, 24, 25]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_1).play(epoch, [6]),
            ).to.revertedWith("Round full");
        });
    });

    describe("ReGenesis start", () => {
        beforeEach(async () => {
            await powerPool.connect(operator).genesisStartRound();
            await time.increase(INTERVAL_SECONDS);
            await powerPool.connect(operator).executeRound();

            let epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [1, 2, 3, 4, 5]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_2).play(epoch, [21, 22, 23, 24, 25]),
            ).to.emit(powerPool, "Play");

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [13],
            );
            epoch = await powerPool.currentEpoch();
            await expect(
                powerPool.connect(user_1).play(epoch, [6, 7, 8, 9, 10]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_2).play(epoch, [26, 27, 28, 29, 30]),
            ).to.emit(powerPool, "Play");

            time.increase(INTERVAL_SECONDS + BUFFER_SECONDS + 1);
        });

        it("Should not able to executeRound but able to claim old round", async () => {
            await expect(
                powerPool.connect(operator).executeRound(),
            ).to.be.revertedWith("Can only end round within bufferSeconds");

            await expect(powerPool.connect(user_1).claim([2n])).to.emit(
                powerPool,
                "Claim",
            );
        });

        it("Should able to refund", async () => {
            await expect(powerPool.connect(user_1).claim([2n, 3n])).to.emit(
                powerPool,
                "Claim",
            );

            expect(await ticket.ownerOf(6)).to.equal(user_1.address);
            expect(await ticket.ownerOf(7)).to.equal(user_1.address);
            expect(await ticket.ownerOf(8)).to.equal(user_1.address);
            expect(await ticket.ownerOf(9)).to.equal(user_1.address);
            expect(await ticket.ownerOf(10)).to.equal(user_1.address);

            await expect(powerPool.connect(user_2).claim([3n])).to.emit(
                powerPool,
                "Claim",
            );
        });

        it("ReGenesis start", async () => {
            await expect(powerPool.connect(operator).pause()).to.emit(
                powerPool,
                "Pause",
            );

            await expect(powerPool.connect(operator).unpause()).to.emit(
                powerPool,
                "Unpause",
            );

            expect(await powerPool.genesisStartOnce()).to.be.false;

            await powerPool.connect(operator).genesisStartRound();
            expect(await powerPool.genesisStartOnce()).to.be.true;
            let epoch = await powerPool.currentEpoch();
            expect(epoch).to.equal(4n);

            await expect(powerPool.connect(user_1).claim([2n, 3n])).to.emit(
                powerPool,
                "Claim",
            );

            await expect(powerPool.connect(user_2).claim([3n])).to.emit(
                powerPool,
                "Claim",
            );

            await expect(
                powerPool.connect(user_1).play(epoch, [6, 7, 8, 9, 10]),
            ).to.emit(powerPool, "Play");

            await expect(
                powerPool.connect(user_2).play(epoch, [26, 27, 28, 29, 30]),
            ).to.emit(powerPool, "Play");

            await expect(powerPool.connect(operator).executeRound())
                .to.emit(powerPool, "EndRound")
                .to.emit(powerPool, "StartRound");

            await coordinator.fullfillRandomWords(
                await randomNumber.getAddress(),
                (
                    await powerPool.rounds(epoch)
                ).requestId,
                [10],
            );

            await expect(powerPool.connect(user_1).claim([4n])).to.emit(
                powerPool,
                "Claim",
            );
        });
    });

    describe("Set params", () => {
        it("Set admin", async () => {
            await expect(
                powerPool.connect(user_1).setAdmin(user_1.address),
            ).to.revertedWith("Ownable: caller is not the owner");
            await expect(powerPool.connect(owner).setAdmin(user_1.address))
                .to.emit(powerPool, "NewAdminAddress")
                .withArgs(user_1.address);

            expect(await powerPool.adminAddress()).to.equal(user_1.address);
        });

        it("Set operator", async () => {
            await expect(
                powerPool.connect(user_1).setOperator(user_1.address),
            ).to.revertedWith("Not admin");
            await expect(powerPool.connect(owner).setOperator(user_1.address))
                .to.emit(powerPool, "NewOperatorAddress")
                .withArgs(user_1.address);

            expect(await powerPool.operatorAddress()).to.equal(user_1.address);
        });

        it("Set buffer and interval", async () => {
            await expect(
                powerPool.connect(owner).setBufferAndIntervalSeconds(1, 10),
            ).to.revertedWith("Pausable: not paused");

            await powerPool.connect(operator).pause();

            await expect(
                powerPool.connect(user_1).setBufferAndIntervalSeconds(1, 10),
            ).to.revertedWith("Not admin");
            await expect(
                powerPool.connect(owner).setBufferAndIntervalSeconds(1, 1),
            ).to.revertedWith(
                "bufferSeconds must be inferior to intervalSeconds",
            );
            await expect(
                powerPool.connect(owner).setBufferAndIntervalSeconds(1, 10),
            )
                .to.emit(powerPool, "NewBufferAndIntervalSeconds")
                .withArgs(1, 1);

            expect(await powerPool.bufferSeconds()).to.equal(1);
            expect(await powerPool.intervalSeconds()).to.equal(10);
        });

        it("Set pool size", async () => {
            await expect(
                powerPool.connect(user_1).setPoolSize(1),
            ).to.revertedWith("Pausable: not paused");

            await powerPool.connect(operator).pause();
            await expect(
                powerPool.connect(user_1).setPoolSize(1),
            ).to.revertedWith("Not admin");

            await expect(
                powerPool.connect(owner).setPoolSize(0),
            ).to.revertedWith("Must be superior to 0");
            await expect(powerPool.connect(owner).setPoolSize(1)).to.emit(
                powerPool,
                "NewPoolSize",
            );

            expect(await powerPool.poolSize()).to.equal(1);
        });

        it("Set treasury fee", async () => {
            await expect(
                powerPool.connect(owner).setTreasuryFee(1),
            ).to.revertedWith("Pausable: not paused");

            await powerPool.connect(operator).pause();

            await expect(
                powerPool.connect(user_1).setTreasuryFee(1),
            ).to.revertedWith("Not admin");

            await expect(
                powerPool.connect(owner).setTreasuryFee(30001),
            ).to.revertedWith("Treasury fee too high");
            await expect(powerPool.connect(owner).setTreasuryFee(1)).to.emit(
                powerPool,
                "NewTreasuryFee",
            );

            expect(await powerPool.treasuryFee()).to.equal(1);
        });

        it("Set random number generator", async () => {
            await expect(
                powerPool
                    .connect(owner)
                    .setRandomNumberGenerator(owner.address),
            ).to.revertedWith("Pausable: not paused");

            await powerPool.connect(operator).pause();

            await expect(
                powerPool
                    .connect(user_1)
                    .setRandomNumberGenerator(owner.address),
            ).to.revertedWith("Not admin");

            await expect(
                powerPool
                    .connect(owner)
                    .setRandomNumberGenerator(owner.address),
            ).to.reverted;

            const RandomNumberGenerator: RandomNumberGenerator__factory =
                await ethers.getContractFactory("RandomNumberGenerator");
            let newRandomNumber = await RandomNumberGenerator.deploy(
                await coordinator.getAddress(),
                3187,
                "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314",
            );

            await newRandomNumber.setPowerPoolAddress(
                await powerPool.getAddress(),
            );

            await expect(
                powerPool
                    .connect(owner)
                    .setRandomNumberGenerator(
                        await newRandomNumber.getAddress(),
                    ),
            )
                .to.emit(powerPool, "NewRandomNumberGenerator")
                .withArgs(await newRandomNumber.getAddress());
        });
    });
});
