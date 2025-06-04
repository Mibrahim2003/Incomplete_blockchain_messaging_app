import React, { useState, useEffect } from 'react';
import { Button, Alert, Modal, Form, Badge } from 'react-bootstrap';
import { 
  generateKeyPair, 
  saveKeyPair, 
  loadKeyPair, 
  hasStoredKeyPair, 
  clearStoredKeyPair,
  validateKeyPair,
  exportKeyPair,
  importKeyPair
} from '../utils/crypto';
import { registerPublicKey, isUserRegistered } from '../utils/blockchain';

const KeyManagement = ({ account, contracts, keyPair, setKeyPair, onError }) => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [password, setPassword] = useState('');
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [hasStored, setHasStored] = useState(false);
  useEffect(() => {
    checkRegistrationStatus();
    setHasStored(hasStoredKeyPair(account));
  }, [account, contracts]);

  const checkRegistrationStatus = async () => {
    if (account && contracts) {
      try {
        const registered = await isUserRegistered(contracts, account);
        setIsRegistered(registered);
      } catch (error) {
        console.error('Failed to check registration status:', error);
      }
    }
  };

  const handleGenerateKeys = async () => {
    try {
      setIsLoading(true);
      const newKeyPair = generateKeyPair();
      setKeyPair(newKeyPair);
      
      // Auto-register on blockchain
      await registerOnBlockchain(newKeyPair);
    } catch (error) {
      console.error('Failed to generate keys:', error);
      onError('Failed to generate encryption keys: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const registerOnBlockchain = async (keys) => {
    try {
      setIsLoading(true);
      await registerPublicKey(contracts, keys.publicKey);
      setIsRegistered(true);
      
      // Ask user to save keys
      setShowPasswordModal(true);
    } catch (error) {
      console.error('Failed to register on blockchain:', error);
      onError('Failed to register keys on blockchain: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSaveKeys = () => {
    if (!password.trim()) {
      onError('Please enter a password to encrypt your keys');
      return;
    }
    
    try {
      const success = saveKeyPair(keyPair, password, account);
      if (success) {
        setShowPasswordModal(false);
        setPassword('');
        setHasStored(true);
        alert('Keys saved successfully! Make sure to remember your password.');
      } else {
        onError('Failed to save keys to local storage');
      }
    } catch (error) {
      onError('Failed to save keys: ' + error.message);
    }
  };

  const handleLoadKeys = () => {
    if (!password.trim()) {
      onError('Please enter your password');
      return;
    }    try {
      const loadedKeys = loadKeyPair(password, account);
      if (loadedKeys && validateKeyPair(loadedKeys)) {
        setKeyPair(loadedKeys);
        setShowPasswordModal(false);
        setPassword('');
        checkRegistrationStatus();
      } else {
        onError('Invalid password or corrupted key data');
      }
    } catch (error) {
      onError('Failed to load keys: ' + error.message);
    }
  };

  const handleExportKeys = () => {
    try {
      const exported = exportKeyPair(keyPair);
      setExportData(exported);
      setShowExportModal(true);
    } catch (error) {
      onError('Failed to export keys: ' + error.message);
    }
  };

  const handleImportKeys = () => {
    try {
      const imported = importKeyPair(importData);
      if (validateKeyPair(imported)) {
        setKeyPair(imported);
        setImportData('');
        setShowImportModal(false);
        checkRegistrationStatus();
      } else {
        onError('Invalid key data');
      }
    } catch (error) {
      onError('Failed to import keys: ' + error.message);
    }
  };

  const handleClearKeys = () => {
    if (window.confirm('Are you sure you want to clear your keys? Make sure you have a backup!')) {
      clearStoredKeyPair();
      setKeyPair(null);
      setHasStored(false);
      setIsRegistered(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      onError('Failed to copy to clipboard');
    });
  };

  if (keyPair) {
    return (
      <div>
        <div className="mb-3">
          <Badge bg={isRegistered ? "success" : "warning"} className="mb-2">
            {isRegistered ? "Registered" : "Not Registered"}
          </Badge>
          <div className="small text-muted">
            <strong>Your Address:</strong><br />
            <code className="small">{keyPair.address}</code>
          </div>
        </div>

        <div className="d-grid gap-2">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={handleExportKeys}
          >
            Export Keys
          </Button>
          
          {hasStored && (
            <Button 
              variant="outline-info" 
              size="sm" 
              onClick={() => setShowPasswordModal(true)}
            >
              Save Keys
            </Button>
          )}
          
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={handleClearKeys}
          >
            Clear Keys
          </Button>
        </div>

        {/* Export Modal */}
        <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Export Keys</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning">
              <strong>⚠️ Keep this safe!</strong> Anyone with this data can read your messages.
            </Alert>
            <Form.Group>
              <Form.Label>Key Data (JSON)</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={exportData}
                readOnly
                className="font-monospace small"
              />
            </Form.Group>
            <div className="mt-2">
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={() => copyToClipboard(exportData)}
              >
                Copy to Clipboard
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Alert variant="info" className="small">
          Generate or import encryption keys to start messaging.
        </Alert>
      </div>

      <div className="d-grid gap-2">
        <Button
          onClick={handleGenerateKeys}
          disabled={isLoading}
          variant="success"
        >
          {isLoading ? 'Generating...' : 'Generate New Keys'}
        </Button>

        {hasStored && (
          <Button
            onClick={() => setShowPasswordModal(true)}
            variant="outline-primary"
          >
            Load Saved Keys
          </Button>
        )}

        <Button
          onClick={() => setShowImportModal(true)}
          variant="outline-secondary"
        >
          Import Keys
        </Button>
      </div>

      {/* Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {keyPair ? 'Save Keys' : 'Load Keys'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to encrypt/decrypt keys"
              onKeyPress={(e) => e.key === 'Enter' && (keyPair ? handleSaveKeys() : handleLoadKeys())}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={keyPair ? handleSaveKeys : handleLoadKeys}
            disabled={!password.trim()}
          >
            {keyPair ? 'Save' : 'Load'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Import Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Import Keys</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Key Data (JSON)</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your exported key data here..."
              className="font-monospace small"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImportModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleImportKeys}
            disabled={!importData.trim()}
          >
            Import
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default KeyManagement;
