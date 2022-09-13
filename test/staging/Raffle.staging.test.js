const { assert, expect } = require("chai")
const { deployments, getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
  ? describe.skip // skip for actual test-nets and run only for hardhat testnet
  : describe("Raffle Staging Tests", function () {
      let Raffle, deployer, entranceFee

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        Raffle = await ethers.getContract("Raffle", deployer)

        entranceFee = await Raffle.getEntranceFee()
      })

      describe("fullfillRandomWords", function () {
        it("works with live ChainLink Keepers and VRF, we get a random winner", async function () {
          const startingTimeStamp = await Raffle.getLatestTimeStamp()
          const accounts = ethers.getSigners()

          //setup listener before we enter raffle in case blockchain moves really fast
          await new Promise(async (resolve, reject) => {
            Raffle.once("WinnerPicked", async () => {
              console.log("Winner Picked event fired")
              try {
                const recentWinner = await Raffle.getRecentWinner()
                const raffleState = await Raffle.getRaffleState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimeStamp = await Raffle.getLatestTimeStamp()

                await expect(Raffle.getPlayer(0)).to.be.reverted
                assert.equal(recentWinner.toString(), accounts[0].address)
                assert.equal(raffleState, 0)
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(entranceFee).toString()
                )
                assert(endingTimeStamp > startingTimeStamp)

                resolve()
              } catch (e) {
                console.log(e)
                reject(e)
              }
            })
            console.log("Entering Raffle")
            await Raffle.enterRaffle({ value: entranceFee }) //enter lottery
            await tx.wait(6)
            console.log("Time to wait")
            // won't complete until our listener has finished listening
            const winnerStartingBalance = await accounts[0].getBalance()
          })
        })
      })
    })


