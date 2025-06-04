import { ethers } from 'ethers';

// Contract ABIs (we'll update these after compilation)
const IDENTITY_REGISTRY_ABI = [
  "function registerKey(bytes memory publicKey) external",
  "function updateKey(bytes memory newPublicKey) external", 
  "function getKey(address user) external view returns (bytes memory)",
  "function isRegistered(address user) external view returns (bool)",
  "function getUserRegistrationStatus(address user) external view returns (bool)",
  "event KeyRegistered(address indexed user, bytes publicKey)",
  "event KeyUpdated(address indexed user, bytes newPublicKey)"
];

const MESSAGE_ANCHOR_ABI = [
  "function anchorMessage(address to, bytes32 messageHash, string memory ipfsHash) external",
  "function getMessageCount() external view returns (uint256)",
  "function getMessage(uint256 messageId) external view returns (tuple(address from, address to, bytes32 messageHash, string ipfsHash, uint256 timestamp))",
  "function getUserMessages(address user) external view returns (uint256[] memory)",
  "function getConversationMessages(address user1, address user2) external view returns (uint256[] memory)",
  "function getRecentMessages(address user, uint256 since) external view returns (uint256[] memory)",
  "event MessageAnchored(uint256 indexed messageId, address indexed from, address indexed to, bytes32 messageHash, string ipfsHash)"
];

// Contract addresses (updated from deployment)
let CONTRACT_ADDRESSES = {
  identityRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  messageAnchor: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
};

// Update contract addresses (called after deployment)
export const updateContractAddresses = (addresses) => {
  CONTRACT_ADDRESSES = { ...addresses };
};

// Initialize contract instances
export const initializeContracts = async (userAccount = null) => {
  try {
    let provider;
    let signer;

    // Always use local Hardhat provider for this application
    // This ensures compatibility with the "Connect as User 1/2" buttons
    provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // If a specific user account is provided, use the appropriate signer
    if (userAccount) {
      // Map user addresses to signer indices
      const HARDHAT_ACCOUNTS = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0 - User 1
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1 - User 2  
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Account #4
        '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // Account #5
        '0x976EA74026E726554dB657fA54763abd0C3a0aa9', // Account #6
        '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', // Account #7
        '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', // Account #8
        '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'  // Account #9
      ];
      
      const accountIndex = HARDHAT_ACCOUNTS.findIndex(acc => 
        acc.toLowerCase() === userAccount.toLowerCase()
      );
      
      if (accountIndex >= 0) {
        signer = provider.getSigner(accountIndex);
        console.log(`🔗 Using Hardhat provider with signer #${accountIndex} for ${userAccount}`);
      } else {
        console.warn(`⚠️ User account ${userAccount} not found in Hardhat accounts, using default signer`);
        signer = provider.getSigner();
      }
    } else {
      signer = provider.getSigner();
      console.log('🔗 Using Hardhat local provider with default signer');
    }

    // Load contract addresses from deployment file or use defaults
    if (!CONTRACT_ADDRESSES.identityRegistry || !CONTRACT_ADDRESSES.messageAnchor) {
      try {
        // Try to import the deployed addresses directly
        const deployedAddresses = require('../contracts/deployedAddresses.json');
        console.log('Successfully loaded deployedAddresses.json:', deployedAddresses);
        updateContractAddresses(deployedAddresses);
      } catch (error) {
        console.warn('Could not load deployedAddresses.json, using default values. Error:', error);
        // Default addresses for common Hardhat deployment
        CONTRACT_ADDRESSES = {
          identityRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          messageAnchor: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
        };
        console.log('Using default contract addresses:', CONTRACT_ADDRESSES);
      }
    } else {
      console.log('Using pre-loaded CONTRACT_ADDRESSES:', CONTRACT_ADDRESSES);
    }

    // ADD THESE LOGS BEFORE CREATING CONTRACTS
    console.log('[initializeContracts] Using IdentityRegistry address:', CONTRACT_ADDRESSES.identityRegistry);
    console.log('[initializeContracts] Using MessageAnchor address:', CONTRACT_ADDRESSES.messageAnchor);

    const identityRegistry = new ethers.Contract(
      CONTRACT_ADDRESSES.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      signer
    );

    const messageAnchor = new ethers.Contract(
      CONTRACT_ADDRESSES.messageAnchor,
      MESSAGE_ANCHOR_ABI,
      signer
    );

    return {
      identityRegistry,
      messageAnchor,
      provider,
      signer
    };
  } catch (error) {
    console.error('Failed to initialize contracts:', error);
    throw error;
  }
};

// Register public key on blockchain
export const registerPublicKey = async (contracts, publicKey) => {
  try {
    const publicKeyBytes = ethers.utils.arrayify(publicKey);
    const tx = await contracts.identityRegistry.registerKey(publicKeyBytes);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Failed to register public key:', error);
    throw error;
  }
};

// Get public key from blockchain
export const getPublicKey = async (contracts, userAddress) => {
  try {
    const publicKeyBytes = await contracts.identityRegistry.getKey(userAddress);
    return ethers.utils.hexlify(publicKeyBytes);
  } catch (error) {
    console.error('Failed to get public key:', error);
    throw error;
  }
};

// Check if user is registered
export const isUserRegistered = async (contracts, userAddress) => {
  try {
    return await contracts.identityRegistry.isRegistered(userAddress);
  } catch (error) {
    console.error('Failed to check user registration:', error);
    return false;
  }
};

// Anchor message on blockchain
export const anchorMessage = async (contracts, recipientAddress, messageHash, ipfsHash) => {
  try {
    const tx = await contracts.messageAnchor.anchorMessage(
      recipientAddress,
      messageHash,
      ipfsHash
    );
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Failed to anchor message:', error);
    throw error;
  }
};

// Get messages for user
export const getUserMessages = async (contracts, userAddress) => {
  // ADD THESE LOGS
  console.log('[getUserMessages] Attempting to fetch messages for user:', userAddress);
  console.log('[getUserMessages] Using MessageAnchor contract at address:', contracts.messageAnchor.address);
  if (!contracts || !contracts.messageAnchor) {
    console.error('[getUserMessages] contracts.messageAnchor is not defined!');
    throw new Error('MessageAnchor contract is not initialized.');
  }
  if (!userAddress) {
    console.error('[getUserMessages] userAddress is undefined or null!');
    throw new Error('userAddress is undefined or null.');
  }
  // END OF ADDED LOGS
  try {
    const messageIds = await contracts.messageAnchor.getUserMessages(userAddress);
    const messages = [];
    
    for (const messageId of messageIds) {
      const message = await contracts.messageAnchor.getMessage(messageId);
      messages.push({
        id: messageId.toString(),
        from: message.from,
        to: message.to,
        messageHash: message.messageHash,
        ipfsHash: message.ipfsHash,
        timestamp: new Date(message.timestamp.toNumber() * 1000)
      });
    }
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to get user messages:', error);
    throw error;
  }
};

// Get conversation messages between two users
export const getConversationMessages = async (contracts, user1Address, user2Address) => {
  try {
    const messageIds = await contracts.messageAnchor.getConversationMessages(user1Address, user2Address);
    const messages = [];
    
    for (const messageId of messageIds) {
      const message = await contracts.messageAnchor.getMessage(messageId);
      messages.push({
        id: messageId.toString(),
        from: message.from,
        to: message.to,
        messageHash: message.messageHash,
        ipfsHash: message.ipfsHash,
        timestamp: new Date(message.timestamp.toNumber() * 1000)
      });
    }
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to get conversation messages:', error);
    throw error;
  }
};

// Listen for new messages
export const listenForNewMessages = (contracts, userAddress, callback) => {
  try {
    const filter = contracts.messageAnchor.filters.MessageAnchored(null, null, userAddress);
    
    contracts.messageAnchor.on(filter, (messageId, from, to, messageHash, ipfsHash, event) => {
      callback({
        id: messageId.toString(),
        from,
        to,
        messageHash,
        ipfsHash,
        timestamp: new Date(),
        transactionHash: event.transactionHash
      });
    });
    
    return () => {
      contracts.messageAnchor.removeAllListeners(filter);
    };
  } catch (error) {
    console.error('Failed to listen for new messages:', error);
    return () => {};
  }
};

// Get all registered users (for UI)
export const getRegisteredUsers = async (contracts, provider) => {
  try {
    // Get all KeyRegistered events
    const filter = contracts.identityRegistry.filters.KeyRegistered();
    const events = await contracts.identityRegistry.queryFilter(filter);
    
    const users = [];
    for (const event of events) {
      const userAddress = event.args.user;
      const publicKey = ethers.utils.hexlify(event.args.publicKey);
      
      // Check if user is still registered (they might have updated their key)
      const isRegistered = await contracts.identityRegistry.isRegistered(userAddress);
      if (isRegistered) {
        users.push({
          address: userAddress,
          publicKey: publicKey,
          registeredAt: new Date(event.blockNumber * 1000) // Approximate
        });
      }
    }
    
    return users;
  } catch (error) {
    console.error('Failed to get registered users:', error);
    return [];
  }
};
