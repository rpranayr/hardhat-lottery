const { deployments, getNamedAccounts, network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

// Mock has two parameters: baseFee & gasPriceLink
const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the premium. It costs 0.25 LINK to request a random number
const GAS_PRICE_LINK = 1e9 /// LINK per gas

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if (developmentChains.includes(network.name)) {
        log("Local Network Detected! Deploying mocks ... \n")

        // deploy a mock vrfCoordinator
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
        log("Mocks Deployed!")
         
    }
}

module.exports.tags = ["all", "mocks"]
