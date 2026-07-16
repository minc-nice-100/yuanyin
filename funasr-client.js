/**
 * FunASR WebSocket Client
 * Captures microphone audio, resamples to 16kHz, and streams to a FunASR server.
 */

class FunASRClient {
  constructor(url = 'ws://127.0.0.1:10095/') {
    this.url = url;
    this.ws = null;
    this.audioContext = null;
    this.stream = null;
    this.processor = null;
    this.isRecording = false;

    // Callbacks
    this.onResult = null; // (text, isFinal)
    this.onError = null;
    this.onConnect = null;
    this.onDisconnect = null;

    this.sampleRate = 16000;
  }

  async start() {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._connectWebSocket();
    } catch (e) {
      console.error('Failed to get microphone', e);
      if (this.onError) this.onError('无法获取麦克风权限');
    }
  }

  stop() {
    this.isRecording = false;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send end chunk
      this.ws.send(JSON.stringify({ is_speaking: false }));
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  _connectWebSocket() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    // 连接超时：3 秒连不上就触发 fallback
    const connectTimeout = setTimeout(() => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        console.warn('FunASR websocket connect timeout');
        this.ws.close();
        if (this.onError) this.onError('语音识别服务连接失败');
      }
    }, 3000);

    this.ws.onopen = () => {
      clearTimeout(connectTimeout);
      console.log('FunASR websocket connected');
      this.isRecording = true;
      if (this.onConnect) this.onConnect();

      // Start message for 2pass online/offline modes
      const startMsg = {
        mode: "2pass",
        chunk_size: [5, 10, 5],
        chunk_interval: 10,
        wav_name: "mic",
        is_speaking: true
      };
      this.ws.send(JSON.stringify(startMsg));

      this._startAudioCapture();
    };

    this.ws.onmessage = (e) => {
      try {
        const res = JSON.parse(e.data);
        // FunASR responses have `text` and `mode` (e.g. 2pass-online, 2pass-offline)
        if (res.text) {
          const isFinal = res.mode === '2pass-offline' || res.mode === 'offline';
          if (this.onResult) {
            this.onResult(res.text, isFinal);
          }
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    this.ws.onerror = (e) => {
      console.error('FunASR websocket error', e);
      if (this.onError) this.onError('语音识别服务连接失败');
      this.stop();
    };

    this.ws.onclose = () => {
      console.log('FunASR websocket closed');
      if (this.onDisconnect) this.onDisconnect();
      this.stop();
    };
  }

  _startAudioCapture() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.sampleRate
    });

    const source = this.audioContext.createMediaStreamSource(this.stream);

    let bufferSize = 2048;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording || this.ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // FunASR expects 16-bit PCM at 16000Hz.
      // We process Float32Array to Int16Array
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      this.ws.send(pcmData.buffer);
    };
  }
}

// Make it globally available
window.FunASRClient = FunASRClient;

/**
 * Native SpeechClient (Fallback)
 * Uses browser's built-in Web Speech API
 */
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
        // 取最后一个结果
        const last = e.results[e.results.length - 1];
        const text = last[0].transcript.trim();
        const isFinal = last.isFinal;
        if (this.onResult) this.onResult(text, isFinal);
      };

      this.recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        let errorMsg = '语音识别失败';

        switch (e.error) {
          case 'not-allowed':
            errorMsg = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
            break;
          case 'no-speech':
            errorMsg = '未检测到语音，请重试';
            break;
          case 'network':
            errorMsg = '网络连接失败，请检查网络后重试';
            break;
          case 'service-not-allowed':
            errorMsg = '语音识别服务不可用，请稍后重试';
            break;
          case 'aborted':
            errorMsg = '语音识别被中断';
            break;
          case 'audio-capture':
            errorMsg = '无法访问麦克风，请检查设备连接';
            break;
          case 'language-not-supported':
            errorMsg = '不支持当前语言';
            break;
          default:
            errorMsg = `语音识别失败 (${e.error})`;
        }

        if (this.onError) this.onError(errorMsg);
        this.stop();
      };

      this.recognition.onend = () => {
        if (this.onDisconnect) this.onDisconnect();
        this.isRecording = false;
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
      console.error(e);
      // 如果是重复启动错误，先停止再重启
      if (e.name === 'InvalidStateError') {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (err) {
            if (this.onError) this.onError('启动语音识别失败');
          }
        }, 100);
      } else {
        if (this.onError) this.onError('启动语音识别失败');
      }
    }
  }

  stop() {
    this.isRecording = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) { /* already stopped */ }
    }
  }
}

window.NativeSpeechClient = NativeSpeechClient;
