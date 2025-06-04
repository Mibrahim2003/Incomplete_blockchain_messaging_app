import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Card, Badge, Button, Spinner } from 'react-bootstrap';
import { getUserMessages, getConversationMessages, getPublicKey, listenForNewMessages } from '../utils/blockchain';
import { retrieveFromIPFS } from '../utils/ipfs';
import { decryptMessage } from '../utils/crypto';
import { notificationManager } from '../utils/notifications';

const MessageList = ({ account, contracts, keyPair, selectedRecipient, onError }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [decryptingIds, setDecryptingIds] = useState(new Set());
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Parse message content to handle files
  const parseMessageContent = (content) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.text !== undefined && parsed.file) {
        return {
          text: parsed.text,
          file: parsed.file,
          isFileMessage: true
        };
      }
    } catch (e) {
      // Not JSON, treat as plain text
    }
    return {
      text: content,
      file: null,
      isFileMessage: false
    };
  };

  // Download file from attachment
  const downloadFile = (file) => {
    try {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      onError('Failed to download file: ' + error.message);
    }
  };

  // Load messages from blockchain and decrypt them
  const loadMessages = useCallback(async () => {
    if (!account || !contracts || !keyPair) return;

    setIsLoading(true);
    try {
      let blockchainMessages = [];
      
      if (selectedRecipient) {
        // Load conversation messages
        blockchainMessages = await getConversationMessages(contracts, account, selectedRecipient);
      } else {
        // Load all user messages
        blockchainMessages = await getUserMessages(contracts, account);
      }

      console.log('Loaded blockchain messages:', blockchainMessages.length);

      // Process messages and add decryption state
      const processedMessages = blockchainMessages.map(msg => ({
        ...msg,
        content: null,
        isDecrypted: false,
        isDecrypting: false,
        decryptionError: null
      }));

      setMessages(processedMessages);

      // Start decrypting messages in the background
      processedMessages.forEach(msg => {
        if (msg.ipfsHash) {
          decryptMessage(msg);
        }
      });

    } catch (error) {
      console.error('Failed to load messages:', error);
      onError('Failed to load messages: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [account, contracts, keyPair, selectedRecipient, onError]);

  // Decrypt a single message
  const decryptMessage = async (message) => {
    if (!keyPair || decryptingIds.has(message.id)) return;

    setDecryptingIds(prev => new Set(prev).add(message.id));
    
    try {
      // Get encrypted message from IPFS
      const encryptedContent = await retrieveFromIPFS(message.ipfsHash);
        // Get sender's public key for decryption
      const senderPublicKey = await getPublicKey(contracts, message.from);
      
      // Decrypt the message
      const decryptedContent = decryptMessage(encryptedContent, senderPublicKey, keyPair.privateKey);

      // Update message in state
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, content: decryptedContent, isDecrypted: true, isDecrypting: false }
          : msg
      ));

    } catch (error) {
      console.error('Failed to decrypt message:', error);
      
      // Update message with error state
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { 
              ...msg, 
              content: 'Failed to decrypt message', 
              isDecrypted: false, 
              isDecrypting: false,
              decryptionError: error.message 
            }
          : msg
      ));
    } finally {
      setDecryptingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.id);
        return newSet;
      });
    }
  };

  // Retry decryption for failed messages
  const retryDecryption = (message) => {
    setMessages(prev => prev.map(msg => 
      msg.id === message.id 
        ? { ...msg, decryptionError: null, isDecrypting: true }
        : msg
    ));
    decryptMessage(message);
  };

  // Effect to load messages when dependencies change
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Effect to listen for new messages
  useEffect(() => {
    if (!account || !contracts) return;

    console.log('Setting up message listener for:', account);
    
    const cleanup = listenForNewMessages(contracts, account, (newMessage) => {
      console.log('New message received:', newMessage);
      setLastUpdate(Date.now());
      
      // Add new message to list
      const processedMessage = {
        ...newMessage,
        content: null,
        isDecrypted: false,
        isDecrypting: false,
        decryptionError: null
      };
      
      setMessages(prev => {
        // Check if message already exists
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) return prev;
        
        return [...prev, processedMessage];
      });
        // Start decrypting the new message
      if (newMessage.ipfsHash) {
        setTimeout(() => {
          decryptMessage(processedMessage);
          
          // Show notification for new message (only if not from current user)
          if (newMessage.from !== account) {
            // Wait for decryption to complete before showing notification
            setTimeout(() => {
              const messageContent = processedMessage.content || 'New encrypted message';
              const parsed = parseMessageContent(messageContent);
              notificationManager.notifyNewMessage(
                newMessage.from, 
                parsed.text || 'File attachment', 
                parsed.isFileMessage
              );
            }, 1000);
          }
        }, 100);
      }
    });

    return cleanup;
  }, [account, contracts, keyPair]);

  // Effect to refresh messages periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastUpdate > 30000) { // Refresh every 30 seconds if no recent activity
        loadMessages();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadMessages, lastUpdate]);

  // Listen for manual refresh events
  useEffect(() => {
    const handleRefresh = () => {
      loadMessages();
    };

    window.addEventListener('messageListRefresh', handleRefresh);
    return () => window.removeEventListener('messageListRefresh', handleRefresh);
  }, [loadMessages]);

  if (!keyPair) {
    return (
      <Alert variant="info" className="text-center">
        Generate encryption keys to view messages
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading messages...</span>
        </Spinner>
        <div className="mt-2">Loading messages...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <Alert variant="light" className="text-center">
        {selectedRecipient 
          ? `No messages with ${selectedRecipient.slice(0, 8)}...${selectedRecipient.slice(-6)}`
          : 'No messages yet. Start a conversation!'
        }
        <div className="mt-2">
          <Button variant="outline-primary" size="sm" onClick={loadMessages}>
            Refresh
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">💬 Messages</h5>
        <div>
          <Badge bg="secondary" className="me-2">{messages.length}</Badge>
          <Button variant="outline-primary" size="sm" onClick={loadMessages}>
            🔄 Refresh
          </Button>
        </div>
      </Card.Header>
      <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <div className="message-list">
          {messages
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map((message) => (
            <div 
              key={message.id} 
              className={`message-item p-3 mb-3 rounded ${
                message.from === account 
                  ? 'bg-primary text-white ms-4' 
                  : 'bg-light me-4'
              }`}
            >
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="small">
                  <strong>
                    {message.from === account 
                      ? 'You' 
                      : `${message.from.slice(0, 8)}...${message.from.slice(-6)}`
                    }
                  </strong>
                </div>
                <div className="small text-muted">
                  {new Date(message.timestamp).toLocaleString()}
                </div>
              </div>
                <div className="message-content">
                {message.isDecrypted ? (
                  <div>
                    {(() => {
                      const parsed = parseMessageContent(message.content);
                      return (
                        <div>
                          {parsed.text && <div className="mb-2">{parsed.text}</div>}
                          {parsed.file && (
                            <div className="file-attachment p-2 rounded bg-white bg-opacity-25">
                              <div className="d-flex align-items-center justify-content-between">
                                <div>
                                  <div className="fw-bold">📎 {parsed.file.name}</div>
                                  <div className="small text-muted">
                                    {(parsed.file.size / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm"
                                  onClick={() => downloadFile(parsed.file)}
                                >
                                  📥 Download
                                </Button>
                              </div>
                              {parsed.file.type.startsWith('image/') && (
                                <div className="mt-2">
                                  <img 
                                    src={parsed.file.data} 
                                    alt={parsed.file.name}
                                    className="img-fluid rounded"
                                    style={{ maxHeight: '200px', maxWidth: '100%' }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : message.isDecrypting || decryptingIds.has(message.id) ? (
                  <div className="d-flex align-items-center">
                    <Spinner size="sm" className="me-2" />
                    <em>Decrypting message...</em>
                  </div>
                ) : message.decryptionError ? (
                  <div>
                    <div className="text-danger small mb-1">
                      ⚠️ Decryption failed
                    </div>
                    <Button 
                      variant="outline-light" 
                      size="sm" 
                      onClick={() => retryDecryption(message)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div>
                    <em>🔒 Encrypted message</em>
                    <Button 
                      variant="outline-light" 
                      size="sm" 
                      className="ms-2"
                      onClick={() => decryptMessage(message)}
                    >
                      Decrypt
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="small mt-2 opacity-75">
                <div>IPFS: {message.ipfsHash.slice(0, 12)}...</div>
                <div>TX: {message.id}</div>
              </div>
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
};

export default MessageList;
