// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MessageAnchor
 * @dev Contract for storing message hashes and metadata on blockchain
 */
contract MessageAnchor {
    // Message structure
    struct Message {
        address from;
        address to;
        bytes32 messageHash;
        string ipfsHash;
        uint256 timestamp;
    }
    
    // Array to store all messages
    Message[] public messages;
    
    // Mapping from user address to their message IDs (sent and received)
    mapping(address => uint256[]) public userMessages;
    
    // Events
    event MessageAnchored(
        uint256 indexed messageId,
        address indexed from,
        address indexed to,
        bytes32 messageHash,
        string ipfsHash
    );
    
    /**
     * @dev Anchor a new message on the blockchain
     * @param to The recipient's address
     * @param messageHash The hash of the encrypted message
     * @param ipfsHash The IPFS hash where the encrypted message is stored
     */
    function anchorMessage(
        address to,
        bytes32 messageHash,
        string memory ipfsHash
    ) external {
        require(to != address(0), "Invalid recipient address");
        require(messageHash != bytes32(0), "Invalid message hash");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(to != msg.sender, "Cannot send message to yourself");
        
        // Create new message
        Message memory newMessage = Message({
            from: msg.sender,
            to: to,
            messageHash: messageHash,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp
        });
        
        // Add to messages array
        messages.push(newMessage);
        uint256 messageId = messages.length - 1;
        
        // Add to sender's and recipient's message lists
        userMessages[msg.sender].push(messageId);
        userMessages[to].push(messageId);
        
        emit MessageAnchored(messageId, msg.sender, to, messageHash, ipfsHash);
    }
    
    /**
     * @dev Get total number of messages
     * @return The total count of messages
     */
    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }
    
    /**
     * @dev Get message details by ID
     * @param messageId The ID of the message
     * @return The message struct
     */
    function getMessage(uint256 messageId) external view returns (Message memory) {
        require(messageId < messages.length, "Message does not exist");
        return messages[messageId];
    }
    
    /**
     * @dev Get all message IDs for a user (both sent and received)
     * @param user The user's address
     * @return Array of message IDs
     */
    function getUserMessages(address user) external view returns (uint256[] memory) {
        return userMessages[user];
    }
    
    /**
     * @dev Get messages for a specific conversation between two users
     * @param user1 First user's address
     * @param user2 Second user's address
     * @return Array of message IDs for the conversation
     */
    function getConversationMessages(address user1, address user2) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory user1Messages = userMessages[user1];
        uint256[] memory conversationIds = new uint256[](user1Messages.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < user1Messages.length; i++) {
            Message memory msg = messages[user1Messages[i]];
            if ((msg.from == user1 && msg.to == user2) || 
                (msg.from == user2 && msg.to == user1)) {
                conversationIds[count] = user1Messages[i];
                count++;
            }
        }
        
        // Create properly sized array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = conversationIds[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get the latest messages for a user (for real-time updates)
     * @param user The user's address
     * @param since Timestamp to get messages since
     * @return Array of message IDs
     */
    function getRecentMessages(address user, uint256 since) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory userMsgs = userMessages[user];
        uint256[] memory recentIds = new uint256[](userMsgs.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < userMsgs.length; i++) {
            Message memory msg = messages[userMsgs[i]];
            if (msg.timestamp > since) {
                recentIds[count] = userMsgs[i];
                count++;
            }
        }
        
        // Create properly sized array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = recentIds[i];
        }
        
        return result;
    }
}
