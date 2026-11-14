// AnnouncementService.ts
// M3 Enhancement: Voice Announcements with per‑announcement fallback handling

class AnnouncementService {
  private static readonly ENABLED_KEY = 'agh_announcement_enabled';

  /** Read the user‑saved preference (true/false). */
  static getUserPreference(): boolean {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(AnnouncementService.ENABLED_KEY);
    return stored === 'true';
  }

  /** Detect whether the browser supports the Web Speech API. */
  static hasSpeechSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /** Convenience: enabled only when both preference and capability are true. */
  static isEnabled(): boolean {
    return AnnouncementService.getUserPreference() && AnnouncementService.hasSpeechSupport();
  }

  /** Persist the user‑chosen flag. */
  static setEnabled(value: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AnnouncementService.ENABLED_KEY, String(value));
    }
  }

  /** UI‑fallback registration. Allows multiple callers but each must unregister its own callback. */
  private static uiFallbacks: Set<(msg: string) => void> = new Set();

  static registerUiFallback(cb: (msg: string) => void): void {
    AnnouncementService.uiFallbacks.add(cb);
  }

  static unregisterUiFallback(cb: (msg: string) => void): void {
    // Remove only the provided callback; other callbacks remain active.
    AnnouncementService.uiFallbacks.delete(cb);
  }

  /**
   * Speak a message.
   *   1. If the user preference is disabled → return silently.
   *   2. If speech synthesis is unsupported → invoke any registered fallback **once**.
   *   3. Otherwise attempt speech synthesis; invoke fallback once on any sync or async error.
   * Malayalam voice is selected when the message contains Malayalam Unicode characters.
   */
  static announce(message: string): void {
    // 1. Preference check – no fallback, no speech.
    if (!AnnouncementService.getUserPreference()) {
      return;
    }

    // 2. Speech support check – fallback if missing.
    if (!AnnouncementService.hasSpeechSupport()) {
      AnnouncementService.uiFallbacks.forEach(cb => cb(message));
      return;
    }

    let fallbackInvoked = false;
    const invokeFallback = () => {
      if (!fallbackInvoked) {
        fallbackInvoked = true;
        AnnouncementService.uiFallbacks.forEach(cb => cb(message));
      }
    };

    try {
      const utter = new SpeechSynthesisUtterance(message);
      // Prefer Malayalam voice when applicable.
      if (/[\u0D00-\u0D7F]/.test(message)) {
        const mlVoice = speechSynthesis.getVoices().find(v => v.lang.startsWith('ml'));
        if (mlVoice) utter.voice = mlVoice;
      }
      // Async error handling – fires if the synthesis engine throws after speak() is called.
      utter.onerror = () => {
        invokeFallback();
      };
      speechSynthesis.speak(utter);
    } catch (e) {
      // Synchronous failure (e.g., constructor throws).
      invokeFallback();
      console.warn('[Announcement] Speech synthesis threw synchronously', e);
    }
  }
}

export default AnnouncementService;
