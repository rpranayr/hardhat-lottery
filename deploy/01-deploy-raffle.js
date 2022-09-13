const { deployments, getNamedAccounts, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("5")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId
    // would need mocks here as well as vrf + keepers not available on hardhat testnet
    // rinkeby vrfCoordinator address is in the helper hardhat config

    if (developmentChains.includes(network.name)) {
        // We are on a development chain, grab the mock
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        // get the deployed mock's address

        const txResponse = await vrfCoordinatorV2Mock.createSubscription()
        // emits an event saying subscription created with this id
        const txReceipt = await txResponse.wait()
        // wait 1 block confirmation
        // this txReceipt holds the subscription id

        subscriptionId = txReceipt.events[0].args.subId

        // Mock allows to fund the subscription without the need of link
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        // get the address of the vrfCoordinator from helper hardhat config

        subscriptionId = networkConfig[chainId]["subscriptionId"]
        // get the subscription id
    }

    /* Setting up args to pass */
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const raffle = await deploy("Raffle", { // This will create a deployment called 'Token'. By default it will look for an artifact with the same name. The 'contract' option allows you to use a different artifact.
        from: deployer,
        args: args,
        log: true, // Display the address and gas used in the console (not when run in test though).
        waitConformations: network.config.blockConfirmations || 1,
    })

    // Verifying the contract
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args)
    }
    log("----------------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
