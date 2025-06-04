import React, { useState } from 'react';
import { Card, Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import { encryptMessage, createMessageHash } from '../utils/crypto';
import { uploadToIPFS } from '../utils/ipfs';
import { anchorMessage, getPublicKey } from '../utils/blockchain';

const MessageComposer = ({ 
  selectedRecipient, 
  onSendMessage, 
  contracts, 
  keyPair, 
  account,
  onError,
  onMessageSent
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setFilePreview('');
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview('');
  };

  const handleSend = async () => {
    if (!message.trim() && !selectedFile) {
      setError('Please enter a message or select a file');
      return;
    }

    if (!selectedRecipient) {
      setError('Please select a recipient');
      return;
    }

    if (!keyPair) {
      setError('Please generate or load your encryption keys first');
      return;
    }

    if (!contracts) {
      setError('Blockchain connection not available');
      return;
    }

    setSending(true);
    setError('');
    setSuccess('');
    setProgress(0);

    try {
      // Step 1: Get recipient's public key from blockchain
      setProgress(20);
      console.log('Getting recipient public key...');
      const recipientPublicKey = await getPublicKey(contracts, selectedRecipient);
      
      // Step 2: Prepare message content (text + file)
      let messageContent = message;
      if (selectedFile) {
        // Convert file to base64
        const fileData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(selectedFile);
        });
        
        messageContent = JSON.stringify({
          text: message,
          file: {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            data: fileData
          }
        });
      }
      
      // Step 3: Encrypt the message content
      setProgress(40);
      console.log('Encrypting message...');
      const encryptedMessage = encryptMessage(
        messageContent, 
        recipientPublicKey, 
        keyPair.privateKey
      );
      
      // Step 4: Create message hash for blockchain
      setProgress(50);
      console.log('Creating message hash...');
      const messageHash = createMessageHash(encryptedMessage);
      
      // Step 5: Upload encrypted message to IPFS
      setProgress(70);
      console.log('Uploading to IPFS...');
      const ipfsHash = await uploadToIPFS(encryptedMessage);
      
      // Step 6: Anchor message on blockchain
      setProgress(90);
      console.log('Anchoring on blockchain...');
      const tx = await anchorMessage(contracts, selectedRecipient, messageHash, ipfsHash);
      
      // Step 7: Complete
      setProgress(100);
      console.log('Message sent successfully!', {
        txHash: tx.hash,
        ipfsHash,
        messageHash
      });
      
      setSuccess(`${selectedFile ? 'File and message' : 'Message'} sent successfully! Transaction: ${tx.hash.slice(0, 10)}...`);
      
      if (onSendMessage) {
        onSendMessage({
          to: selectedRecipient,
          content: message,
          file: selectedFile ? { name: selectedFile.name, type: selectedFile.type } : null,
          timestamp: new Date(),
          txHash: tx.hash,
          ipfsHash,
          messageHash,
          encrypted: true
        });
      }

      if (onMessageSent) {
        onMessageSent();
      }
      
      setMessage('');
      removeFile();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err) {
      console.error('Failed to send message:', err);
      let errorMessage = 'Failed to send message';
      
      if (err.message.includes('User not registered')) {
        errorMessage = 'Recipient has not registered their public key yet';
      } else if (err.message.includes('IPFS')) {
        errorMessage = 'Failed to store message on IPFS. Please try again.';
      } else if (err.message.includes('transaction')) {
        errorMessage = 'Blockchain transaction failed. Please check your connection.';
      }
      
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setSending(false);
      setProgress(0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!keyPair) {
    return (
      <Alert variant="info" className="text-center">
        Generate encryption keys to send messages
      </Alert>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h5>📝 Compose Message</h5>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
        
        {selectedRecipient && (
          <div className="mb-3">
            <small className="text-muted">
              To: <code>{selectedRecipient.slice(0, 8)}...{selectedRecipient.slice(-6)}</code>
            </small>
          </div>
        )}
        
        {sending && (
          <div className="mb-3">
            <small className="text-muted d-block mb-1">
              {progress < 30 ? 'Getting recipient key...' :
               progress < 50 ? 'Encrypting message...' :
               progress < 70 ? 'Creating hash...' :
               progress < 90 ? 'Uploading to IPFS...' :
               progress < 100 ? 'Anchoring on blockchain...' :
               'Complete!'}
            </small>
            <ProgressBar now={progress} variant="info" />
          </div>
        )}
        
        <Form>
          <Form.Group className="mb-3">
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Type your message here... (Ctrl+Enter to send)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!selectedRecipient || sending}
            />
            <Form.Text className="text-muted">
              Message will be encrypted end-to-end before sending
            </Form.Text>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Attach a file (optional)</Form.Label>
            <Form.Control
              type="file"
              accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              disabled={sending}
            />
            {selectedFile && (
              <div className="mt-2">
                <Alert variant="info" className="d-flex align-items-center">
                  <i className="bi bi-file-earmark-check me-2" style={{ fontSize: '1.2rem' }}></i>
                  File selected: <strong>{selectedFile.name}</strong> 
                  <Button variant="link" className="ms-auto" onClick={removeFile}>
                    <i className="bi bi-x-circle"></i> Remove
                  </Button>
                </Alert>
                
                {filePreview && (
                  <div className="mt-2">
                    <img src={filePreview} alt="File preview" className="img-fluid rounded" />
                  </div>
                )}
              </div>
            )}
          </Form.Group>
          
          <div className="d-grid gap-2">
            <Button 
              variant="primary" 
              onClick={handleSend}
              disabled={!selectedRecipient || (!message.trim() && !selectedFile) || sending}
            >
              {sending ? 'Sending...' : '🔐 Send Encrypted Message'}
            </Button>
          </div>
        </Form>
        
        <div className="mt-3">
          <small className="text-muted">
            <strong>Security:</strong> Messages are encrypted locally before upload to IPFS and blockchain anchoring.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default MessageComposer;
