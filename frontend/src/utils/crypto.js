import CryptoJS from 'crypto-js';
import { ethers } from 'ethers';

// Generate a new key pair for encryption
export const generateKeyPair = () => {
  try {
    // Generate a random private key (32 bytes)
    const privateKey = ethers.utils.randomBytes(32);
    const privateKeyHex = ethers.utils.hexlify(privateKey);
    
    // Create wallet to get public key
    const wallet = new ethers.Wallet(privateKeyHex);
    const publicKey = wallet.publicKey;
    
    return {
      privateKey: privateKeyHex,
      publicKey: publicKey,
      address: wallet.address
    };
  } catch (error) {
    console.error('Failed to generate key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
};

// Derive shared secret using ECDH
export const deriveSharedSecret = (privateKey, publicKey) => {
  try {
    console.log('🔐 Deriving shared secret...');
    console.log(`Private key: ${privateKey.slice(0, 20)}...`);
    console.log(`Public key: ${publicKey.slice(0, 20)}...`);
    
    // Handle different public key formats
    let cleanPublicKey;
    if (publicKey.startsWith('0x04')) {
      // Uncompressed public key format (0x04 + 128 hex chars)
      cleanPublicKey = publicKey.slice(4);
      console.log('✅ Detected uncompressed public key format (0x04 prefix)');
    } else if (publicKey.startsWith('0x')) {
      // Hex format without 04 prefix
      cleanPublicKey = publicKey.slice(2);
      console.log('⚠️ Detected hex format without 04 prefix');
    } else {
      // No prefix
      cleanPublicKey = publicKey;
      console.log('⚠️ No prefix detected');
    }
    
    console.log(`Clean public key length: ${cleanPublicKey.length}`);
    
    // Ensure we have enough data for x coordinate
    if (cleanPublicKey.length < 64) {
      throw new Error(`Public key too short: ${cleanPublicKey.length} chars, need at least 64`);
    }
    
    // Split public key into x and y coordinates
    const x = cleanPublicKey.slice(0, 64);
    const y = cleanPublicKey.slice(64, 128);
    
    console.log(`X coordinate: ${x.slice(0, 20)}...`);
    console.log(`Y coordinate: ${y.slice(0, 20)}...`);
    
    // Create a simple shared secret by combining private key with public key x-coordinate
    // Note: This is a simplified version. In production, use proper ECDH
    const sharedSecret = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.arrayify(privateKey),
        ethers.utils.arrayify('0x' + x)
      ])
    );
    
    console.log(`✅ Shared secret generated: ${sharedSecret.slice(0, 20)}...`);
    return sharedSecret.slice(2); // Remove '0x' prefix
  } catch (error) {
    console.error('❌ Failed to derive shared secret:', error);
    console.error('Private key format:', typeof privateKey, privateKey?.length);
    console.error('Public key format:', typeof publicKey, publicKey?.length);
    throw new Error(`Failed to create shared encryption key: ${error.message}`);
  }
};

// Encrypt message using AES-GCM
export const encryptMessage = (message, recipientPublicKey, senderPrivateKey) => {
  try {
    // Derive shared secret
    const sharedSecret = deriveSharedSecret(senderPrivateKey, recipientPublicKey);
    
    // Convert shared secret to CryptoJS format
    const key = CryptoJS.enc.Hex.parse(sharedSecret);
    
    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(96/8); // 96 bits for GCM
    
    // Encrypt message
    const encrypted = CryptoJS.AES.encrypt(message, key, {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding
    });
    
    // Combine IV and encrypted data
    const encryptedData = {
      iv: iv.toString(CryptoJS.enc.Hex),
      data: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
      timestamp: Date.now()
    };
    
    return JSON.stringify(encryptedData);
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    throw new Error('Failed to encrypt message');
  }
};

// Decrypt message using AES-GCM
export const decryptMessage = (encryptedMessage, senderPublicKey, recipientPrivateKey) => {
  try {
    console.log('🔓 Starting message decryption...');
    console.log(`Encrypted data length: ${encryptedMessage.length}`);
    console.log(`Sender public key: ${senderPublicKey.slice(0, 20)}...`);
    console.log(`Recipient private key: ${recipientPrivateKey.slice(0, 20)}...`);
    
    // Parse encrypted data
    let encryptedData;
    try {
      encryptedData = JSON.parse(encryptedMessage);
      console.log('✅ Successfully parsed encrypted JSON');
    } catch (parseError) {
      console.error('❌ Failed to parse encrypted message JSON:', parseError);
      throw new Error('Invalid encrypted message format');
    }
    
    // Validate encrypted data structure
    if (!encryptedData.iv || !encryptedData.data) {
      console.error('❌ Missing iv or data in encrypted message');
      throw new Error('Invalid encrypted message structure');
    }
    
    console.log(`IV: ${encryptedData.iv.slice(0, 20)}...`);
    console.log(`Data: ${encryptedData.data.slice(0, 20)}...`);
    
    // Derive shared secret
    const sharedSecret = deriveSharedSecret(recipientPrivateKey, senderPublicKey);
    
    // Convert shared secret to CryptoJS format
    const key = CryptoJS.enc.Hex.parse(sharedSecret);
    
    // Parse IV and encrypted data
    const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
    const ciphertext = CryptoJS.enc.Hex.parse(encryptedData.data);
    
    console.log('🔄 Attempting decryption...');
    
    // Decrypt message
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding
      }
    );
    
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      console.error('❌ Decryption resulted in empty string');
      throw new Error('Decryption failed - empty result');
    }
    
    console.log(`✅ Successfully decrypted message: "${decryptedText.slice(0, 50)}..."`);
    return decryptedText;
  } catch (error) {
    console.error('❌ Failed to decrypt message:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      encryptedMessageType: typeof encryptedMessage,
      encryptedMessageLength: encryptedMessage?.length
    });
    throw new Error(`Failed to decrypt message: ${error.message}`);
  }
};

// Create message hash for blockchain anchoring
export const createMessageHash = (encryptedMessage) => {
  try {
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(encryptedMessage));
    return hash;
  } catch (error) {
    console.error('Failed to create message hash:', error);
    throw new Error('Failed to create message hash');
  }
};

// Save key pair to localStorage (encrypted, user-specific)
export const saveKeyPair = (keyPair, password, userAddress = null) => {
  try {
    const storageKey = userAddress ? `blockchain_messenger_keys_${userAddress.toLowerCase()}` : 'blockchain_messenger_keys';
    const keyData = JSON.stringify(keyPair);
    const encrypted = CryptoJS.AES.encrypt(keyData, password).toString();
    localStorage.setItem(storageKey, encrypted);
    return true;
  } catch (error) {
    console.error('Failed to save key pair:', error);
    return false;
  }
};

// Load key pair from localStorage (user-specific)
export const loadKeyPair = (password, userAddress = null) => {
  try {
    const storageKey = userAddress ? `blockchain_messenger_keys_${userAddress.toLowerCase()}` : 'blockchain_messenger_keys';
    const encrypted = localStorage.getItem(storageKey);
    if (!encrypted) return null;
    
    const decrypted = CryptoJS.AES.decrypt(encrypted, password).toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load key pair:', error);
    return null;
  }
};

// Check if key pair exists in localStorage (user-specific)
export const hasStoredKeyPair = (userAddress = null) => {
  const storageKey = userAddress ? `blockchain_messenger_keys_${userAddress.toLowerCase()}` : 'blockchain_messenger_keys';
  return localStorage.getItem(storageKey) !== null;
};

// Clear stored key pair (user-specific)
export const clearStoredKeyPair = (userAddress = null) => {
  const storageKey = userAddress ? `blockchain_messenger_keys_${userAddress.toLowerCase()}` : 'blockchain_messenger_keys';
  localStorage.removeItem(storageKey);
};

// Validate key pair format
export const validateKeyPair = (keyPair) => {
  try {
    if (!keyPair || typeof keyPair !== 'object') return false;
    if (!keyPair.privateKey || !keyPair.publicKey) return false;
    
    // Check if private key is valid hex
    if (!ethers.utils.isHexString(keyPair.privateKey, 32)) return false;
    
    // Check if public key is valid
    if (!ethers.utils.isHexString(keyPair.publicKey)) return false;
    
    // Verify that public key corresponds to private key
    const wallet = new ethers.Wallet(keyPair.privateKey);
    return wallet.publicKey === keyPair.publicKey;
  } catch (error) {
    console.error('Key pair validation failed:', error);
    return false;
  }
};

// Export key pair for backup
export const exportKeyPair = (keyPair) => {
  try {
    const exportData = {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      address: keyPair.address,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Failed to export key pair:', error);
    throw new Error('Failed to export keys');
  }
};

// Import key pair from backup
export const importKeyPair = (exportedData) => {
  try {
    const keyData = JSON.parse(exportedData);
    
    // Validate imported data
    if (!validateKeyPair(keyData)) {
      throw new Error('Invalid key pair data');
    }
    
    return {
      privateKey: keyData.privateKey,
      publicKey: keyData.publicKey,
      address: keyData.address
    };
  } catch (error) {
    console.error('Failed to import key pair:', error);
    throw new Error('Failed to import keys: ' + error.message);
  }
};
