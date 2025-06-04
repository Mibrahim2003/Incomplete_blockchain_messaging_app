import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge } from 'react-bootstrap';
import { notificationManager } from '../utils/notifications';

const SettingsModal = ({ show, onHide }) => {
  const [settings, setSettings] = useState({
    notifications: false,
    sound: true,
    autoRefresh: true,
    darkMode: false
  });
  const [notificationStatus, setNotificationStatus] = useState('');

  useEffect(() => {
    if (show) {
      loadSettings();
    }
  }, [show]);

  const loadSettings = () => {
    const notifSettings = notificationManager.getSettings();
    const savedSettings = {
      notifications: notifSettings.supported,
      sound: notifSettings.soundEnabled,
      autoRefresh: localStorage.getItem('autoRefresh') !== 'false',
      darkMode: localStorage.getItem('darkMode') === 'true'
    };
    setSettings(savedSettings);
  };

  const handleNotificationToggle = async () => {
    if (!settings.notifications) {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings(prev => ({ ...prev, notifications: true }));
        setNotificationStatus('Notifications enabled!');
      } else {
        setNotificationStatus('Notification permission denied');
      }
    } else {
      setSettings(prev => ({ ...prev, notifications: false }));
      setNotificationStatus('Notifications disabled');
    }
  };

  const handleSoundToggle = () => {
    const newSoundEnabled = notificationManager.toggleSound();
    setSettings(prev => ({ ...prev, sound: newSoundEnabled }));
  };

  const handleAutoRefreshToggle = () => {
    const newValue = !settings.autoRefresh;
    localStorage.setItem('autoRefresh', newValue);
    setSettings(prev => ({ ...prev, autoRefresh: newValue }));
  };

  const handleDarkModeToggle = () => {
    const newValue = !settings.darkMode;
    localStorage.setItem('darkMode', newValue);
    setSettings(prev => ({ ...prev, darkMode: newValue }));
    
    // Apply dark mode immediately
    if (newValue) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  const testNotification = () => {
    if (settings.notifications) {
      notificationManager.notifyNewMessage(
        '0x1234567890123456789012345678901234567890',
        'This is a test notification!',
        false
      );
      setNotificationStatus('Test notification sent!');
    } else {
      setNotificationStatus('Enable notifications first');
    }
  };

  const exportKeys = () => {
    const keyPair = localStorage.getItem('keyPair');
    if (keyPair) {
      const blob = new Blob([keyPair], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blockchain-messenger-keys.json';
      a.click();
      URL.revokeObjectURL(url);
      setNotificationStatus('Keys exported successfully!');
    } else {
      setNotificationStatus('No keys found to export');
    }
  };

  const clearAllData = () => {
    if (window.confirm('This will clear all your keys and settings. Are you sure?')) {
      localStorage.clear();
      setNotificationStatus('All data cleared. Please refresh the page.');
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>⚙️ Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {notificationStatus && (
          <Alert variant="info" dismissible onClose={() => setNotificationStatus('')}>
            {notificationStatus}
          </Alert>
        )}

        <div className="row">
          <div className="col-md-6">
            <h5>🔔 Notifications</h5>
            <Form className="mb-4">
              <Form.Check
                type="switch"
                id="notification-switch"
                label="Browser Notifications"
                checked={settings.notifications}
                onChange={handleNotificationToggle}
              />
              <Form.Text className="text-muted">
                Get notified when you receive new messages
              </Form.Text>

              <Form.Check
                type="switch"
                id="sound-switch"
                label="Sound Alerts"
                checked={settings.sound}
                onChange={handleSoundToggle}
                className="mt-3"
              />
              <Form.Text className="text-muted">
                Play sound when messages arrive
              </Form.Text>

              <Button 
                variant="outline-primary" 
                size="sm" 
                className="mt-3"
                onClick={testNotification}
                disabled={!settings.notifications}
              >
                🧪 Test Notification
              </Button>
            </Form>

            <h5>🔄 Auto-Refresh</h5>
            <Form className="mb-4">
              <Form.Check
                type="switch"
                id="refresh-switch"
                label="Auto-refresh Messages"
                checked={settings.autoRefresh}
                onChange={handleAutoRefreshToggle}
              />
              <Form.Text className="text-muted">
                Automatically check for new messages
              </Form.Text>
            </Form>
          </div>

          <div className="col-md-6">
            <h5>🎨 Appearance</h5>
            <Form className="mb-4">
              <Form.Check
                type="switch"
                id="darkmode-switch"
                label="Dark Mode"
                checked={settings.darkMode}
                onChange={handleDarkModeToggle}
              />
              <Form.Text className="text-muted">
                Use dark theme for better night viewing
              </Form.Text>
            </Form>

            <h5>🔐 Data Management</h5>
            <div className="d-grid gap-2">
              <Button variant="outline-success" onClick={exportKeys}>
                📥 Export Keys
              </Button>
              <Button variant="outline-danger" onClick={clearAllData}>
                🗑️ Clear All Data
              </Button>
            </div>
            <small className="text-muted">
              Export your keys for backup or clear all stored data
            </small>
          </div>
        </div>

        <hr />
        
        <h5>📊 App Status</h5>
        <div className="row">
          <div className="col-md-4">
            <Badge bg="success">Blockchain Connected</Badge>
          </div>
          <div className="col-md-4">
            <Badge bg="info">IPFS Ready</Badge>
          </div>
          <div className="col-md-4">
            <Badge bg="warning">Local Network</Badge>
          </div>
        </div>
        
        <div className="mt-3">
          <small className="text-muted">
            <strong>Version:</strong> 1.0.0 | <strong>Network:</strong> Hardhat Local | <strong>Security:</strong> End-to-End Encrypted
          </small>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SettingsModal;
