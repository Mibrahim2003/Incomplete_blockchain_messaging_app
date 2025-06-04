// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IdentityRegistry
 * @dev Contract for storing user public keys for encryption
 */
contract IdentityRegistry {
    // Mapping from user address to their public key
    mapping(address => bytes) private userPublicKeys;
    
    // Mapping to check if user has registered
    mapping(address => bool) public isRegistered;
    
    // Events
    event KeyRegistered(address indexed user, bytes publicKey);
    event KeyUpdated(address indexed user, bytes newPublicKey);
    
    /**
     * @dev Register user's public key
     * @param publicKey The user's public key for encryption
     */
    function registerKey(bytes memory publicKey) external {
        require(publicKey.length > 0, "Public key cannot be empty");
        require(!isRegistered[msg.sender], "User already registered");
        
        userPublicKeys[msg.sender] = publicKey;
        isRegistered[msg.sender] = true;
        
        emit KeyRegistered(msg.sender, publicKey);
    }
    
    /**
     * @dev Update existing public key
     * @param newPublicKey The new public key
     */
    function updateKey(bytes memory newPublicKey) external {
        require(newPublicKey.length > 0, "Public key cannot be empty");
        require(isRegistered[msg.sender], "User not registered");
        
        userPublicKeys[msg.sender] = newPublicKey;
        
        emit KeyUpdated(msg.sender, newPublicKey);
    }
    
    /**
     * @dev Get public key for a user
     * @param user The address of the user
     * @return The user's public key
     */
    function getKey(address user) external view returns (bytes memory) {
        require(isRegistered[user], "User not registered");
        return userPublicKeys[user];
    }
    
    /**
     * @dev Get all registered users (for UI purposes)
     * This is a view function that can be called off-chain
     */
    function getUserRegistrationStatus(address user) external view returns (bool) {
        return isRegistered[user];
    }
}
