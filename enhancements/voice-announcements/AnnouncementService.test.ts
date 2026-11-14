import AnnouncementService from './AnnouncementService';

/**
 * Test suite for the revised AnnouncementService.
 * The service now:
 *   - Checks user preference first.
 *   - Calls UI fallback only once per announcement.
 *   - Supports multiple fallback callbacks (register/unregister takes the callback).
 */

describe('AnnouncementService', () => {
  const origLocalStorage = (global as any).localStorage;
  const origWindow = (global as any).window;
  const origSpeechSynthesis = (global as any).speechSynthesis;

  beforeEach(() => {
    // Reset UI fallback set (private, but we can clear via new registration calls).
    // We'll reinitialize the service by reloading the module after each test.
    jest.resetModules();
    // Mock localStorage
    const store: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
    };
    // Mock window & speechSynthesis
    const utterances: any[] = [];
    (global as any).window = {};
    (global as any).speechSynthesis = {
      speak: jest.fn((utt) => {
        utterances.push(utt);
      }),
      getVoices: jest.fn(() => [
        { lang: 'en', name: 'English Voice' },
        { lang: 'ml', name: 'Malayalam Voice' },
      ]),
    };
    // Mock SpeechSynthesisUtterance constructor
    (global as any).SpeechSynthesisUtterance = class {
      text: string;
      voice?: any;
      onerror?: (e: any) => void;
      constructor(message: string) { this.text = message; }
    };
  });

  afterEach(() => {
    (global as any).localStorage = origLocalStorage;
    (global as any).window = origWindow;
    (global as any).speechSynthesis = origSpeechSynthesis;
    delete (global as any).SpeechSynthesisUtterance;
  });

  test('disabled preference produces no speech and no fallback', () => {
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(false);
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    AnnouncementService.announce('test');
    expect((global as any).speechSynthesis.speak).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
    AnnouncementService.unregisterUiFallback(fallback);
  });

  test('enabled preference but unsupported browser invokes fallback once', () => {
    // Remove speechSynthesis to simulate unsupported browser
    delete (global as any).speechSynthesis;
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(true);
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    AnnouncementService.announce('no-speech');
    expect(fallback).toHaveBeenCalledTimes(1);
    AnnouncementService.unregisterUiFallback(fallback);
  });

  test('successful speech synthesis when enabled and supported', () => {
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(true);
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    AnnouncementService.announce('hello');
    expect((global as any).speechSynthesis.speak).toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
    AnnouncementService.unregisterUiFallback(fallback);
  });

  test('synchronous error invokes fallback once', () => {
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(true);
    // Force constructor to throw
    (global as any).SpeechSynthesisUtterance = class {
      constructor() { throw new Error('ctor error'); }
    };
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    AnnouncementService.announce('error');
    expect(fallback).toHaveBeenCalledTimes(1);
    AnnouncementService.unregisterUiFallback(fallback);
  });

  test('asynchronous error invokes fallback once per announcement', () => {
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(true);
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    // Mock utterance that triggers onerror after speak
    (global as any).SpeechSynthesisUtterance = class {
      text: string;
      voice?: any;
      onerror?: (e: any) => void;
      constructor(message: string) { this.text = message; }
    };
    // Override speak to invoke onerror immediately
    (global as any).speechSynthesis.speak = jest.fn((utt: any) => {
      if (utt.onerror) utt.onerror(new Event('error'));
    });
    AnnouncementService.announce('async1');
    expect(fallback).toHaveBeenCalledTimes(1);
    // Second announcement should trigger fallback again (separate call)
    AnnouncementService.announce('async2');
    expect(fallback).toHaveBeenCalledTimes(2);
    // Re‑trigger error events on the first utterance should not cause extra calls
    const firstUtter = (global as any).speechSynthesis.speak.mock.calls[0][0];
    if (firstUtter.onerror) firstUtter.onerror(new Event('error'));
    expect(fallback).toHaveBeenCalledTimes(2);
    AnnouncementService.unregisterUiFallback(fallback);
  });

  test('Malayalam voice is selected when message contains Malayalam characters', () => {
    const { AnnouncementService } = require('./AnnouncementService');
    AnnouncementService.setEnabled(true);
    const fallback = jest.fn();
    AnnouncementService.registerUiFallback(fallback);
    AnnouncementService.announce('\u0D15'); // Malayalam Ka
    const utter = (global as any).speechSynthesis.speak.mock.calls[0][0];
    expect(utter.voice?.lang?.startsWith('ml')).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    AnnouncementService.unregisterUiFallback(fallback);
  });
});
