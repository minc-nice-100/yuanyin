// ===== ASR Clients =====
// WhisperASRClient: HTTP upload via MediaRecorder
// NativeSpeechClient: browser built-in Web Speech API

class WhisperASRClient {
  constructor(url = 'https://www.project-resonance.net/api/whisper-asr') {
    this.url = url;
    this.stream = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    this.chunks = [];

    this.onResult = null;   // (text: string, isFinal: boolean)
    this.onError = null;    // (errorMessage: string)
    this.onConnect = null;  // ()
    this.onDisconnect = null; // ()
  }

  async start() {
    if (this.isRecording) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        if (this.chunks.length === 0) return;
        const blob = new Blob(this.chunks, { type: mimeType });
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');

        try {
          const resp = await fetch(this.url, { method: 'POST', body: formData });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            if (this.onError) this.onError(`识别服务不可用 (${resp.status})`);
            return;
          }
          if (data.ok === false) {
            if (this.onError) this.onError(data.error || '未识别到语音内容');
            return;
          }
          const text = (data.text || '').trim();
          if (text) {
            if (this.onResult) this.onResult(text, true);
          } else {
            if (this.onError) this.onError('未识别到语音内容');
          }
        } catch (err) {
          console.error('Whisper ASR fetch error:', err);
          if (this.onError) this.onError('网络错误，请检查网络连接');
        } finally {
          this._cleanup();
          if (this.onDisconnect) this.onDisconnect();
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      if (this.onConnect) this.onConnect();
    } catch (e) {
      console.error('Failed to get microphone', e);
      if (this.onError) this.onError('无法获取麦克风权限');
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this._cleanup();
  }

  _cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

class NativeSpeechClient {
  constructor() {
    this.isRecording = false;
    this.recognition = null;

    this.onResult = null;
    this.onError = null;
    this.onConnect = null;
    this.onDisconnect = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'zh-CN';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        this.isRecording = true;
        if (this.onConnect) this.onConnect();
      };

      this.recognition.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        const text = last[0].transcript.trim();
        const isFinal = last.isFinal;
        if (this.onResult) this.onResult(text, isFinal);
      };

      this.recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        let errorMsg = '语音识别失败';
        switch (e.error) {
          case 'not-allowed': errorMsg = '麦克风权限被拒绝'; break;
          case 'no-speech': errorMsg = '未检测到语音'; break;
          case 'network': errorMsg = '网络连接失败'; break;
          case 'aborted': errorMsg = '语音识别被中断'; break;
          case 'audio-capture': errorMsg = '无法访问麦克风'; break;
          default: errorMsg = `识别失败 (${e.error})`;
        }
        if (this.onError) this.onError(errorMsg);
        this.stop();
      };

      this.recognition.onend = () => {
        // Don't call stop() here to avoid recursion
        if (this.onDisconnect) this.onDisconnect();
      };
    }
  }

  async start() {
    if (this.isRecording) return;
    if (!this.recognition) {
      if (this.onError) this.onError('当前浏览器不支持语音识别');
      return;
    }
    try {
      this.recognition.start();
    } catch (e) {
      if (e.name === 'InvalidStateError') {
        this.recognition.stop();
        setTimeout(() => { try { this.recognition.start(); } catch (err) {} }, 100);
      } else {
        if (this.onError) this.onError('启动语音识别失败');
      }
    }
  }

  stop() {
    this.isRecording = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
  }
}

// Expose globally so voice.js can use `new window.WhisperASRClient()`
window.WhisperASRClient = WhisperASRClient;
window.NativeSpeechClient = NativeSpeechClient;
