//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRandomNumberGenerator.sol";
import "../interfaces/ILottery.sol";

contract MockRandomNumberGenerator is IRandomNumberGenerator, Ownable {
    address public lottery;
    uint32 public randomResult;
    uint256 public nextRandomResult;
    uint256 public latestLotteryId;

    /**
     * @notice Constructor
     * @dev MockRandomNumberGenerator must be deployed before the lottery.
     */
    constructor() {}

    /**
     * @notice Set the address for the Lottery
     * @param _lottery: address of the  lottery
     */
    function setLotteryAddress(address _lottery) external onlyOwner {
        lottery = _lottery;
    }

    /**
     * @notice Set the address for the Lottery
     * @param _nextRandomResult: next random result
     */
    function setNextRandomResult(uint256 _nextRandomResult) external onlyOwner {
        nextRandomResult = _nextRandomResult;
    }

    /**
     * @notice Request randomness from a user-provided seed
     */
    function getRandomNumber() external override {
        require(msg.sender == lottery, "Only Lottery");
        uint256[] memory _randomResult = new uint256[](1);
        _randomResult[0] = nextRandomResult;
        fulfillRandomWords(0, _randomResult);
    }

    /**
     * @notice Change latest lotteryId to currentLotteryId
     */
    function changeLatestLotteryId() external {
        latestLotteryId = ILottery(lottery).viewCurrentLotteryId();
    }

    /**
     * @notice View latestLotteryId
     */
    function viewLatestLotteryId() external view override returns (uint256) {
        return latestLotteryId;
    }

    /**
     * @notice View random result
     */
    function viewRandomResult() external view override returns (uint32) {
        return randomResult;
    }

    /**
     * @notice Callback function used by ChainLink's VRF Coordinator
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal {
        randomResult = uint32(1000000 + (randomWords[0] % 1000000));
    }
}
