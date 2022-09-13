// 1. Enter the lottery by paying some amount
// 2. Pick a random winner using chainlin vrf
// 3. Winner to be selected every X time units -> completely automated using chainlink keepers

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpKeepNotNeeded(uint256 currentBalanace, uint256 numPlayers, uint256 raffleState);

/**
 * @title Sample Raffle Contract
 * @author Pranay Reddy
 * @notice Creating an untamperable decentralized Smart Contract
 * @dev Implements Chainlink VRF to pick a random winner and Chainlink Keepers to automate selecting the winner using the vrf output.
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // inheriting the VRFConsumerBaseV2 contract for vrf
    // inheriting the KeeperCompatibleInterface for keepers

    /* Type Declartaions */
    enum RaffleState {
        OPEN,
        CALCULATING,
        CLOSED
    }
    // We create an enum declaration for raffle state instead of assigning numbers to state and remembering them

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    // made this payable because when the player wins the raffle we'll have to pay them
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant NUM_WORDS = 1;

    /* Lottery Variables */
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        // enum values can be access by enum.VALUE
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    // 1. Enter the lottery by paying some amount
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }

        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }

        s_players.push(payable(msg.sender));
        // Emit an event when we update a dynamic array or mapping
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the chainlink keeper nodes monitor and determine if upKeep is needed.
     * Computation is done off-chain and when upkeep is needed the performUpkeep function is called.
     * In our case, the following should be true in order to return true:
     * 1. time interval should have passed.
     * 2. lottery should have atleast 1 player and some eth balance
     * 3. our subscription is funded with link
     * 4. the lottery should be in an "open" state
     */

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (
            bool upKeepNeeded,
            bytes memory /*performData */
        )
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    // 2. Pick a random winner using chainlin vrf + using keepers automate picking winner when the conditiuons in checkUpKeep are mentioned
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords( // Returns a uint256 request id
            i_gasLane,
            // max gas (in wei) you are fine with when requesting for a random number
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            // How many confirmations the chainlink node should wait before responding
            i_callbackGasLimit,
            // limit for computation for the fullfillrandomwords callback function
            NUM_WORDS
        );

        emit RequestedRaffleWinner(requestId);
        // this is redundant as the mock itself (mock.sol in test folder) emits an event containing the requestId
    }

    function fulfillRandomWords(
        uint256, /*requestID*/
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        // Do a mod to get the random number within bounds of the total players in the raffle

        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        // open raffle again after winner is selected
        s_players = new address payable[](0);
        // reset players array to empty
        s_lastTimeStamp = block.timestamp;

        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        // send all balance the contract holds to the winner

        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* Getter functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getNumberofPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    // For returning constants use pure instead of view

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
