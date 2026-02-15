import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onAudioChunk?: (data: ArrayBuffer) => void;
}

const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsample audio from the source sample rate to the target sample rate.
 * Browsers often ignore our requested sampleRate and use the system default
 * (typically 44100 or 48000). Deepgram expects 16kHz, so we must downsample.
 */
function downsampleAndConvert(float32Data: Float32Array, sourceSampleRate: number): Int16Array {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) {
    // No downsampling needed, just convert Float32 → Int16
    const int16Data = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Data;
  }

  // Calculate how many output samples we'll have
  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(float32Data.length / ratio);
  const int16Data = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    // Pick the nearest sample from the source
    const srcIndex = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, float32Data[srcIndex]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return int16Data;
}

export function useAudioRecorder({ onAudioChunk }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Don't force sampleRate - let the browser use its native rate.
      // We'll downsample in the processor callback.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const actualSampleRate = audioContext.sampleRate;
      console.log(`AudioContext sampleRate: ${actualSampleRate} (target: ${TARGET_SAMPLE_RATE})`);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);
        const int16Data = downsampleAndConvert(float32Data, actualSampleRate);
        onAudioChunk?.(int16Data.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      setPermissionDenied(false);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      if (error.name === 'NotAllowedError') {
        setPermissionDenied(true);
      }
    }
  }, [onAudioChunk]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, permissionDenied, startRecording, stopRecording };
}
