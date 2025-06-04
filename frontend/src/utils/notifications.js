// Notification utility for the messaging app
// Handles browser notifications and sound alerts

export class NotificationManager {
  constructor() {
    this.permission = 'default';
    this.soundEnabled = true;
    this.init();
  }

  async init() {
    // Request notification permission
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
    }
    
    // Load sound preferences
    const savedSoundPreference = localStorage.getItem('soundEnabled');
    if (savedSoundPreference !== null) {
      this.soundEnabled = JSON.parse(savedSoundPreference);
    }
  }

  // Show browser notification for new message
  showMessageNotification(from, messagePreview, isFile = false) {
    if (this.permission !== 'granted') return;

    const title = `New ${isFile ? 'file' : 'message'} from ${this.formatAddress(from)}`;
    const body = isFile ? '📎 File attachment received' : messagePreview;
    
    const notification = new Notification(title, {
      body: body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'blockchain-message',
      requireInteraction: false,
      silent: !this.soundEnabled
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Handle click to focus app
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  // Play sound for new message
  playNotificationSound() {
    if (!this.soundEnabled) return;

    // Create audio context for notification sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  // Show system notification for new message
  notifyNewMessage(from, content, isFile = false) {
    // Show browser notification
    this.showMessageNotification(from, content, isFile);
    
    // Play sound
    this.playNotificationSound();
    
    // Update document title if page not visible
    if (document.hidden) {
      const originalTitle = document.title;
      document.title = `💬 New message - ${originalTitle}`;
      
      // Reset title when page becomes visible
      const resetTitle = () => {
        document.title = originalTitle;
        document.removeEventListener('visibilitychange', resetTitle);
      };
      document.addEventListener('visibilitychange', resetTitle);
    }
  }

  // Format address for display
  formatAddress(address) {
    if (!address) return 'Unknown';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  // Toggle sound notifications
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('soundEnabled', JSON.stringify(this.soundEnabled));
    return this.soundEnabled;
  }

  // Check if notifications are supported and enabled
  isSupported() {
    return 'Notification' in window && this.permission === 'granted';
  }

  // Get current settings
  getSettings() {
    return {
      permission: this.permission,
      soundEnabled: this.soundEnabled,
      supported: this.isSupported()
    };
  }
}

// Create singleton instance
export const notificationManager = new NotificationManager();
