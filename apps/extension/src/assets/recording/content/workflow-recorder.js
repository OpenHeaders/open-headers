/**
 * Content script that bridges the recording widget with the background service.
 *
 * Architecture:
 * - ONE global window message listener, registered exactly once per DOM context.
 * - ONE WorkflowRecorder instance at a time, swapped on re-injection.
 * - All stop requests go to background (single authority) — content script
 *   never initiates state transitions, only relays user actions.
 */

import { call, receive } from '@utils/bridge';

// Browser API reference — used only for non-messaging APIs
// (runtime.getURL, runtime.id). All cross-context messages go through
// the shared bridge: `call` for content → background RPCs, `receive`
// for typed listeners against tab-targeted messages from background.
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function isDeadContextError(error) {
  const msg = error?.message ?? '';
  return (
    msg.includes('context invalidated') ||
    msg.includes('extension context invalidated') ||
    msg.includes('message port closed')
  );
}

class WorkflowRecorder {
  constructor() {
    this.isRecording = false;
    this.recordId = null;
    this.widgetInjected = false;
    this.recorderReady = false;
    this.useWidget = false;
    this.isPreNav = false;
    this.startTime = null;
    this.recorderStarted = false;
    /** @type {Array<() => void>} */
    this.bridgeDisposers = [];

    this.setupExtensionMessageListener();
    void this.notifyBackgroundReady();
  }

  /**
   * Subscribe to the tab-directed messages the background sends via
   * `bridge.tabCall`. Each call wires a single typed listener and returns
   * a disposer so re-injection and pagehide can tear them down cleanly.
   */
  setupExtensionMessageListener() {
    this.bridgeDisposers.push(
      receive('stopRecording', () => {
        this.handleStopRecording();
        return { success: true };
      }),
      receive('recordingStateChanged', (payload) => {
        this.handleStateChange(payload);
        return { success: true };
      }),
    );
  }

  async notifyBackgroundReady() {
    try {
      const response = await call('CONTENT_SCRIPT_READY', {
        payload: { url: window.location.href }
      });

      if (response?.shouldStartRecording) {
        await this.handleStartRecording({
          recordId: response.state?.metadata?.recordingId,
          useWidget: true,
          isPreNav: response.state?.metadata?.isPreNavigation,
          startTime: response.state?.metadata?.startTime
        });
      }
    } catch (error) {
      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Could not notify background:', error);
    }
  }

  // ── Window message handler (called by global listener) ─────────────

  handleWindowMessage(event) {
    if (event.source !== window) return;

    // Widget stop button → relay to background (single authority for stop)
    if (event.data?.type === 'OPEN_HEADERS_RECORDING_WIDGET_STOP') {
      if (!this.isRecording) return;

      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Widget stop button clicked');
      call('STOP_RECORDING_FROM_WIDGET').catch(error => {
        if (!isDeadContextError(error)) {
          console.error(new Date().toISOString(), 'ERROR', '[WorkflowRecorder]', 'Failed to send stop message:', error);
        }
      });
      return;
    }

    // Recorder messages (from injected rrweb recorder)
    if (event.data?.source !== 'open-headers-recorder') return;

    const { type, data, timestamp } = event.data;

    if (type === 'ready') {
      this.recorderReady = true;
      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Recorder ready');

      if (this.isRecording) {
        this.startRecorder();
      }
    } else if (type === 'pong') {
      this.recorderReady = true;
    } else if (this.isRecording && browserAPI.runtime?.id) {
      // Bridge the recorder's raw event into the RECORDING_DATA RPC
      // envelope. Was previously `adaptInjectedEvent` in message-adapter.ts
      // — trivial enough to inline now that every other adapter helper
      // is gone.
      call('RECORDING_DATA', {
        payload: {
          type,
          data,
          timestamp: timestamp ?? Date.now(),
          url: window.location.href,
        },
      }).catch(error => {
        if (!isDeadContextError(error)) {
          console.error(new Date().toISOString(), 'ERROR', '[WorkflowRecorder]', 'Failed to forward event:', error);
        }
      });
    }
  }

  // ── Recording lifecycle ────────────────────────────────────────────

  async handleStartRecording(data) {
    console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Starting recording:', data);

    this.isRecording = true;
    this.recordId = data.recordId;
    this.useWidget = data.useWidget !== false;
    this.isPreNav = data.isPreNav || false;
    this.startTime = data.startTime || Date.now();

    await this.injectScripts();

    if (this.useWidget) {
      await this.injectWidget();
    }

    this.startRecorder();
  }

  handleStopRecording() {
    if (!this.isRecording && !this.widgetInjected) return;
    console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Stopping recording');

    this.isRecording = false;
    this.recordId = null;

    this.stopRecorder();

    if (this.widgetInjected) {
      this.removeWidget();
    }
  }

  handleUpdateWidget(data) {
    window.postMessage({
      source: 'open-headers-content',
      action: 'updateWidget',
      data: data
    }, '*');
  }

  handleStateChange(data) {
    console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'State changed:', data);

    if (data.startTime) {
      this.startTime = data.startTime;
      if (this.widgetInjected) {
        this.handleUpdateWidget({ startTime: data.startTime });
      }
    }

    if (data.state === 'recording' && this.isPreNav) {
      // Transitioned from pre-nav to recording
      this.isPreNav = false;
      this.isRecording = true;
      this.handleUpdateWidget({
        status: 'recording',
        startTime: data.startTime || this.startTime || Date.now()
      });
    } else if (data.state === 'idle' || data.state === 'stopping') {
      this.handleStopRecording();
    } else {
      // Sync recording flag with background state
      this.isRecording = data.isRecording || false;
      this.isPreNav = data.isPreNav || false;
    }
  }

  // ── Script injection ───────────────────────────────────────────────

  async injectScripts() {
    const existingRrweb = document.querySelector('script[data-recorder="rrweb"]');
    const existingRecorder = document.querySelector('script[data-recorder="main"]');

    if (existingRrweb && existingRecorder) {
      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Scripts already injected, triggering re-initialization');
      window.postMessage({
        source: 'open-headers-content',
        action: 'reinitRecorder'
      }, '*');

      await new Promise(resolve => setTimeout(resolve, 100));
      this.recorderReady = false;
      return;
    }

    const target = document.head || document.documentElement;
    if (!target) {
      console.error(new Date().toISOString(), 'ERROR', '[WorkflowRecorder]', 'Cannot inject scripts - no injection target');
      return;
    }

    try {
      const rrwebScript = document.createElement('script');
      rrwebScript.src = browserAPI.runtime.getURL('js/lib/rrweb.js');
      rrwebScript.dataset.recorder = 'rrweb';
      target.appendChild(rrwebScript);

      await new Promise((resolve) => {
        rrwebScript.onload = resolve;
        rrwebScript.onerror = () => {
          console.error(new Date().toISOString(), 'ERROR', '[WorkflowRecorder]', 'Failed to load rrweb');
          resolve();
        };
      });

      const recorderScript = document.createElement('script');
      recorderScript.src = browserAPI.runtime.getURL('js/recording/inject/recorder.js');
      recorderScript.dataset.recorder = 'main';
      target.appendChild(recorderScript);

      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Scripts injected successfully');

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(new Date().toISOString(), 'ERROR', '[WorkflowRecorder]', 'Failed to inject scripts:', error);
    }
  }

  async injectWidget() {
    if (this.widgetInjected) return;

    const widgetScript = document.createElement('script');
    widgetScript.src = browserAPI.runtime.getURL('js/recording/inject/recording-widget.js');
    widgetScript.dataset.recorder = 'widget';

    if (document.head) {
      document.head.appendChild(widgetScript);
    } else if (document.documentElement) {
      document.documentElement.appendChild(widgetScript);
    }

    this.widgetInjected = true;

    setTimeout(() => {
      window.postMessage({
        source: 'open-headers-content',
        action: 'initWidget',
        data: {
          recordId: this.recordId,
          isPreNav: this.isPreNav,
          startTime: this.startTime
        }
      }, '*');
    }, 100);
  }

  removeWidget() {
    window.postMessage({
      source: 'open-headers-content',
      action: 'removeWidget'
    }, '*');
    this.widgetInjected = false;
  }

  startRecorder() {
    if (this.recorderStarted) {
      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Recorder already started');
      return;
    }

    if (!this.recorderReady) {
      console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Recorder not ready yet, will retry...');
      setTimeout(() => {
        if (this.isRecording && !this.recorderStarted) {
          this.startRecorder();
        }
      }, 100);
      return;
    }

    this.recorderStarted = true;

    window.postMessage({
      source: 'open-headers-content',
      action: 'startRecording',
      data: {
        recordId: this.recordId
      }
    }, '*');
  }

  stopRecorder() {
    this.recorderStarted = false;

    window.postMessage({
      source: 'open-headers-content',
      action: 'stopRecording'
    }, '*');
  }

  cleanup() {
    console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Cleaning up...');

    try {
      if (this.isRecording) {
        this.stopRecorder();
      }

      if (this.widgetInjected) {
        this.removeWidget();
      }
    } catch (error) {
      // Silently ignore cleanup errors (page might be unloading)
    }

    // Detach tab-directed bridge listeners so a re-injection doesn't
    // leave orphans handling messages on the defunct instance.
    for (const dispose of this.bridgeDisposers) {
      try {
        dispose();
      } catch {
        // listener already removed — nothing to do
      }
    }
    this.bridgeDisposers = [];

    this.isRecording = false;
    this.recordId = null;
    this.recorderStarted = false;
  }
}

// ── Global listener registration (exactly once per DOM context) ──────
//
// The window message listener is registered ONCE and delegates to the
// current instance via a mutable reference. On re-injection, we swap
// the instance but do NOT add another listener — this is what prevents
// the duplicate STOP_RECORDING_FROM_WIDGET bug.

if (!window.__openHeadersGlobalListenerRegistered) {
  window.__openHeadersGlobalListenerRegistered = true;

  window.addEventListener('message', (event) => {
    const instance = window.__workflowRecorderInstance;
    if (instance) {
      instance.handleWindowMessage(event);
    }
  });

  window.addEventListener('pagehide', () => {
    const instance = window.__workflowRecorderInstance;
    if (instance) {
      instance.cleanup();
    }
  });
}

// ── Instance management ──────────────────────────────────────────────

if (window.__workflowRecorderInstance) {
  console.log(new Date().toISOString(), 'INFO ', '[WorkflowRecorder]', 'Re-injection detected, swapping instance');
  window.__workflowRecorderInstance.cleanup();
}

window.__workflowRecorderInstance = new WorkflowRecorder();
