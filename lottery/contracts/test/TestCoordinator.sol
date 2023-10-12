// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract TestCoordinator {
    uint256 public requestId;

    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external returns (uint256 _requestId) {
        _requestId = requestId++;
    }

    function fullfillRandomWords(
        address randomness,
        uint256 _requestId,
        uint256[] memory randomWords
    ) external {
        VRFConsumerBaseV2(randomness).rawFulfillRandomWords(
            _requestId,
            randomWords
        );
    }
}
