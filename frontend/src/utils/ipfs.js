import { create } from 'ipfs-http-client';

// IPFS configuration with multiple fallback options
const IPFS_CONFIGS = [
  // Try local IPFS node first
  {
    name: 'Local IPFS',
    host: 'localhost',
    port: 5001,
    protocol: 'http',
    timeout: 5000
  },
  // Public gateway fallback (read-only but widely available)
  {
    name: 'Web3.Storage',
    host: 'w3s.link',
    port: 443,
    protocol: 'https',
    timeout: 10000
  }
];

let ipfsClient = null;
let currentConfig = null;
let isConnected = false;

// Initialize IPFS client with fallback support
export const initializeIPFS = async () => {
  if (ipfsClient && isConnected) {
    return ipfsClient;
  }

  for (const config of IPFS_CONFIGS) {
    try {
      console.log(`Trying to connect to ${config.name}...`);
      ipfsClient = create(config);
      
      // Test connection with a short timeout
      const version = await Promise.race([
        ipfsClient.version(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), config.timeout)
        )
      ]);
      
      console.log(`✅ IPFS connected to ${config.name}, version:`, version.version);
      currentConfig = config;
      isConnected = true;
      return ipfsClient;
    } catch (error) {
      console.warn(`❌ Failed to connect to ${config.name}:`, error.message);
      ipfsClient = null;
      isConnected = false;
    }
  }
  
  // If no IPFS connection available, create a fallback client for gateway access only
  console.warn('⚠️ No IPFS node available - using HTTP gateway fallback for reading only');
  ipfsClient = null;
  currentConfig = { name: 'HTTP Gateway Fallback' };
  return null;
};

// Upload encrypted message to IPFS
export const uploadToIPFS = async (encryptedMessage) => {
  try {
    if (!ipfsClient) {
      await initializeIPFS();
    }

    // If we have a working IPFS client, use it
    if (ipfsClient && isConnected) {
      const messageBuffer = Buffer.from(encryptedMessage, 'utf8');
      const result = await ipfsClient.add(messageBuffer, {
        pin: true,
        wrapWithDirectory: false
      });

      console.log('✅ Message uploaded to IPFS:', result.path);
      return result.path;
    } else {
      // No IPFS available - use a fallback approach
      console.warn('⚠️ IPFS upload not available - using content-based hash fallback');
      
      // Create a deterministic hash based on content for fallback
      const hash = await createContentHash(encryptedMessage);
      
      // Store in localStorage as emergency fallback (limited and not persistent)
      try {
        localStorage.setItem(`ipfs_fallback_${hash}`, encryptedMessage);
        console.log('📁 Message stored in local fallback storage:', hash);
      } catch (storageError) {
        console.warn('localStorage fallback failed:', storageError);
      }
      
      return hash;
    }
  } catch (error) {
    console.error('❌ Failed to upload to IPFS:', error);
    
    // Last resort: create hash and store locally
    try {
      const hash = await createContentHash(encryptedMessage);
      localStorage.setItem(`ipfs_fallback_${hash}`, encryptedMessage);
      console.log('📁 Using emergency local storage:', hash);
      return hash;
    } catch (fallbackError) {
      throw new Error('Failed to store message: ' + error.message);
    }
  }
};

// Create a content-based hash for fallback storage
const createContentHash = async (content) => {
  // Simple hash function for fallback (in real app, use crypto.subtle)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string similar to IPFS hash format
  const positiveHash = Math.abs(hash).toString(36);
  return `fallback_${positiveHash}_${Date.now().toString(36)}`;
};

// Retrieve message from IPFS
export const retrieveFromIPFS = async (ipfsHash) => {
  try {
    // Check if this is a fallback hash
    if (ipfsHash.startsWith('fallback_')) {
      console.log('📁 Retrieving from local fallback storage:', ipfsHash);
      const stored = localStorage.getItem(`ipfs_fallback_${ipfsHash}`);
      if (stored) {
        return stored;
      } else {
        throw new Error('Message not found in fallback storage');
      }
    }

    // Try IPFS client first if available
    if (ipfsClient && isConnected) {
      try {
        const chunks = [];
        for await (const chunk of ipfsClient.cat(ipfsHash)) {
          chunks.push(chunk);
        }

        const encryptedMessage = Buffer.concat(chunks).toString('utf8');
        console.log('✅ Message retrieved from IPFS node:', ipfsHash);
        return encryptedMessage;
      } catch (ipfsError) {
        console.warn('IPFS node retrieval failed, trying gateway:', ipfsError);
      }
    }
    
    // Fallback to multiple HTTP gateways
    const gateways = [
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cf-ipfs.com/ipfs/',
      'https://w3s.link/ipfs/'
    ];

    for (const gateway of gateways) {
      try {
        console.log(`🌐 Trying gateway: ${gateway}`);
        const response = await fetch(`${gateway}${ipfsHash}`, {
          timeout: 10000
        });
        
        if (response.ok) {
          const encryptedMessage = await response.text();
          console.log(`✅ Message retrieved from gateway: ${gateway}`);
          return encryptedMessage;
        }
      } catch (gatewayError) {
        console.warn(`Gateway ${gateway} failed:`, gatewayError);
        continue; // Try next gateway
      }
    }
    
    throw new Error('Failed to retrieve message from all sources');
    
  } catch (error) {
    console.error('❌ Failed to retrieve from IPFS:', error);
    throw new Error('Failed to retrieve message: ' + error.message);
  }
};

// Check IPFS connection status
export const getIPFSStatus = async () => {
  try {
    if (!ipfsClient) {
      await initializeIPFS();
    }
    
    if (ipfsClient && isConnected) {
      const peers = await ipfsClient.swarm.peers();
      const version = await ipfsClient.version();
      
      return {
        connected: true,
        version: version.version,
        peerCount: peers.length,
        nodeType: currentConfig?.name || 'unknown',
        fallbackMode: false
      };
    } else {
      return {
        connected: false,
        fallbackMode: true,
        nodeType: 'HTTP Gateway + Local Storage Fallback',
        message: 'IPFS node not available - using fallback storage'
      };
    }
  } catch (error) {
    return {
      connected: false,
      fallbackMode: true,
      error: error.message,
      nodeType: 'Fallback Mode',
      message: 'Using fallback storage due to IPFS connection issues'
    };
  }
};

// Pin content to IPFS (prevent garbage collection)
export const pinContent = async (ipfsHash) => {
  try {
    if (!ipfsClient) {
      await initializeIPFS();
    }
    
    await ipfsClient.pin.add(ipfsHash);
    console.log('Content pinned:', ipfsHash);
    return true;
  } catch (error) {
    console.error('Failed to pin content:', error);
    return false;
  }
};

// Get pinned content list
export const getPinnedContent = async () => {
  try {
    if (!ipfsClient) {
      await initializeIPFS();
    }
    
    const pinned = [];
    for await (const pin of ipfsClient.pin.ls()) {
      pinned.push(pin.cid.toString());
    }
    
    return pinned;
  } catch (error) {
    console.error('Failed to get pinned content:', error);
    return [];
  }
};
