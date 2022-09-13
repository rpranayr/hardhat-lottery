const { assert, expect } = require("chai")
const { deployments, getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip // skip for actual test-nets and run only for hardhat testnet
  : describe("Raffle", function () {
      let Raffle, deployer, VRFCoordinatorV2Mock, entranceFee, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        Raffle = await ethers.getContract("Raffle", deployer)

        VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        entranceFee = await Raffle.getEntranceFee()
        interval = await Raffle.getInterval()
      })

      describe("constructor", async function () {
        it("initializes the raffle correctly", async function () {
          const raffleState = await Raffle.getRaffleState()

          assert.equal(raffleState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enter raffle", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(Raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
        })

        it("records players when they enter", async function () {
          await Raffle.enterRaffle({ value: entranceFee })
          const player = await Raffle.getPlayer(0)
          assert.equal(player.toString(), deployer)
        })

        it("emits event on enter", async function () {
          await expect(Raffle.enterRaffle({ value: entranceFee })).to.emit(Raffle, "RaffleEnter")
        })

        it("doesnt allow entrance when raffle is calculating", async function () {
          // raffle goes into a calculating state when performUpKeep is called, which is called when checkUpKeep returns true
          // checkUpKeep returns true only when the keeper nodes return true
          // so we'll pretend to be the keeper nodes, run checkUpKeep, return true from that and then run performUpKeep to get to CALCULATING raffle state

          /* to return true from checkUpKeep 4 things need to happen:
                    1. raffle should be open (done)
                    2. interval amount of time has to be passed
                    3. raffle should have players
                    4. raffle should have balance

            */

          await Raffle.enterRaffle({ value: entranceFee }) // (3) & (4) check

          // For (2) we can't wait for the time to pass if the interval is way too long. For that hardhat has some special functions like evm_increaseTime, evm_mine.
          await network.provider.send("evm_increaseTime", [interval.toNumber()])
          // COURSE DID A + 1 IN THE PARAMETER PASSED
          // Increase time by whatever the interval is
          await network.provider.send("evm_mine", [])
          // network.provider.send is a way to send json-rpc calls to the blockchain. First parameter is the name of the json function name and second parameter is the parameters user wants to pass to the functon being called.

          // Pretend to be a Chainlink Keeper
          await Raffle.performUpkeep([])

          // Now since we are performing up keep raffle will go into calculating. So to test that we'll try to enter raffle and it should throw raffle not open.
          await expect(Raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
            "Raffle__NotOpen"
          )
        })
      })

      describe("checkUpKeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber()])
          await network.provider.send("evm_mine", [])

          // to not send a tx but want to simulate sending the tx, we used callstatic
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([])
          assert(!upKeepNeeded)
        })

        it("returns false is raffle isn't open", async function () {
          await Raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber()])
          await network.provider.send("evm_mine", [])
          await Raffle.performUpkeep("0x")
          // another way to send blank byte object is by sending "0x" or "[]"

          const raffleState = await Raffle.getRaffleState()
          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), "1")
          // we can't compare to string to the enum CALCULATING value as under the hood enum assigns a number to each value you mention in it
          assert.equal(upKeepNeeded, false)
        })

        it("returns false if enought time hasn't passed", async function () {
          // isOpen flag in the performupkeep function is true from the start
          await Raffle.enterRaffle({ value: entranceFee }) // this makes the hasPlayers & hasBalance flag in the performupkeep function true
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
          await network.provider.send("evm_mine", [])

          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([])
          assert.equal(upKeepNeeded, false)
        })

        it("returns true if enough time has passed, has players, has eth balance and is open", async function () {
          await Raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          const { upKeepNeeded } = await Raffle.callStatic.checkUpkeep([])
          assert.equal(upKeepNeeded, true)
        })
      })

      describe("performUpKeep", function () {
        it("it can run only if checkUpKeep is true", async function () {
          await Raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const tx = await Raffle.performUpkeep([])
          // if checkupkeep had returned true we won't have a problem running the performupkeep function

          assert(tx)
        })

        it("reverts when checkupkeep is false", async function () {
          await expect(Raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpKeepNotNeeded")
        })

        it("updates the raffle state, emits an event and calls the vrf coordinator", async function () {
          await Raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])

          const txResponse = await Raffle.performUpkeep([])
          const txReceipt = await txResponse.wait(1)

          const requestId = txReceipt.events[1].args.requestId
          const raffleState = await Raffle.getRaffleState()

          assert(requestId.toNumber() > 0)
          assert(raffleState.toString() == "1")
        })
      })

      describe("fullfillRandomWords", function () {
        beforeEach(async function () {
          await Raffle.enterRaffle({ value: entranceFee }) //enter lottery
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) //interval time has passed
          await network.provider.send("evm_mine", [])
        })

        it("can only be called after performUpKeep", async function () {
          await expect(
            VRFCoordinatorV2Mock.fulfillRandomWords(0, Raffle.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            VRFCoordinatorV2Mock.fulfillRandomWords(1, Raffle.address)
          ).to.be.revertedWith("nonexistent request")
        })

        it("picks a winner, resets the lottery and sends the money", async function () {
          const additionalEntrants = 3 // 3 new entrants apart from the deployer
          const startingAccountIndex = 1

          const accounts = await ethers.getSigners()

          for (
            let i = startingAccountIndex;
            i < additionalEntrants + startingAccountIndex;
            i = i + 1
          ) {
            const accountConnectedRaffle = Raffle.connect(accounts[i]) // for each of the new entrant connect the contract
            await accountConnectedRaffle.enterRaffle({ value: entranceFee }) // Each of the new entrant enters the Raffle
          }

          const startingTimeStamp = await Raffle.getLatestTimeStamp() // stores starting timestamp (before we fire our event)

          // When fulfillrandomwords is called, it emits a winner picked event.
          // On local hardhat testnet , we ourselves will be calling the fulfillrandomwords using the mocks
          await new Promise(async (resolve, reject) => {
            // Setting up the listener
            Raffle.once("WinnerPicked", async () => {
              console.log("Found the event!")

              try {
                const recentWinner = await Raffle.getRecentWinner()

                // accounts[1] is the winner
                // console.log(`Winner is: ${recentWinner}`)
                // console.log("---------------------------------------")
                // console.log(accounts[1].address)
                // console.log(accounts[2].address)
                // console.log(accounts[3].address)
   

                const raffleState = await Raffle.getRaffleState()
                const endingTimeStamp = await Raffle.getLatestTimeStamp()
                const numPlayers = await Raffle.getNumberofPlayers()
                const winnerEndingBalance = await accounts[1].getBalance()

                assert.equal(numPlayers.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                assert(endingTimeStamp > startingTimeStamp)

                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(entranceFee.mul(additionalEntrants).add(entranceFee))
                    .toString()
                )

                resolve()
              } catch (e) {
                reject(e)
              }
            })

            // This part won't be needed when working with actual testnet / mainnet
            const tx = await Raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance() //manually checked thaat accounts[1] is the winner
            await VRFCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              Raffle.address
            )
            // calling the fullfillrandomwords from the mock
          })
        })
      })
    })
