const { ethers } = require("hardhat");

async function main() {
    console.log("Starting deployment...");
    
    // Get the contract factories
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const MessageAnchor = await ethers.getContractFactory("MessageAnchor");
    
    console.log("Deploying IdentityRegistry...");
    const identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.deployed();
    console.log("IdentityRegistry deployed to:", identityRegistry.address);
    
    console.log("Deploying MessageAnchor...");
    const messageAnchor = await MessageAnchor.deploy();
    await messageAnchor.deployed();
    console.log("MessageAnchor deployed to:", messageAnchor.address);
    
    // Save deployment addresses for frontend
    const deploymentInfo = {
        identityRegistry: identityRegistry.address,
        messageAnchor: messageAnchor.address,
        network: "localhost",
        deployedAt: new Date().toISOString()
    };
    
    console.log("\nDeployment completed!");
    console.log("Contract addresses:");
    console.log("- IdentityRegistry:", identityRegistry.address);
    console.log("- MessageAnchor:", messageAnchor.address);
    console.log("\nSave these addresses for your frontend configuration.");
    
    // Optionally save to a file
    const fs = require('fs');
    fs.writeFileSync(
        './frontend/src/contracts/deployedAddresses.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Deployment info saved to frontend/src/contracts/deployedAddresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
