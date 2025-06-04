import React, { useState, useEffect } from 'react';
import { Button, Alert, Badge, Dropdown, ButtonGroup, Card } from 'react-bootstrap';
import { ethers } from 'ethers';
import { hasStoredKeyPair } from '../utils/crypto';

const WalletConnection = ({ onAccountChange, onError, userMode, autoConnectAttempted, setAutoConnectAttempted }) => {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [currentUserMode, setCurrentUserMode] = useState(userMode || null);
  const [hasKeys, setHasKeys] = useState(false);

  // Predefined test accounts (first 10 Hardhat accounts)
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
  useEffect(() => {
    checkConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Auto-connect based on user mode from URL
  useEffect(() => {
    if (userMode && !autoConnectAttempted && !account) {
      const userNumber = userMode === 'user1' ? 1 : userMode === 'user2' ? 2 : null;
      if (userNumber) {
        console.log(`Auto-connecting as ${userMode}...`);
        setAutoConnectAttempted(true);
        connectAsUser(userNumber);
      }
    }
  }, [userMode, autoConnectAttempted, account]);

  const checkConnection = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          await updateAccountInfo(accounts[0], provider);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. For local development, you can also use the built-in accounts.');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        await updateAccountInfo(accounts[0], provider);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      onError('Failed to connect wallet: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectToLocalNetwork = async (specificAccount = null) => {
    setIsConnecting(true);
    try {
      // Connect directly to local Hardhat network
      const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
      const accounts = await provider.listAccounts();
      setAvailableAccounts(accounts);
      
      if (accounts.length > 0) {
        const accountToUse = specificAccount || accounts[0];
        await updateAccountInfo(accountToUse, provider);
        
        // Add local network to MetaMask if available
        if (window.ethereum) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x7A69', // 31337 in hex
                chainName: 'Hardhat Local',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['http://localhost:8545'],
              }],
            });
          } catch (addError) {
            console.log('Failed to add network to MetaMask:', addError);
          }
        }
      } else {
        throw new Error('No accounts found. Make sure Hardhat node is running with: npx hardhat node');
      }
    } catch (error) {
      console.error('Error connecting to local network:', error);
      onError('Failed to connect to local Hardhat network: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };
  const connectAsUser = async (userNumber) => {
    const accountIndex = userNumber - 1; // User 1 = index 0, User 2 = index 1
    if (accountIndex >= 0 && accountIndex < HARDHAT_ACCOUNTS.length) {
      setCurrentUserMode(`user${userNumber}`);
      await connectToLocalNetwork(HARDHAT_ACCOUNTS[accountIndex]);
    }
  };

  const updateAccountInfo = async (accountAddress, provider) => {
    try {
      setProvider(provider);
      setAccount(accountAddress);
      
      const balance = await provider.getBalance(accountAddress);
      const balanceInEth = ethers.utils.formatEther(balance);
      setBalance(parseFloat(balanceInEth).toFixed(4));
      
      // Check if the account has stored encryption keys
      const keysExist = await hasStoredKeyPair(accountAddress);
      setHasKeys(keysExist);
      
      onAccountChange(accountAddress);
    } catch (error) {
      console.error('Error updating account info:', error);
      onError('Failed to get account information');
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      checkConnection();
    }
  };

  const handleChainChanged = () => {
    // Reload the page when chain changes
    window.location.reload();
  };
  const disconnect = () => {
    setAccount('');
    setBalance('');
    setProvider(null);
    setCurrentUserMode(null);
    setHasKeys(false);
    onAccountChange('');
  };

  const switchToAccount = async (accountAddress) => {
    try {
      if (provider) {
        await updateAccountInfo(accountAddress, provider);
      }
    } catch (error) {
      console.error('Error switching account:', error);
      onError('Failed to switch account');
    }
  };
  const getUserBadgeVariant = () => {
    if (currentUserMode === 'user1') return 'primary';
    if (currentUserMode === 'user2') return 'success';
    return 'secondary';
  };

  const getUserBadgeText = () => {
    if (currentUserMode === 'user1') return 'User 1';
    if (currentUserMode === 'user2') return 'User 2';
    return 'Connected';
  };

  if (account) {
    const currentAccountIndex = HARDHAT_ACCOUNTS.findIndex(acc => 
      acc.toLowerCase() === account.toLowerCase()
    );

    return (
      <div>
        <div className="mb-3">
          <Badge bg={getUserBadgeVariant()} className="mb-2">
            {getUserBadgeText()}
          </Badge>
          <div className="small text-muted">
            <strong>Account:</strong><br />
            <code className="small">{account.slice(0, 8)}...{account.slice(-6)}</code>
            {currentAccountIndex >= 0 && (
              <div className="text-info">Hardhat Account #{currentAccountIndex}</div>
            )}
          </div>          <div className="small text-muted mt-1">
            <strong>Balance:</strong> {balance} ETH
          </div>
          <div className="small text-muted mt-1">
            <strong>Encryption Keys:</strong> 
            <Badge bg={hasKeys ? 'success' : 'warning'} className="ms-1">
              {hasKeys ? '✓ Available' : '⚠ Not Set'}
            </Badge>
          </div>
        </div>
        
        <div className="d-grid gap-2">          {/* Quick User Switch */}
          <ButtonGroup>
            <Button 
              variant={currentUserMode === 'user1' ? 'primary' : 'outline-primary'}
              size="sm" 
              onClick={() => connectAsUser(1)}
            >
              👤 User 1
            </Button>
            <Button 
              variant={currentUserMode === 'user2' ? 'success' : 'outline-success'}
              size="sm" 
              onClick={() => connectAsUser(2)}
            >
              👥 User 2
            </Button>
          </ButtonGroup>

          {/* Account Dropdown */}
          {availableAccounts.length > 0 && (
            <Dropdown>
              <Dropdown.Toggle variant="outline-info" size="sm">
                Switch Account
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {HARDHAT_ACCOUNTS.slice(0, Math.min(10, availableAccounts.length)).map((acc, index) => (
                  <Dropdown.Item 
                    key={acc}
                    active={acc.toLowerCase() === account.toLowerCase()}
                    onClick={() => switchToAccount(acc)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span>Account #{index}</span>
                      <small className="text-muted">{acc.slice(0, 8)}...{acc.slice(-4)}</small>
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          )}
          
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={disconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3">
        {userMode && !account && (
          <Alert variant="info" className="small">
            🚀 Auto-connecting as {userMode === 'user1' ? 'User 1' : 'User 2'}...
          </Alert>
        )}
        {!userMode && (
          <Alert variant="info" className="small">
            Connect to interact with the blockchain messaging system.
          </Alert>
        )}
      </div>
      
      {/* Quick Connect for Two-User Testing */}
      <Card className="mb-3 bg-light">
        <Card.Body className="py-2">
          <div className="small text-muted mb-2">
            <strong>🚀 Quick Test Setup:</strong>
          </div>
          <ButtonGroup className="w-100">
            <Button
              onClick={() => connectAsUser(1)}
              disabled={isConnecting}
              variant="primary"
              size="sm"
            >
              {isConnecting ? 'Connecting...' : '👤 Connect as User 1'}
            </Button>
            <Button
              onClick={() => connectAsUser(2)}
              disabled={isConnecting}
              variant="success"
              size="sm"
            >
              {isConnecting ? 'Connecting...' : '👥 Connect as User 2'}
            </Button>
          </ButtonGroup>
        </Card.Body>
      </Card>
      
      <div className="d-grid gap-2">
        <Button
          onClick={connectToLocalNetwork}
          disabled={isConnecting}
          variant="outline-primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect to Local Network'}
        </Button>
        
        <Button
          onClick={connectWallet}
          disabled={isConnecting}
          variant="outline-secondary"
        >
          {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
        </Button>
      </div>
      
      <div className="mt-3 small text-muted">
        <strong>For testing:</strong><br />
        • Start Hardhat: <code>npx hardhat node</code><br />
        • Use Quick Test buttons above for easy two-user setup
      </div>
    </div>
  );
};

export default WalletConnection;
