import React, { useState, useEffect, useCallback } from 'react';
import { ListGroup, Badge, Alert, Button, Card, Form, InputGroup } from 'react-bootstrap';
import { getRegisteredUsers, isUserRegistered } from '../utils/blockchain';

const UserList = ({ account, contracts, selectedRecipient, onSelectRecipient, onError, userMode }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [isCheckingAddress, setIsCheckingAddress] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Get other user's address for quick setup
  const getOtherUserAddress = () => {
    if (userMode === 'user1') {
      return '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // User 2's address
    } else if (userMode === 'user2') {
      return '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // User 1's address
    }
    return null;
  };

  const loadUsers = useCallback(async () => {
    if (!account || !contracts) return;

    setIsLoading(true);
    try {
      console.log('Loading registered users...');
      const registeredUsers = await getRegisteredUsers(contracts, contracts.provider);
      
      // Filter out current user and add additional info
      const otherUsers = registeredUsers
        .filter(user => user.address.toLowerCase() !== account.toLowerCase())
        .map(user => ({
          ...user,
          displayName: `User ${user.address.slice(0, 6)}`,
          isOnline: Math.random() > 0.5, // Placeholder for online status
          lastSeen: new Date(Date.now() - Math.random() * 86400000) // Random last seen within 24h
        }));
      
      console.log('Loaded users:', otherUsers.length);
      setUsers(otherUsers);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Failed to load users:', error);
      
      // Show some hardcoded users for development/testing
      if (contracts) {
        const hardcodedUsers = [
          {
            address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            displayName: 'Test User 1',
            publicKey: '0x04abcd...',
            registeredAt: new Date(Date.now() - 3600000),
            isOnline: true,
            lastSeen: new Date()
          },
          {
            address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            displayName: 'Test User 2',
            publicKey: '0x04efgh...',
            registeredAt: new Date(Date.now() - 7200000),
            isOnline: false,
            lastSeen: new Date(Date.now() - 1800000)
          },
          {
            address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            displayName: 'Test User 3',
            publicKey: '0x04ijkl...',
            registeredAt: new Date(Date.now() - 10800000),
            isOnline: true,
            lastSeen: new Date()
          }
        ].filter(user => user.address.toLowerCase() !== account.toLowerCase());
        
        setUsers(hardcodedUsers);
      }
    } finally {
      setIsLoading(false);
    }
  }, [account, contracts]);
  const addCustomUser = async (address = null) => {
    const targetAddress = address || customAddress.trim();
    
    if (!targetAddress) {
      onError('Please enter a valid address');
      return;
    }

    // Basic address validation
    if (!targetAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      onError('Please enter a valid Ethereum address');
      return;
    }

    if (targetAddress.toLowerCase() === account.toLowerCase()) {
      onError('Cannot add your own address');
      return;
    }

    // Check if user already exists in list
    const existingUser = users.find(user => 
      user.address.toLowerCase() === targetAddress.toLowerCase()
    );
    
    if (existingUser) {
      onSelectRecipient(targetAddress);
      if (!address) setCustomAddress('');
      return;
    }

    setIsCheckingAddress(true);    try {
      // Check if address is registered on blockchain
      const registered = await isUserRegistered(contracts, targetAddress);
      
      if (registered) {
        // Add to user list
        const newUser = {
          address: targetAddress,
          displayName: `User ${targetAddress.slice(0, 6)}`,
          publicKey: 'Loading...',
          registeredAt: new Date(),
          isOnline: false,
          lastSeen: new Date(),
          isCustomAdded: true
        };
        
        setUsers(prev => [...prev, newUser]);
        onSelectRecipient(targetAddress);
        if (!address) setCustomAddress('');
      } else {
        onError('This address has not registered for messaging yet');
      }
    } catch (error) {
      console.error('Failed to check address:', error);
      
      // For development, allow adding any valid address
      const newUser = {
        address: targetAddress,
        displayName: `User ${targetAddress.slice(0, 6)}`,
        publicKey: 'Not verified',
        registeredAt: new Date(),
        isOnline: false,
        lastSeen: new Date(),
        isCustomAdded: true
      };
      
      setUsers(prev => [...prev, newUser]);
      onSelectRecipient(targetAddress);
      if (!address) setCustomAddress('');
    } finally {
      setIsCheckingAddress(false);
    }
  };

  const copyAddressToClipboard = (address) => {
    navigator.clipboard.writeText(address).then(() => {
      // Could add a toast notification here
      console.log('Address copied to clipboard');
    });
  };

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Auto-refresh users every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastUpdate > 30000) {
        loadUsers();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadUsers, lastUpdate]);

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">👥 Users</h5>
        <div>
          <Badge bg="secondary" className="me-2">{users.length}</Badge>
          <Button variant="outline-primary" size="sm" onClick={loadUsers}>
            🔄
          </Button>
        </div>
      </Card.Header>      <Card.Body>
        {/* User-specific quick setup */}
        {userMode && (
          <Card className="mb-3 bg-light">
            <Card.Body className="py-2">
              <div className="small text-muted mb-2">
                <strong>🚀 Quick Setup for {userMode === 'user1' ? 'User 1' : 'User 2'}:</strong>
              </div>
              {userMode === 'user1' && (
                <>
                  <div className="small mb-2">
                    Add User 2 to start messaging:
                  </div>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => addCustomUser(getOtherUserAddress())}
                    disabled={isCheckingAddress}
                    className="w-100"
                  >
                    👥 Add User 2
                  </Button>
                </>
              )}
              {userMode === 'user2' && (
                <>
                  <div className="small mb-2">
                    Add User 1 to start messaging:
                  </div>
                  <Button 
                    variant="success" 
                    size="sm" 
                    onClick={() => addCustomUser(getOtherUserAddress())}
                    disabled={isCheckingAddress}
                    className="w-100"
                  >
                    👤 Add User 1
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Add custom user section */}
        <div className="mb-3">
          <Form.Label className="small">Add user by address:</Form.Label>
          <InputGroup size="sm">
            <Form.Control
              type="text"
              placeholder="0x..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomUser()}
            />
            <Button 
              variant="outline-primary" 
              onClick={() => addCustomUser()}
              disabled={isCheckingAddress || !customAddress.trim()}
            >
              {isCheckingAddress ? '...' : '+'}
            </Button>
          </InputGroup>
        </div>

        {isLoading && (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading users...</span>
            </div>
            <div className="small mt-1">Loading users...</div>
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <Alert variant="light" className="text-center small">
            No other users found.
            <br />
            <small className="text-muted">
              Add a user by address above or wait for others to register.
            </small>
          </Alert>
        )}

        {!isLoading && users.length > 0 && (
          <>
            <div className="mb-2 small text-muted">
              Select a user to start messaging:
            </div>
            
            <ListGroup variant="flush">
              {users.map((user) => (
                <ListGroup.Item
                  key={user.address}
                  action
                  active={selectedRecipient === user.address}
                  onClick={() => onSelectRecipient(user.address)}
                  className="d-flex justify-content-between align-items-start p-2"
                >
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center">
                      <div 
                        className={`rounded-circle me-2 ${
                          user.isOnline ? 'bg-success' : 'bg-secondary'
                        }`}
                        style={{ width: '8px', height: '8px' }}
                      ></div>
                      <div>
                        <div className="small">
                          <strong>{user.displayName}</strong>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {user.address.slice(0, 8)}...{user.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                      {user.isOnline ? (
                        'Online'
                      ) : (
                        `Last seen ${user.lastSeen.toLocaleDateString()}`
                      )}
                      {user.isCustomAdded && (
                        <Badge bg="info" size="sm" className="ms-1">Custom</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="d-flex flex-column align-items-end">
                    {selectedRecipient === user.address && (
                      <Badge bg="primary" className="mb-1">
                        Selected
                      </Badge>
                    )}
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAddressToClipboard(user.address);
                      }}
                      title="Copy address"
                    >
                      📋
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}

        <div className="mt-3 p-2 bg-light rounded">
          <div className="small text-muted">
            <strong>Your Address:</strong>
          </div>
          <div className="small font-monospace">
            {account?.slice(0, 20)}...{account?.slice(-10)}
          </div>
          <Button
            variant="outline-primary"
            size="sm"
            className="mt-1"
            onClick={() => copyAddressToClipboard(account)}
          >
            📋 Copy My Address
          </Button>
        </div>        <div className="mt-2 small text-muted">
          {userMode ? (
            <>
              <strong>Next Steps:</strong><br />
              {userMode === 'user1' ? (
                <>• Add User 2 using the button above<br />
                • Generate your encryption keys<br />
                • Start messaging!</>
              ) : (
                <>• Add User 1 using the button above<br />
                • Generate your encryption keys<br />
                • Reply to User 1's messages!</>
              )}
            </>
          ) : (
            <>
              <strong>Tip:</strong> Share your address so others can message you!
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default UserList;
