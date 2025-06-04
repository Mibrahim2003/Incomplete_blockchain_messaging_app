const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry", function () {
    let identityRegistry;
    let owner, user1, user2;
    const samplePublicKey = "0x04a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890";

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        identityRegistry = await IdentityRegistry.deploy();
        await identityRegistry.deployed();
    });

    describe("Registration", function () {
        it("Should register a new public key", async function () {
            await expect(identityRegistry.connect(user1).registerKey(samplePublicKey))
                .to.emit(identityRegistry, "KeyRegistered")
                .withArgs(user1.address, samplePublicKey);

            expect(await identityRegistry.isRegistered(user1.address)).to.be.true;
        });

        it("Should fail to register empty public key", async function () {
            await expect(identityRegistry.connect(user1).registerKey("0x"))
                .to.be.revertedWith("Public key cannot be empty");
        });

        it("Should fail to register twice", async function () {
            await identityRegistry.connect(user1).registerKey(samplePublicKey);
            
            await expect(identityRegistry.connect(user1).registerKey(samplePublicKey))
                .to.be.revertedWith("User already registered");
        });
    });

    describe("Key Retrieval", function () {
        beforeEach(async function () {
            await identityRegistry.connect(user1).registerKey(samplePublicKey);
        });

        it("Should return correct public key", async function () {
            const retrievedKey = await identityRegistry.getKey(user1.address);
            expect(retrievedKey).to.equal(samplePublicKey);
        });

        it("Should fail to get key for unregistered user", async function () {
            await expect(identityRegistry.getKey(user2.address))
                .to.be.revertedWith("User not registered");
        });
    });

    describe("Key Update", function () {
        const newPublicKey = "0x04b1c2d3e4f5g6789012345678901234567890123456789012345678901234567890123456789012345678901234567890";

        beforeEach(async function () {
            await identityRegistry.connect(user1).registerKey(samplePublicKey);
        });

        it("Should update existing public key", async function () {
            await expect(identityRegistry.connect(user1).updateKey(newPublicKey))
                .to.emit(identityRegistry, "KeyUpdated")
                .withArgs(user1.address, newPublicKey);

            const retrievedKey = await identityRegistry.getKey(user1.address);
            expect(retrievedKey).to.equal(newPublicKey);
        });

        it("Should fail to update if not registered", async function () {
            await expect(identityRegistry.connect(user2).updateKey(newPublicKey))
                .to.be.revertedWith("User not registered");
        });

        it("Should fail to update with empty key", async function () {
            await expect(identityRegistry.connect(user1).updateKey("0x"))
                .to.be.revertedWith("Public key cannot be empty");
        });
    });
});
