import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Row, Col, Alert, Badge, Button } from 'react-bootstrap';

// Components
import WalletConnection from './components/WalletConnection';
import KeyManagement from './components/KeyManagement';
import MessageComposer from './components/MessageComposer';
import MessageList from './components/MessageList';
import UserList from './components/UserList';
import SettingsModal from './components/SettingsModal';

// Utils
import { initializeContracts } from './utils/blockchain';
import { getIPFSStatus, initializeIPFS } from './utils/ipfs';
import { notificationManager } from './utils/notifications';
import { hasStoredKeyPair, loadKeyPair } from './utils/crypto';

function App() {
  const [account, setAccount] = useState('');
  const [contracts, setContracts] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');
  const [keyPair, setKeyPair] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [ipfsStatus, setIpfsStatus] = useState({ connected: false, checking: true });
  const [messageRefreshTrigger, setMessageRefreshTrigger] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [userMode, setUserMode] = useState(null); // 'user1', 'user2', or null
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [keyLoadPrompt, setKeyLoadPrompt] = useState(false);

  // Detect user mode from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    
    if (userParam === '1') {
      setUserMode('user1');
    } else if (userParam === '2') {
      setUserMode('user2');
    }
  }, []);
  // Initialize blockchain contracts
  useEffect(() => {
    const initialize = async () => {
      try {
        if (account) {
          console.log('Initializing contracts for account:', account);
          const contractInstances = await initializeContracts(account);
          setContracts(contractInstances);
          setIsInitialized(true);
          
          // Check if this account has stored keys and no current keyPair
          if (!keyPair && hasStoredKeyPair(account)) {
            setKeyLoadPrompt(true);
          }
        }
      } catch (err) {
        console.error('Failed to initialize contracts:', err);
        setError('Failed to connect to blockchain. Make sure Hardhat node is running.');
      }
    };

    initialize();
  }, [account, keyPair]);

  // Initialize IPFS
  useEffect(() => {
    const checkIPFS = async () => {
      try {
        setIpfsStatus({ connected: false, checking: true });
        await initializeIPFS();
        const status = await getIPFSStatus();
        setIpfsStatus({ ...status, checking: false });
      } catch (error) {
        console.warn('IPFS initialization failed:', error);
        setIpfsStatus({ 
          connected: false, 
          checking: false, 
          error: 'IPFS not available - using fallback storage' 
        });
      }
    };

    checkIPFS();
  }, []);

  const handleAccountChange = (newAccount) => {
    setAccount(newAccount);
    setError('');
    setSelectedRecipient(''); // Clear selected recipient when switching accounts
    setKeyPair(null); // Clear keys when switching accounts
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
    setTimeout(() => setError(''), 10000); // Auto-clear errors after 10 seconds
  };

  const clearError = () => {
    setError('');
  };

  const handleMessageSent = () => {
    // Trigger message refresh
    setMessageRefreshTrigger(prev => prev + 1);
    window.dispatchEvent(new CustomEvent('messageListRefresh'));
  };

  const handleRecipientSelect = (recipient) => {
    setSelectedRecipient(recipient);
    // Auto-refresh messages when selecting a new recipient
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('messageListRefresh'));
    }, 100);
  };

  return (
    <div className="App">
      <Container fluid className="py-4">
        <Row>
          <Col>
            <div className="text-center mb-4">
              <h1>🔐 Blockchain Privacy Messenger</h1>
              <p className="text-muted">
                End-to-end encrypted messaging on the blockchain
              </p>
                {/* Status indicators */}
              <div className="d-flex justify-content-center gap-3 mb-3">
                {userMode && (
                  <Badge bg={userMode === 'user1' ? 'primary' : 'success'} className="px-3">
                    {userMode === 'user1' ? '👤 User 1 Mode' : '👥 User 2 Mode'}
                  </Badge>
                )}
                <Badge bg={isInitialized ? 'success' : 'secondary'}>
                  🔗 {isInitialized ? 'Blockchain Connected' : 'Blockchain Disconnected'}
                </Badge>
                <Badge bg={ipfsStatus.connected ? 'success' : ipfsStatus.checking ? 'warning' : ipfsStatus.fallbackMode ? 'info' : 'secondary'}>
                  📁 {ipfsStatus.checking ? 'IPFS Checking...' : 
                       ipfsStatus.connected ? 'IPFS Connected' : 
                       ipfsStatus.fallbackMode ? 'IPFS Fallback' : 'IPFS Unavailable'}
                </Badge>
                <Badge bg={keyPair ? 'success' : 'secondary'}>
                  🔑 {keyPair ? 'Keys Ready' : 'No Keys'}
                </Badge>
                <Button variant="outline-secondary" size="sm" onClick={() => setShowSettings(true)}>
                  ⚙️ Settings
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {error && (
          <Row className="mb-3">
            <Col>
              <Alert variant="danger" dismissible onClose={clearError}>
                <Alert.Heading>Error</Alert.Heading>
                {error}
              </Alert>
            </Col>
          </Row>
        )}        {!ipfsStatus.connected && !ipfsStatus.checking && (
          <Row className="mb-3">
            <Col>
              <Alert variant={ipfsStatus.fallbackMode ? "info" : "warning"}>
                <Alert.Heading>
                  {ipfsStatus.fallbackMode ? "📁 IPFS Fallback Mode" : "⚠️ IPFS Notice"}
                </Alert.Heading>
                {ipfsStatus.fallbackMode ? (
                  <>
                    The app is running in fallback mode with local storage backup. 
                    Messages will still work but won't persist across browser sessions or devices.
                    <br />
                    <small className="mt-2 d-block">
                      <strong>Current storage:</strong> {ipfsStatus.nodeType}
                    </small>
                  </>
                ) : (
                  <>
                    IPFS is not available. Messages will use fallback storage which may be less reliable.
                    <br />
                    <small>To use IPFS: Install IPFS Desktop or run a local IPFS node on port 5001.</small>
                  </>                )}
              </Alert>
            </Col>
          </Row>
        )}

        {keyLoadPrompt && account && (
          <Row className="mb-3">
            <Col>
              <Alert variant="info" className="d-flex justify-content-between align-items-center">
                <div>
                  <Alert.Heading>🔑 Existing Keys Found</Alert.Heading>
                  This account has previously saved encryption keys. Would you like to load them?
                </div>
                <div>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="me-2"
                    onClick={() => {
                      setKeyLoadPrompt(false);
                      // The KeyManagement component will handle the actual loading
                    }}
                  >
                    Load Keys
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={() => setKeyLoadPrompt(false)}
                  >
                    Skip
                  </Button>
                </div>
              </Alert>
            </Col>
          </Row>
        )}

        <Row>
          {/* Left Column - Connection & Keys */}
          <Col lg={3} className="mb-4">
            <div className="card h-100">
              <div className="card-header">
                <h5>🔗 Connection</h5>
              </div>
              <div className="card-body">                <WalletConnection 
                  onAccountChange={handleAccountChange}
                  onError={handleError}
                  userMode={userMode}
                  autoConnectAttempted={autoConnectAttempted}
                  setAutoConnectAttempted={setAutoConnectAttempted}
                />
                
                {account && isInitialized && (
                  <div className="mt-3">
                    <KeyManagement
                      account={account}
                      contracts={contracts}
                      keyPair={keyPair}
                      setKeyPair={setKeyPair}
                      onError={handleError}
                    />
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* Middle Column - Messages */}
          <Col lg={6} className="mb-4">
            <div className="card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">💬 Messages</h5>
                {selectedRecipient && (
                  <div className="small text-muted">
                    with {selectedRecipient.slice(0, 8)}...{selectedRecipient.slice(-6)}
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      className="ms-2"
                      onClick={() => setSelectedRecipient('')}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
              <div className="card-body d-flex flex-column">
                {account && isInitialized && keyPair ? (
                  <>
                    <div className="flex-grow-1 mb-3" style={{ minHeight: '300px', maxHeight: '400px', overflowY: 'auto' }}>
                      <MessageList
                        key={`${selectedRecipient}-${messageRefreshTrigger}`}
                        account={account}
                        contracts={contracts}
                        keyPair={keyPair}
                        selectedRecipient={selectedRecipient}
                        onError={handleError}
                      />
                    </div>
                    
                    <div className="mt-auto">
                      <MessageComposer
                        selectedRecipient={selectedRecipient}
                        onSendMessage={handleMessageSent}
                        contracts={contracts}
                        keyPair={keyPair}
                        account={account}
                        onError={handleError}
                        onMessageSent={handleMessageSent}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted py-5 d-flex flex-column justify-content-center">
                    <div className="mb-3">
                      {!account ? '🔌 Please connect your wallet' : 
                       !isInitialized ? '⏳ Initializing blockchain connection...' : 
                       '🔑 Please generate or import your encryption keys'}
                    </div>
                    {!account && (
                      <small className="text-muted">
                        Connect a Hardhat account to get started
                      </small>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* Right Column - Users */}
          <Col lg={3} className="mb-4">
            {account && isInitialized ? (              <UserList
                account={account}
                contracts={contracts}
                selectedRecipient={selectedRecipient}
                onSelectRecipient={handleRecipientSelect}
                onError={handleError}
                userMode={userMode}
              />
            ) : (
              <div className="card h-100">
                <div className="card-header">
                  <h5>👥 Users</h5>
                </div>
                <div className="card-body">
                  <div className="text-center text-muted">
                    Connect wallet to see users
                  </div>
                </div>
              </div>
            )}
          </Col>
        </Row>

        {/* Footer with info */}
        <Row className="mt-4">
          <Col>
            <div className="text-center">
              <div className="row">
                <div className="col-md-4 mb-2">
                  <div className="p-3 bg-light rounded">
                    <strong>🛡️ Security</strong>
                    <br />
                    <small>End-to-end encrypted messages</small>
                  </div>
                </div>                <div className="col-md-4 mb-2">
                  <div className="p-3 bg-light rounded">
                    <strong>📁 Storage</strong>
                    <br />
                    <small>
                      {ipfsStatus.connected ? 'Decentralized IPFS storage' :
                       ipfsStatus.fallbackMode ? 'Local fallback storage' : 'Checking storage...'}
                    </small>
                  </div>
                </div>
                <div className="col-md-4 mb-2">
                  <div className="p-3 bg-light rounded">
                    <strong>🔗 Blockchain</strong>
                    <br />
                    <small>Message integrity verification</small>
                  </div>
                </div>
              </div>
                <div className="mt-3 text-muted small">
                <p>⚠️ This is a development version - only use on local Hardhat network</p>
                <p>🔧 Make sure Hardhat node is running on localhost:8545</p>
              </div>
            </div>
          </Col>
        </Row>

        {/* Settings Modal */}
        <SettingsModal 
          show={showSettings} 
          onHide={() => setShowSettings(false)}
          ipfsStatus={ipfsStatus}
        />
      </Container>
    </div>
  );
}

export default App;
     