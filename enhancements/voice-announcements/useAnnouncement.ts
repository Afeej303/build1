import { useEffect, useState, useCallback } from 'react';
import AnnouncementService from './AnnouncementService';

/**
 * React hook exposing announcement capabilities.
 * - `enabled` reflects the saved user preference (does NOT depend on speech support).
 * - `setEnabled` updates the stored preference and the hook state.
 * - `announce` forwards to the service; the service handles fallback logic.
 * The hook registers the UI fallback on mount and unregisters on unmount using the same callback,
 * ensuring a component does not accidentally clear another component's fallback.
 */
export const useAnnouncement = () => {
  const [enabled, setEnabledState] = useState<boolean>(AnnouncementService.getUserPreference());

  // Register UI fallback on mount, cleanup on unmount.
  useEffect(() => {
    const fallback = (msg: string) => {
      // Placeholder: log warning; UI component can replace with toast/modal.
      console.warn('[Announcement UI fallback]', msg);
    };
    AnnouncementService.registerUiFallback(fallback);
    return () => {
      AnnouncementService.unregisterUiFallback(fallback);
    };
  }, []);

  const setEnabled = useCallback(
    (value: boolean) => {
      AnnouncementService.setEnabled(value);
      setEnabledState(value);
    },
    []
  );

  const announce = useCallback((message: string) => {
    AnnouncementService.announce(message);
  }, []);

  return { enabled, setEnabled, announce };
};
