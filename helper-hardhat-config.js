const { ethers } = require("hardhat")

const networkConfig = {
  4: {
    name: "rinkeby",
    vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
    entranceFee: "100000000000000000", // 0.1 ETH
    gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
    subscriptionId: "21659", // got this after creating a vrf subscription @ vrf.chain.link
    callbackGasLimit: "500000",
    interval: "60",
  },

  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("1"),
    gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
    callbackGasLimit: "500000",
    interval: "10",
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
