import { parseEther } from "ethers";

import { ethers } from "hardhat";
import { assert, expect } from "chai";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import {
    MockERC20,
    MockRandomNumberGenerator,
    LotteryGame,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const PRICE_BNB = 400;

function gasToBNB(gas: number, gwei: number = 5) {
    const num = gas * gwei * 10 ** -9;
    return num.toFixed(4);
}

function gasToUSD(gas: number, gwei: number = 5, priceBNB: number = PRICE_BNB) {
    const num = gas * priceBNB * gwei * 10 ** -9;
    return num.toFixed(2);
}

describe("Lottery V2", () => {
    // VARIABLES
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let david: SignerWithAddress;
    let erin: SignerWithAddress;
    let operator: SignerWithAddress;
    let treasury: SignerWithAddress;
    let injector: SignerWithAddress;
    const _totalInitSupply = parseEther("10000");

    let _lengthLottery = 14400n; // 4h
    let _priceTicketInToken = parseEther("0.5");
    let _discountDivisor = 2000n;

    let _rewardsBreakdown = ["200", "300", "500", "1500", "2500", "5000"];
    let _treasuryFee = 2000n;

    // Contracts
    let lottery: LotteryGame;
    let mockToken: MockERC20;
    let randomNumberGenerator: MockRandomNumberGenerator;

    // Generic variables
    let result: any;
    let endTime: any;

    before(async () => {
        [alice, bob, carol, david, erin, operator, treasury, injector] =
            await ethers.getSigners();
        let LotteryGame = await ethers.getContractFactory("LotteryGame");
        let MockERC20 = await ethers.getContractFactory("MockERC20");
        let RandomNumberGenerator = await ethers.getContractFactory(
            "MockRandomNumberGenerator",
        );
        // Deploy MockToken
        mockToken = await MockERC20.deploy(
            "Mock Token",
            "Token",
            _totalInitSupply,
        );

        // Deploy MockRandomNumberGenerator
        randomNumberGenerator = await RandomNumberGenerator.connect(
            alice,
        ).deploy();

        // Deploy Lottery
        lottery = await LotteryGame.connect(alice).deploy(
            await mockToken.getAddress(),
            await randomNumberGenerator.getAddress(),
        );

        await randomNumberGenerator
            .connect(alice)
            .setLotteryAddress(await lottery.getAddress());
    });

    describe("LOTTERY #1 - CUSTOM RANDOMNESS", async () => {
        it("Admin sets up treasury/operator address", async () => {
            await expect(
                lottery
                    .connect(alice)
                    .setOperatorAndTreasuryAndInjectorAddresses(
                        operator,
                        treasury,
                        injector,
                    ),
            )
                .to.emit(lottery, "NewOperatorAndTreasuryAndInjectorAddresses")
                .withArgs(operator.address, treasury.address, injector.address);
        });

        it("Users mint and approve Token to be used in the lottery", async () => {
            for (let thisUser of [alice, bob, carol, david, erin, injector]) {
                await mockToken
                    .connect(thisUser)
                    .mintTokens(parseEther("100000"));
                await mockToken
                    .connect(thisUser)
                    .approve(await lottery.getAddress(), parseEther("100000"));
            }
        });

        it("Operator starts lottery", async () => {
            endTime = BigInt(await time.latest()) + _lengthLottery;

            result = await expect(
                lottery
                    .connect(operator)
                    .startLottery(
                        endTime,
                        _priceTicketInToken,
                        _discountDivisor,
                        _rewardsBreakdown,
                        _treasuryFee,
                    ),
            ).to.emit(lottery, "LotteryOpen");
        });

        it("Bob buys 100 tickets", async () => {
            const _ticketsBought = [
                "1234561",
                "1234562",
                "1234563",
                "1234564",
                "1234565",
                "1234566",
                "1234567",
                "1234568",
                "1234569",
                "1234570",
                "1334571",
                "1334572",
                "1334573",
                "1334574",
                "1334575",
                "1334576",
                "1334577",
                "1334578",
                "1334579",
                "1334580",
                "1434581",
                "1434582",
                "1434583",
                "1434584",
                "1434585",
                "1434586",
                "1434587",
                "1434588",
                "1434589",
                "1534590",
                "1534591",
                "1534592",
                "1534593",
                "1534594",
                "1534595",
                "1534596",
                "1534597",
                "1534598",
                "1534599",
                "1634600",
                "1634601",
                "1634602",
                "1634603",
                "1634604",
                "1634605",
                "1634606",
                "1634607",
                "1634608",
                "1634609",
                "1634610",
                "1634611",
                "1634612",
                "1634613",
                "1634614",
                "1634615",
                "1634616",
                "1634617",
                "1634618",
                "1634619",
                "1634620",
                "1634621",
                "1634622",
                "1634623",
                "1634624",
                "1634625",
                "1634626",
                "1634627",
                "1634628",
                "1634629",
                "1634630",
                "1634631",
                "1634632",
                "1634633",
                "1634634",
                "1634635",
                "1634636",
                "1634637",
                "1634638",
                "1634639",
                "1634640",
                "1634641",
                "1634642",
                "1634643",
                "1634644",
                "1634645",
                "1634646",
                "1634647",
                "1634648",
                "1634649",
                "1634650",
                "1634651",
                "1634652",
                "1634653",
                "1634654",
                "1634655",
                "1634656",
                "1634657",
                "1634658",
                "1634659",
                "1634660",
            ];

            result = await expect(
                lottery.connect(bob).buyTickets("1", _ticketsBought),
            ).to.emit(lottery, "TicketsPurchase");

            result = await lottery.viewLottery("1");
            assert.equal(
                result[11].toString(),
                parseEther("47.525").toString(),
            );

            result = await lottery.viewUserInfoForLotteryId(bob, "1", 0, 100);
            const bobTicketIds: any = [];

            result[0].forEach(function (value: any) {
                bobTicketIds.push(value.toString());
            });

            const expectedTicketIds = Array.from({ length: 100 }, (_, v) =>
                v.toString(),
            );
            assert.includeOrderedMembers(bobTicketIds, expectedTicketIds);

            result = await lottery.viewNumbersAndStatusesForTicketIds(
                bobTicketIds,
            );
            assert.includeOrderedMembers(result[0].map(String), _ticketsBought);
        });

        it("Carol buys 1 ticket", async () => {
            const _ticketsBought = ["1111111"];
            // Carol buys 1/1/1/1/1/1
            result = await expect(
                lottery.connect(carol).buyTickets("1", _ticketsBought),
            )
                .to.emit(lottery, "TicketsPurchase")
                .withArgs(carol.address, "1", "1");
        });

        it("David buys 10 tickets", async () => {
            const _ticketsBought = [
                "1111111",
                "1222222",
                "1333333",
                "1444444",
                "1555555",
                "1666666",
                "1777777",
                "1888888",
                "1000000",
                "1999999",
            ];

            const expectedPricePerBatch =
                await lottery.calculateTotalPriceForBulkTickets(
                    "2000",
                    parseEther("0.5"),
                    "10",
                );

            result = await expect(
                lottery.connect(david).buyTickets("1", _ticketsBought),
            ).to.emit(lottery, "TicketsPurchase");

            assert.equal(
                expectedPricePerBatch.toString(),
                parseEther("4.9775").toString(),
            );
        });

        it("Owner does 10k Token injection", async () => {
            result = await lottery
                .connect(alice)
                .injectFunds("1", parseEther("10000"));
        });

        it("Operator closes lottery", async () => {
            await randomNumberGenerator
                .connect(alice)
                .setNextRandomResult("199999999");
            await randomNumberGenerator.connect(alice).changeLatestLotteryId();

            // Time travel
            await time.increaseTo(endTime);
            result = await lottery.connect(operator).closeLottery("1");
        });

        it("Numbers are drawn (9/9/9/9/9/9)", async () => {
            // 11 winning tickets
            result = await lottery
                .connect(operator)
                .drawFinalNumberAndMakeLotteryClaimable("1", true);
        });

        it("David claims the jackpot", async () => {
            // 10,000 + 47.525 + 0.5 + 4.9775 = 10053.0025 Token collected
            // 10053.0025 * (1-0.20) * 0.5 = 4021.201 Token

            result = await lottery
                .connect(david)
                .claimTickets("1", ["110"], ["5"]);

            result = await lottery.viewNumbersAndStatusesForTicketIds(["110"]);
            assert.equal(result[1][0], true);
        });

        it("Bob claims 10 winning tickets he bought", async () => {
            // 10,000 + 47.525 + 0.5 + 4.9775 = 10053.0025 Token collected
            // 10053.0025 * (1-0.20) * 0.02 = 160.84804 Token
            // 10053.0025 * (1-0.20) * 0.03 = 241.27206 Token
            // SUM (approximate) = 402.1201

            result = await lottery
                .connect(bob)
                .claimTickets(
                    "1",
                    ["8", "18", "28", "48", "58", "68", "78", "88", "98", "38"],
                    ["0", "0", "0", "0", "0", "0", "0", "0", "0", "1"],
                );

            // 10053.0025 * (1- 0.2) - 402.1201 - 4021.201 = 3619.0809
        });

        describe("LOTTERY #2 - CUSTOM RANDOMNESS - Exceptions", async () => {
            it("Operator cannot close lottery that is in claiming", async () => {
                await expect(
                    lottery.connect(operator).closeLottery("1"),
                ).to.revertedWith("Lottery not open");
            });

            it("Operator cannot inject funds in a lottery that is Open status", async () => {
                await expect(
                    lottery.connect(alice).injectFunds("1", parseEther("10")),
                ).to.revertedWith("Lottery not open");
                await expect(
                    lottery.connect(alice).injectFunds("2", parseEther("10")),
                ).to.revertedWith("Lottery not open");
            });

            it("Operator cannot draw numbers for previous lottery", async () => {
                await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("1", true),
                ).to.revertedWith("Lottery not close");
            });

            it("User cannot buy 1 ticket for old lottery", async () => {
                await expect(
                    lottery.connect(bob).buyTickets("1", ["1999999"]),
                ).to.revertedWith("Lottery is not open");
            });

            it("User cannot buy 1 ticket for future lottery", async () => {
                await expect(
                    lottery.connect(bob).buyTickets("2", ["1999999"]),
                ).to.revertedWith("Lottery is not open");
            });

            it("User cannot claim a ticket with wrong bracket", async () => {
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["6"]),
                ).to.revertedWith("Bracket out of range");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["5"]),
                ).to.revertedWith("No prize for this bracket");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["4"]),
                ).to.revertedWith("No prize for this bracket");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["3"]),
                ).to.revertedWith("No prize for this bracket");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["2"]),
                ).to.revertedWith("No prize for this bracket");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["1"]),
                ).to.revertedWith("No prize for this bracket");
                await expect(
                    lottery.connect(david).claimTickets("1", ["104"], ["0"]),
                ).to.revertedWith("No prize for this bracket");
            });

            it("User cannot claim twice a winning ticket", async () => {
                await expect(
                    lottery.connect(david).claimTickets("1", ["110"], ["5"]),
                ).to.revertedWith("Not the owner");
            });

            it("Operator cannot start lottery if length is too short/long", async () => {
                const currentLengthLottery = _lengthLottery;

                _lengthLottery = await lottery.MIN_LENGTH_LOTTERY();

                let endTimeTarget =
                    BigInt(await time.latest()) + _lengthLottery - 10n;

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTimeTarget,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Lottery length outside of range");

                _lengthLottery = await lottery.MAX_LENGTH_LOTTERY();

                endTimeTarget =
                    BigInt(await time.latest()) + _lengthLottery + 100n;

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTimeTarget,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Lottery length outside of range");

                // Set it back to previous value
                _lengthLottery = currentLengthLottery;

                endTime = BigInt(await time.latest()) + _lengthLottery;
            });

            it("Operator cannot start lottery if discount divisor is too low", async () => {
                const currentDiscountDivisor = _discountDivisor;

                _discountDivisor = (await lottery.MIN_DISCOUNT_DIVISOR()) - 1n;

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Discount divisor too low");

                // Set it back to previous value
                _discountDivisor = currentDiscountDivisor;
            });

            it("Operator cannot start lottery if treasury fee too high", async () => {
                const currentTreasuryFee = _treasuryFee;
                _treasuryFee = (await lottery.MAX_TREASURY_FEE()) + 1n;

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Treasury fee too high");

                // Set it back to previous value
                _treasuryFee = currentTreasuryFee;
            });

            it("Operator cannot start lottery if ticket price too low or too high", async () => {
                let newPriceTicketInToken = parseEther("0.0049999999");

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            newPriceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Outside of limits");

                newPriceTicketInToken = parseEther("0.0049999999");

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            newPriceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Outside of limits");
            });

            it("Operator cannot start lottery if wrong reward breakdown", async () => {
                const currentRewardBreakdown = _rewardsBreakdown;

                _rewardsBreakdown = ["0", "300", "500", "1500", "2500", "5000"]; // less than 10,000

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Rewards must equal 10000");

                _rewardsBreakdown = [
                    "10000",
                    "300",
                    "500",
                    "1500",
                    "2500",
                    "5000",
                ]; // less than 10,000

                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Rewards must equal 10000");

                // Set it back to previous value
                _rewardsBreakdown = currentRewardBreakdown;
            });

            it("Operator cannot close lottery that is not started", async () => {
                await expect(
                    lottery.connect(operator).closeLottery("2"),
                ).to.revertedWith("Lottery not open");
            });

            it("Operator starts lottery", async () => {
                endTime = BigInt(await time.latest()) + _lengthLottery;

                result = await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.emit(lottery, "LotteryOpen");
            });

            it("Operator cannot close lottery", async () => {
                await expect(
                    lottery.connect(operator).closeLottery("2"),
                ).to.revertedWith("Lottery not over");
            });

            it("Operator cannot draw numbers", async () => {
                await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("2", true),
                ).to.revertedWith("Lottery not close");
            });

            it("Operator cannot start a second lottery", async () => {
                await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            _lengthLottery,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Not time to start lottery");
            });

            it("User cannot buy 0 ticket", async () => {
                await expect(
                    lottery.connect(bob).buyTickets("2", []),
                ).to.revertedWith("No ticket specified");
            });

            it("User cannot buy more than the limit of tickets per transaction", async () => {
                const _maxNumberTickets = "5"; // 6 --> rejected // 5 --> accepted
                await lottery
                    .connect(alice)
                    .setMaxNumberTicketsPerBuy(_maxNumberTickets);

                await expect(
                    lottery
                        .connect(bob)
                        .buyTickets("2", [
                            "1999999",
                            "1999998",
                            "1999999",
                            "1999999",
                            "1999998",
                            "1999999",
                        ]),
                ).to.revertedWith("Too many tickets");

                // Sets limit at 100 tickets
                await lottery.connect(alice).setMaxNumberTicketsPerBuy("100");
            });

            it("User cannot buy tickets if one of the numbers is outside of range", async () => {
                await expect(
                    lottery
                        .connect(bob)
                        .buyTickets("2", [
                            "1999999",
                            "2199998",
                            "1999999",
                            "1999999",
                            "1999998",
                            "1999999",
                        ]),
                ).to.revertedWith("Outside range");

                await expect(
                    lottery
                        .connect(bob)
                        .buyTickets("2", [
                            "1999999",
                            "1929998",
                            "1999999",
                            "1999999",
                            "1999998",
                            "59999",
                        ]),
                ).to.revertedWith("Outside range");
            });

            it("Bob buys 2 tickets", async () => {
                await lottery
                    .connect(bob)
                    .buyTickets("2", ["1999999", "1569955"]);
            });

            it("User cannot claim tickets if same length for array arguments", async () => {
                await expect(
                    lottery
                        .connect(bob)
                        .claimTickets("1", ["1999999", "1569999"], ["1"]),
                ).to.revertedWith("Not same length");
            });

            it("User cannot claim tickets if not over", async () => {
                await expect(
                    lottery
                        .connect(bob)
                        .claimTickets("2", ["1999995", "1569995"], ["1", "1"]),
                ).to.revertedWith("Lottery not claimable");
            });

            it("Cannot buy ticket when it is end time", async () => {
                // Time travel
                await time.increaseTo(endTime);
                await expect(
                    lottery
                        .connect(bob)
                        .buyTickets("2", ["1269956", "1269955"]),
                ).to.revertedWith("Lottery is over");
            });

            it("Cannot change generator number", async () => {
                await expect(
                    lottery
                        .connect(alice)
                        .changeRandomGenerator(
                            await randomNumberGenerator.getAddress(),
                        ),
                ).to.revertedWith("Lottery not in claimable");
            });

            it("Operator cannot draw numbers if the lotteryId isn't updated in RandomGenerator", async () => {
                await randomNumberGenerator
                    .connect(alice)
                    .setNextRandomResult("199999994");

                result = await expect(
                    lottery.connect(operator).closeLottery("2"),
                ).to.emit(lottery, "LotteryClose");
                await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("2", false),
                ).to.revertedWith("Numbers not drawn");

                await randomNumberGenerator
                    .connect(alice)
                    .changeLatestLotteryId();

                // 0 winning ticket, funds are not rolled over
                result = await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("2", false),
                ).to.emit(lottery, "LotteryNumberDrawn");
            });

            it("Cannot claim for wrong lottery (too high)", async () => {
                await expect(
                    lottery.connect(david).claimTickets("1", ["111"], ["5"]),
                ).to.revertedWith("TicketId too high");
            });

            it("Cannot claim for wrong lottery (too low)", async () => {
                await expect(
                    lottery.connect(david).claimTickets("2", ["110"], ["5"]),
                ).to.revertedWith("TicketId too low");
            });

            it("Cannot claim for wrong lottery (too high)", async () => {
                await expect(
                    lottery.connect(david).claimTickets("2", ["113"], ["5"]),
                ).to.revertedWith("TicketId too high");
            });

            it("Lottery starts, close, and numbers get drawn without a participant", async () => {
                endTime = BigInt(await time.latest()) + _lengthLottery;

                result = await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.emit(lottery, "LotteryOpen");

                await time.increaseTo(endTime);
                result = await expect(
                    lottery.connect(operator).closeLottery("3"),
                ).to.emit(lottery, "LotteryClose");
                await randomNumberGenerator
                    .connect(alice)
                    .changeLatestLotteryId();

                // 0 winner
                result = await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("3", true),
                ).to.emit(lottery, "LotteryNumberDrawn");

                await expect(
                    lottery.connect(david).claimTickets("3", ["113"], ["1"]),
                ).to.revertedWith("TicketId too high");
            });

            it("Change the random generator (to existing one)", async () => {
                result = await expect(
                    lottery
                        .connect(alice)
                        .changeRandomGenerator(
                            await randomNumberGenerator.getAddress(),
                        ),
                ).to.emit(lottery, "NewRandomGenerator");
            });

            it("Lottery starts with only 4 brackets with a prize, one user buys tickets", async () => {
                await randomNumberGenerator
                    .connect(alice)
                    .setNextRandomResult("188888888");

                endTime = BigInt(await time.latest()) + _lengthLottery;

                const newRewardsBreakdown = [
                    "1000",
                    "0",
                    "1500",
                    "2500",
                    "0",
                    "5000",
                ];

                result = await expect(
                    lottery
                        .connect(operator)
                        .startLottery(
                            endTime,
                            _priceTicketInToken,
                            _discountDivisor,
                            newRewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.emit(lottery, "LotteryOpen");

                await lottery
                    .connect(injector)
                    .injectFunds("4", parseEther("1000"));

                const _ticketsBought = [
                    "1111118",
                    "1222288",
                    "1333888",
                    "1448888",
                    "1588888",
                    "1888888",
                ];

                // Total cost: 2.9925 Token
                result = await lottery
                    .connect(carol)
                    .buyTickets("4", _ticketsBought);
            });

            it("Lottery close and numbers get drawn with only 4 brackets with a prize", async () => {
                await time.increaseTo(endTime);
                result = await expect(
                    lottery.connect(operator).closeLottery("4"),
                ).to.emit(lottery, "LotteryClose");

                await randomNumberGenerator
                    .connect(alice)
                    .changeLatestLotteryId();

                // 6 winning tickets
                result = await expect(
                    lottery
                        .connect(operator)
                        .drawFinalNumberAndMakeLotteryClaimable("4", true),
                ).to.emit(lottery, "LotteryNumberDrawn");

                // 20% * 1002.9925 = 200.5985 Token
            });

            it("User claims first ticket", async () => {
                // 802.394 Token to collect
                // Rewards: ["1000", "0", "1500", "2500", "0", "5000"];
                // 2 tickets with 1 matching --> 10% * 802.394 --> 80.2394 total --> 40.1197/ticket
                // 1 ticket with 3 matching --> 15% * 802.394 --> 120.3591 total --> 120.3591/ticket
                // 2 tickets with 4 matching --> 25% * 802.394 --> 200.5985 total --> 100.29925/ticket
                // 1 ticket with 6 matching --> 50% * 802.394 --> 401.197 total --> 401.197/ticket

                result = await expect(
                    lottery.connect(carol).claimTickets("4", ["113"], ["0"]),
                ).to.emit(lottery, "TicketsClaim");
            });

            it("User cannot claim ticket in a bracket if equals to 0", async () => {
                await expect(
                    lottery.connect(carol).claimTickets("4", ["114"], ["1"]),
                ).to.revertedWith("No prize for this bracket");
                result = await expect(
                    lottery.connect(carol).claimTickets("4", ["114"], ["0"]),
                ).to.emit(lottery, "TicketsClaim");
            });

            it("User claims 2 more tickets", async () => {
                result = await expect(
                    lottery
                        .connect(carol)
                        .claimTickets("4", ["115", "118"], ["2", "5"]),
                ).to.emit(lottery, "TicketsClaim");
            });

            it("User cannot claim ticket in a lower bracket if bracket above is not 0", async () => {
                await expect(
                    lottery.connect(carol).claimTickets("4", ["116"], ["2"]),
                ).to.revertedWith("Bracket must be higher");
                result = await expect(
                    lottery
                        .connect(carol)
                        .claimTickets("4", ["116", "117"], ["3", "3"]),
                ).to.emit(lottery, "TicketsClaim");
            });
        });

        describe("Role exceptions", async () => {
            it("Owner can recover funds only if not play token", async () => {
                // Deploy Random Token
                let MockERC20 = await ethers.getContractFactory("MockERC20");
                const randomToken = await MockERC20.connect(alice).deploy(
                    "Random Token",
                    "RT",
                    parseEther("100"),
                );

                // Transfer token by "accident"
                await randomToken.transfer(
                    await lottery.getAddress(),
                    parseEther("1"),
                );

                result = await expect(
                    lottery
                        .connect(alice)
                        .recoverWrongTokens(
                            await randomToken.getAddress(),
                            parseEther("1"),
                        ),
                ).to.emit(lottery, "AdminTokenRecovery");

                await expect(
                    lottery
                        .connect(alice)
                        .recoverWrongTokens(
                            await mockToken.getAddress(),
                            parseEther("1"),
                        ),
                ).to.revertedWith("Cannot be play token");
            });

            it("Only operator can call operator functions", async () => {
                await expect(
                    lottery
                        .connect(alice)
                        .startLottery(
                            _lengthLottery,
                            _priceTicketInToken,
                            _discountDivisor,
                            _rewardsBreakdown,
                            _treasuryFee,
                        ),
                ).to.revertedWith("Not operator");

                await expect(
                    lottery.connect(alice).closeLottery("2"),
                ).to.revertedWith("Not operator");
                await expect(
                    lottery
                        .connect(alice)
                        .drawFinalNumberAndMakeLotteryClaimable("2", false),
                ).to.revertedWith("Not operator");
            });

            it("Only owner/injector can call owner functions", async () => {
                await expect(
                    lottery.connect(operator).setMaxNumberTicketsPerBuy("1"),
                ).to.revertedWith("Ownable: caller is not the owner");

                await expect(
                    lottery
                        .connect(operator)
                        .injectFunds("1", parseEther("10")),
                ).to.revertedWith("Not owner or injector");

                await expect(
                    lottery
                        .connect(operator)
                        .setOperatorAndTreasuryAndInjectorAddresses(
                            operator,
                            treasury,
                            injector,
                        ),
                ).to.revertedWith("Ownable: caller is not the owner");

                await expect(
                    lottery
                        .connect(operator)
                        .recoverWrongTokens(
                            await mockToken.getAddress(),
                            parseEther("10"),
                        ),
                ).to.revertedWith("Ownable: caller is not the owner");

                await expect(
                    lottery
                        .connect(operator)
                        .changeRandomGenerator(
                            await randomNumberGenerator.getAddress(),
                        ),
                ).to.revertedWith("Ownable: caller is not the owner");
            });

            it("Revert statements work in owner functions", async () => {
                await expect(
                    lottery.connect(alice).setMaxNumberTicketsPerBuy("0"),
                ).to.revertedWith("Must be > 0");
                await expect(
                    lottery
                        .connect(alice)
                        .setOperatorAndTreasuryAndInjectorAddresses(
                            operator,
                            "0x0000000000000000000000000000000000000000",
                            injector,
                        ),
                ).to.revertedWith("Cannot be zero address");
                await expect(
                    lottery
                        .connect(alice)
                        .setOperatorAndTreasuryAndInjectorAddresses(
                            "0x0000000000000000000000000000000000000000",
                            treasury,
                            injector,
                        ),
                ).to.revertedWith("Cannot be zero address");
                await expect(
                    lottery
                        .connect(alice)
                        .setOperatorAndTreasuryAndInjectorAddresses(
                            operator,
                            treasury,
                            "0x0000000000000000000000000000000000000000",
                        ),
                ).to.revertedWith("Cannot be zero address");
            });
        });
    });
});
