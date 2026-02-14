import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onAudioChunk?: (data: ArrayBuffer) => void;
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
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const float32Data = event.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(float32Data.length);
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
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
