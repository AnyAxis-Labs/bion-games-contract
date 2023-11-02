// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
pragma abicoder v2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {RandomNumberGenerator} from "./randomness/RandomNumberGenerator.sol";
import "hardhat/console.sol";

/**
 * @title PowerPool
 */
contract PowerPool is Ownable, Pausable, ReentrancyGuard {
    enum OracleState {
        Unknown,
        Requested,
        Filled
    }

    RandomNumberGenerator public randomNumberGenerator;

    bool public genesisStartOnce = false;

    address public adminAddress; // address of the admin
    address public operatorAddress; // address of the operator

    IERC721 public ticket;

    uint256 public poolSize; // max ticket bet per round
    uint256 public treasuryFee; // treasury rate (e.g. 200 = 2%, 150 = 1.50%)

    uint256 public currentEpoch; // current epoch for prediction round

    uint256 public constant MAX_TREASURY_FEE = 3000; // 30%

    uint256 private constant BASIS_POINTS = 10000;

    mapping(uint256 => Round) public rounds;

    mapping(uint256 => mapping(uint256 => address)) public ledger; // epoch to ticketId to user address
    mapping(uint256 => mapping(address => PlayInfo)) public playInfos; // epoch to user address to list of tokenIds

    struct Round {
        uint256[] tokenIds;
        uint256 epoch;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 requestId;
        uint256 totalTicket;
        uint256 winningTiket;
        uint256 rewardAmount;
        bool rewardClaimed;
        uint256 treasuryAmount;
        bool treasuryClaimed;
        OracleState oracleState;
    }

    struct PlayInfo {
        uint256[] userTokenIds;
        bool refunded;
    }

    event Play(
        address indexed sender,
        uint256 indexed epoch,
        uint256 tokenId,
        uint256 ticketId
    );
    event Claim(address indexed sender, uint256 indexed epoch);
    event EndRound(uint256 indexed epoch);

    event NewAdminAddress(address admin);
    event NewPoolSize(uint256 indexed epoch, uint256 poolSize);
    event NewTreasuryFee(uint256 indexed epoch, uint256 treasuryFee);
    event NewOperatorAddress(address operator);
    event NewRandomNumberGenerator(address randomNumberGenerator);

    event Pause(uint256 indexed epoch);
    event RewardsCalculated(
        uint256 indexed epoch,
        uint256 winningTicket,
        uint256 rewardAmount,
        uint256 treasuryAmount
    );

    event StartRound(uint256 indexed epoch);
    event TreasuryClaim(uint256 indexed epoch);
    event Unpause(uint256 indexed epoch);

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Not admin");
        _;
    }

    modifier onlyAdminOrOperator() {
        require(
            msg.sender == adminAddress || msg.sender == operatorAddress,
            "Not operator/admin"
        );
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operatorAddress, "Not operator");
        _;
    }

    modifier notContract() {
        require(!_isContract(msg.sender), "Contract not allowed");
        require(msg.sender == tx.origin, "Proxy contract not allowed");
        _;
    }

    /**
     * @notice Constructor
     * @param _ticketAddress: ticket
     * @param _randomNumberGenerator: random number generator address
     * @param _adminAddress: admin address
     * @param _operatorAddress: operator address
     * @param _poolSize: pool size
     * @param _treasuryFee: treasury fee (1000 = 10%)
     */
    constructor(
        IERC721 _ticketAddress,
        address _randomNumberGenerator,
        address _adminAddress,
        address _operatorAddress,
        uint256 _poolSize,
        uint256 _treasuryFee
    ) {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");

        randomNumberGenerator = RandomNumberGenerator(_randomNumberGenerator);
        adminAddress = _adminAddress;
        operatorAddress = _operatorAddress;
        poolSize = _poolSize;
        treasuryFee = _treasuryFee;
        ticket = IERC721(_ticketAddress);
    }

    /**
     * @notice Play batch token
     * @param epoch epoch
     * @param tokenIds list of tokenIds
     */
    function play(
        uint256 epoch,
        uint256[] calldata tokenIds
    ) external whenNotPaused nonReentrant notContract {
        require(epoch == currentEpoch, "Play too early/late");
        require(_playable(epoch), "Round not playable");

        uint256 batchLength = tokenIds.length;
        require(
            rounds[epoch].totalTicket + batchLength <= poolSize,
            "Round full"
        );

        for (uint256 i = 0; i < batchLength; i++) {
            _play(epoch, tokenIds[i]);
        }

        if (rounds[epoch].totalTicket == poolSize) {
            _executeRound();
        }
    }

    function _play(uint256 epoch, uint256 tokenId) internal {
        ticket.transferFrom(msg.sender, address(this), tokenId);
        // Update round data
        Round storage round = rounds[epoch];
        uint256 ticketId = round.totalTicket;
        ledger[epoch][ticketId] = msg.sender;
        round.totalTicket++;
        round.tokenIds.push(tokenId);
        playInfos[epoch][msg.sender].userTokenIds.push(tokenId);

        emit Play(msg.sender, epoch, tokenId, ticketId);
    }

    /**
     * @notice Claim reward for an array of epochs
     * @param epochs: array of epochs
     */
    function claim(
        uint256[] calldata epochs
    ) external nonReentrant notContract {
        for (uint256 i = 0; i < epochs.length; ) {
            _claim(epochs[i], msg.sender);
            unchecked {
                i++;
            }
        }
    }

    function _claim(uint256 epoch, address user) internal {
        Round memory round = rounds[epoch];
        require(round.startTimestamp != 0, "Round has not started");

        uint256[] memory tokenIds;
        uint256 tokenIdsLength;
        // Round valid, claim rewards
        if (round.oracleState != OracleState.Unknown) {
            if (round.oracleState == OracleState.Requested) {
                _calculateRewards(epoch);
                round = rounds[epoch];
            }
            require(claimable(epoch, user), "Not eligible for claim");
            tokenIds = round.tokenIds;
            tokenIdsLength = round.rewardAmount;
        }
        // Round invalid, refund bet amount
        else {
            require(refundable(epoch, user), "Not eligible for refund");
            playInfos[epoch][user].refunded = true;
            tokenIds = playInfos[epoch][user].userTokenIds;
            tokenIdsLength = tokenIds.length;
        }

        rounds[epoch].rewardClaimed = true;

        for (uint256 i; i < tokenIdsLength; ) {
            ticket.transferFrom(address(this), user, tokenIds[i]);
            unchecked {
                i++;
            }
        }

        emit Claim(user, epoch);
    }

    /**
     * @notice Claim treasury for an array of epochs
     * @param epochs: array of epochs
     */
    function claimTreasury(
        uint256[] calldata epochs
    ) external nonReentrant onlyAdminOrOperator {
        for (uint256 i = 0; i < epochs.length; ) {
            _claimTreasury(epochs[i]);
            unchecked {
                i++;
            }
        }
    }

    /**
     *
     * @param epoch epoch
     */
    function _claimTreasury(uint256 epoch) internal {
        Round memory round = rounds[epoch];
        require(round.startTimestamp != 0, "Round has not started");
        require(round.oracleState != OracleState.Unknown, "Round not executed");
        require(!round.treasuryClaimed, "Treasury already claimed");

        if (round.oracleState == OracleState.Requested) {
            _calculateRewards(epoch);
            round = rounds[epoch];
        }

        rounds[epoch].treasuryClaimed = true;

        for (uint256 i = round.rewardAmount; i < round.tokenIds.length; ) {
            ticket.transferFrom(address(this), adminAddress, round.tokenIds[i]);
            unchecked {
                i++;
            }
        }

        emit TreasuryClaim(epoch);
    }

    /**
     * @notice Start the next round n, lock price for round n-1, end round n-2
     * @dev Callable by operator
     */
    function _executeRound() internal {
        // CurrentEpoch refers to previous round (n-1)
        _safeEndRound(currentEpoch);

        // Increment currentEpoch to current round (n)
        currentEpoch = currentEpoch + 1;
        _safeStartRound(currentEpoch);
    }

    /**
     * @notice Start genesis round
     * @dev Callable by admin or operator
     */
    function genesisStartRound() external whenNotPaused onlyOperator {
        require(!genesisStartOnce, "Can only run genesisStartRound once");

        currentEpoch = currentEpoch + 1;
        _startRound(currentEpoch);
        genesisStartOnce = true;
    }

    /**
     * @notice called by the admin to pause, triggers stopped state
     * @dev Callable by admin or operator
     */
    function pause() external whenNotPaused onlyAdminOrOperator {
        _pause();

        emit Pause(currentEpoch);
    }

    /**
     * @notice called by the admin to unpause, returns to normal state
     * Reset genesis state. Once paused, the rounds would need to be kickstarted by genesis
     * @dev Callable by admin or operator
     */
    function unpause() external whenPaused onlyAdminOrOperator {
        genesisStartOnce = false;
        _unpause();

        emit Unpause(currentEpoch);
    }

    /**
     * @notice Set poolSize
     * @dev Callable by admin
     */
    function setPoolSize(uint256 _poolSize) external whenPaused onlyAdmin {
        require(_poolSize != 0, "Must be superior to 0");
        poolSize = _poolSize;

        emit NewPoolSize(currentEpoch, _poolSize);
    }

    /**
     * @notice Set operator address
     * @dev Callable by admin
     */
    function setOperator(address _operatorAddress) external onlyAdmin {
        require(_operatorAddress != address(0), "Cannot be zero address");
        operatorAddress = _operatorAddress;

        emit NewOperatorAddress(_operatorAddress);
    }

    /**
     * @notice Set Random number generator address
     * @dev Callable by admin
     */
    function setRandomNumberGenerator(
        address _randomNumberGenerator
    ) external whenPaused onlyAdmin {
        require(_randomNumberGenerator != address(0), "Cannot be zero address");
        randomNumberGenerator = RandomNumberGenerator(_randomNumberGenerator);

        // Dummy check to make sure the interface implements this function properly
        randomNumberGenerator.getRandomNumber();

        emit NewRandomNumberGenerator(_randomNumberGenerator);
    }

    /**
     * @notice Set treasury fee
     * @dev Callable by admin
     */
    function setTreasuryFee(
        uint256 _treasuryFee
    ) external whenPaused onlyAdmin {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high");
        treasuryFee = _treasuryFee;

        emit NewTreasuryFee(currentEpoch, treasuryFee);
    }

    /**
     * @notice Set admin address
     * @dev Callable by owner
     */
    function setAdmin(address _adminAddress) external onlyOwner {
        require(_adminAddress != address(0), "Cannot be zero address");
        adminAddress = _adminAddress;

        emit NewAdminAddress(_adminAddress);
    }

    /**
     * @notice Get the claimable stats of specific epoch and user account
     * @param epoch: epoch
     * @param user: user address
     */
    function claimable(uint256 epoch, address user) public view returns (bool) {
        Round memory round = rounds[epoch];
        uint256 result;
        if (round.oracleState == OracleState.Filled) {
            result = round.winningTiket;
        } else if (round.oracleState == OracleState.Requested) {
            result = _getResult(round.requestId, round.totalTicket);
        } else {
            return false;
        }

        return ledger[epoch][result] == user && !round.rewardClaimed;
    }

    /**
     * @notice Get the refundable stats of specific epoch and user account
     * @param epoch: epoch
     * @param user: user address
     */
    function refundable(
        uint256 epoch,
        address user
    ) public view returns (bool) {
        Round memory round = rounds[epoch];
        return
            round.oracleState == OracleState.Unknown &&
            currentEpoch > epoch &&
            !playInfos[epoch][user].refunded;
    }

    /**
     * @notice Get tokenIds of specific epoch
     * @param epoch  epoch
     */
    function getTokenIds(
        uint256 epoch
    ) external view returns (uint256[] memory) {
        return rounds[epoch].tokenIds;
    }

    /**
     * @notice get user tokenIds of specific epoch
     * @param epoch  epoch
     */
    function getUserTokenIds(
        uint256 epoch,
        address user
    ) external view returns (uint256[] memory) {
        return playInfos[epoch][user].userTokenIds;
    }

    /**
     * @notice Calculate rewards for round
     * @param epoch: epoch
     */
    function calculateReward(uint256 epoch) external {
        _calculateRewards(epoch);
    }

    /**
     * @notice Calculate rewards for round
     * @param epoch: epoch
     */
    function _calculateRewards(uint256 epoch) internal {
        require(
            rounds[epoch].oracleState == OracleState.Requested,
            "Rewards calculated/Round not end"
        );
        Round storage round = rounds[epoch];

        uint256 result = _getResult(round.requestId, round.totalTicket);

        uint256 treasuryAmount = (round.totalTicket * treasuryFee) /
            BASIS_POINTS;
        uint256 rewardAmount = round.totalTicket - treasuryAmount;
        emit RewardsCalculated(epoch, result, rewardAmount, treasuryAmount);

        round.winningTiket = result;
        round.rewardAmount = rewardAmount;
        round.treasuryAmount = treasuryAmount;
        round.oracleState = OracleState.Filled;
    }

    /**
     * @notice End round
     * @param epoch: epoch
     */
    function _safeEndRound(uint256 epoch) internal {
        require(
            rounds[epoch].startTimestamp != 0,
            "Can only end round after round has started"
        );
        require(
            rounds[epoch].totalTicket == poolSize,
            "Can only end round after round full"
        );

        Round storage round = rounds[epoch];
        uint256 requestId = randomNumberGenerator.getRandomNumber();
        round.endTimestamp = block.timestamp;

        round.requestId = requestId;
        round.oracleState = OracleState.Requested;

        emit EndRound(epoch);
    }

    /**
     * @notice Start round
     * Previous round n-1 must end
     * @param epoch: epoch
     */
    function _safeStartRound(uint256 epoch) internal {
        require(
            genesisStartOnce,
            "Can only run after genesisStartRound is triggered"
        );
        require(
            rounds[epoch - 1].oracleState != OracleState.Unknown,
            "Can only start round after round n-1 has ended"
        );
        _startRound(epoch);
    }

    /**
     * @notice Start round
     * Previous round n-1 must end
     * @param epoch: epoch
     */
    function _startRound(uint256 epoch) internal {
        Round storage round = rounds[epoch];
        round.startTimestamp = block.timestamp;
        round.epoch = epoch;
        round.totalTicket = 0;

        emit StartRound(epoch);
    }

    /**
     * @notice Determine if a round is valid for receiving bets
     * Round must have started and locked
     * Current timestamp must be within startTimestamp and endTimestamp
     */
    function _playable(uint256 epoch) internal view returns (bool) {
        return
            rounds[epoch].startTimestamp != 0 &&
            block.timestamp > rounds[epoch].startTimestamp;
    }

    function _getResult(
        uint256 requestId,
        uint256 totalTicket
    ) internal view returns (uint256) {
        uint256 randomNumber = _getRandomNumber(requestId);
        return randomNumber % totalTicket;
    }

    /**
     * @notice Get random number by request id from random number generator
     */
    function _getRandomNumber(
        uint256 requestId
    ) internal view returns (uint256) {
        (bool fulfilled, uint256[] memory randomWords) = randomNumberGenerator
            .getRequestStatus(requestId);
        require(fulfilled, "Request not fulfilled");
        return randomWords[0];
    }

    /**
     * @notice Returns true if `account` is a contract.
     * @param account: account address
     */
    function _isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
