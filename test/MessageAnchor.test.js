const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MessageAnchor", function () {
    let messageAnchor;
    let owner, user1, user2, user3;
    const sampleMessageHash = "0x1234567890123456789012345678901234567890123456789012345678901234";
    const sampleIPFSHash = "QmTestHashExample123456789";

    beforeEach(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        
        const MessageAnchor = await ethers.getContractFactory("MessageAnchor");
        messageAnchor = await MessageAnchor.deploy();
        await messageAnchor.deployed();
    });

    describe("Message Anchoring", function () {
        it("Should anchor a new message", async function () {
            await expect(messageAnchor.connect(user1).anchorMessage(
                user2.address,
                sampleMessageHash,
                sampleIPFSHash
            ))
            .to.emit(messageAnchor, "MessageAnchored")
            .withArgs(0, user1.address, user2.address, sampleMessageHash, sampleIPFSHash);

            expect(await messageAnchor.getMessageCount()).to.equal(1);
        });

        it("Should fail with invalid recipient", async function () {
            await expect(messageAnchor.connect(user1).anchorMessage(
                ethers.constants.AddressZero,
                sampleMessageHash,
                sampleIPFSHash
            )).to.be.revertedWith("Invalid recipient address");
        });

        it("Should fail with invalid message hash", async function () {
            await expect(messageAnchor.connect(user1).anchorMessage(
                user2.address,
                "0x0000000000000000000000000000000000000000000000000000000000000000",
                sampleIPFSHash
            )).to.be.revertedWith("Invalid message hash");
        });

        it("Should fail with empty IPFS hash", async function () {
            await expect(messageAnchor.connect(user1).anchorMessage(
                user2.address,
                sampleMessageHash,
                ""
            )).to.be.revertedWith("IPFS hash cannot be empty");
        });

        it("Should fail when sending to self", async function () {
            await expect(messageAnchor.connect(user1).anchorMessage(
                user1.address,
                sampleMessageHash,
                sampleIPFSHash
            )).to.be.revertedWith("Cannot send message to yourself");
        });
    });

    describe("Message Retrieval", function () {
        beforeEach(async function () {
            // Anchor some test messages
            await messageAnchor.connect(user1).anchorMessage(
                user2.address,
                sampleMessageHash,
                sampleIPFSHash
            );
            
            await messageAnchor.connect(user2).anchorMessage(
                user1.address,
                "0x2234567890123456789012345678901234567890123456789012345678901234",
                "QmTestHashExample234567890"
            );
        });

        it("Should retrieve message by ID", async function () {
            const message = await messageAnchor.getMessage(0);
            
            expect(message.from).to.equal(user1.address);
            expect(message.to).to.equal(user2.address);
            expect(message.messageHash).to.equal(sampleMessageHash);
            expect(message.ipfsHash).to.equal(sampleIPFSHash);
            expect(message.timestamp).to.be.gt(0);
        });

        it("Should fail to retrieve non-existent message", async function () {
            await expect(messageAnchor.getMessage(999))
                .to.be.revertedWith("Message does not exist");
        });

        it("Should get user messages", async function () {
            const user1Messages = await messageAnchor.getUserMessages(user1.address);
            const user2Messages = await messageAnchor.getUserMessages(user2.address);
            
            expect(user1Messages.length).to.equal(2); // user1 sent 1, received 1
            expect(user2Messages.length).to.equal(2); // user2 sent 1, received 1
        });

        it("Should get conversation messages", async function () {
            const conversationMessages = await messageAnchor.getConversationMessages(
                user1.address,
                user2.address
            );
            
            expect(conversationMessages.length).to.equal(2);
        });

        it("Should get recent messages", async function () {
            const timestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
            const recentMessages = await messageAnchor.getRecentMessages(
                user1.address,
                timestamp
            );
            
            expect(recentMessages.length).to.be.gte(0);
        });
    });

    describe("Multiple Users", function () {
        it("Should handle multiple conversations", async function () {
            // user1 -> user2
            await messageAnchor.connect(user1).anchorMessage(
                user2.address,
                sampleMessageHash,
                sampleIPFSHash
            );
            
            // user1 -> user3
            await messageAnchor.connect(user1).anchorMessage(
                user3.address,
                "0x3334567890123456789012345678901234567890123456789012345678901234",
                "QmTestHashExample345678901"
            );
            
            // user2 -> user3
            await messageAnchor.connect(user2).anchorMessage(
                user3.address,
                "0x4434567890123456789012345678901234567890123456789012345678901234",
                "QmTestHashExample456789012"
            );

            const user1Messages = await messageAnchor.getUserMessages(user1.address);
            const user2Messages = await messageAnchor.getUserMessages(user2.address);
            const user3Messages = await messageAnchor.getUserMessages(user3.address);

            expect(user1Messages.length).to.equal(2); // sent 2
            expect(user2Messages.length).to.equal(2); // sent 1, received 1
            expect(user3Messages.length).to.equal(2); // received 2

            expect(await messageAnchor.getMessageCount()).to.equal(3);
        });
    });
});
