const { ethers, network } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE = "../nextjs-smartcontract-lottery/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/constants/abi.json"

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Updating front end")
    updateContractAddresses()
    updateABI()
  }
}

async function updateABI() {
  const raffle = await ethers.getContract("Raffle")
  fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
  // raffle.interface is the abi as an interface which we format as json and write back
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle")
  const chainId = network.config.chainId.toString()

  const currentAddress = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
  // get the current json from front end directory

  if (chainId in currentAddress) {
    // if an entry of the chainid is there
    if (!currentAddress[chainId].includes(raffle.address)) {
      // and the deployed contract's address is not a part of the chainid
      currentAddress[chainId].push(raffle.address)
      // then add it in
    }
  } else {
    currentAddress[chainId] = [raffle.address]
    // if an entry of chainid is not there add it in
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddress))
  // writeback the updated json object
}

module.exports.tag = ["all", "frontend"]
