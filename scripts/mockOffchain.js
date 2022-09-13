const { providers } = require("ethers")
const { ethers, network } = require("hardhat")

async function mockKeepers() {
  const raffle = await ethers.getContract("Raffle")
  const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData)

  const raffleState = await raffle.getRaffleState()
  console.log(raffleState)
  // isopen

  const numPlayers = await raffle.getNumberofPlayers()
  console.log(`No. of players: ${numPlayers.toString()}`)
  // has players

  const balance = await ethers.provider.getBalance(raffle.address)
  console.log(`Contract Balance : ${ethers.utils.formatEther(balance.toString())} ETH`)
  // has contract balance

//   const timestamp = await raffle.getLatestTimeStamp()
//   console.log(timestamp.toString())

//   const interval = await raffle.getInterval()
//   console.log(interval.toString())

    console.log(network.config.chainId)

  if (upkeepNeeded) {
    const tx = await raffle.performUpkeep(checkData)
    const txReceipt = await tx.wait(1)
    const requestId = txReceipt.events[1].args.requestId
    console.log(`Performed upkeep with RequestId: ${requestId}`)

    if (network.config.chainId == 31337) {
      await mockVrf(requestId, raffle)
    }
  } else {
    console.log("No upkeep needed!")
  }
}

async function mockVrf(requestId, raffle) {
  console.log("We on a local network? Ok let's pretend...")
  const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
  console.log("Responded!")
  const recentWinner = await raffle.getRecentWinner()
  console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
