import React, { useEffect, useState } from 'react';
import AnnouncementService from './AnnouncementService';

/**
 * Simple toggle UI for voice announcements.
 * - Initializes from the stored user preference (does not overwrite it).
 * - Shows a clear label when the browser lacks speech‑synthesis support.
 * - Labels are plain strings ready for i18n later (no new framework added).
 */
const AnnouncementToggle: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(AnnouncementService.getUserPreference());
  const speechSupported = AnnouncementService.hasSpeechSupport();

  // Keep the service in sync when the toggle changes.
  useEffect(() => {
    AnnouncementService.setEnabled(enabled);
  }, [enabled]);

  const toggle = () => setEnabled(prev => !prev);

  return (
    <div>
      {/* Show unsupported warning if needed */}
      {!speechSupported && (
        <div style={{ color: 'red', marginBottom: '4px' }}>
          Speech synthesis not supported in this browser.
        </div>
      )}
      <button onClick={toggle} style={{ margin: '8px' }}>
        {enabled ? 'Disable' : 'Enable'} Announcements
      </button>
    </div>
  );
};

export default AnnouncementToggle;
