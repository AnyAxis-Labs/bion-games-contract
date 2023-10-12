// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IRandomNumberGenerator {
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    function getRandomNumber() external returns (uint256);

    function setKeyHash(bytes32 _keyHash) external;

    function setPowerPoolAddress(address _powerPool) external;

    function withdrawTokens(
        address _tokenAddress,
        uint256 _tokenAmount
    ) external;

    function getRequestStatus(
        uint256 _requestId
    ) external view returns (bool fulfilled, uint256[] memory randomWords);
}
