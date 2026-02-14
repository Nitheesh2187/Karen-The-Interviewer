import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useInterview } from '../context/interview-context';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';

export default function Interview() {
  const navigate = useNavigate();
  const { interviewData, setFeedbackData } = useInterview();
  const [statusMessage, setStatusMessage] = useState('Connecting...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [isReady, setIsReady] = useState(false);

  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const setupSentRef = useRef(false);
  const isReadyRef = useRef(false);

  // --- WAV blob creation for TTS audio playback ---
  const createWavBlob = useCallback((pcmData: ArrayBuffer) => {
    const numChannels = 1;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.byteLength;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  // --- Audio queue playback ---
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAgentSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAgentSpeaking(true);
    const blob = audioQueueRef.current.shift()!;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNextAudio();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      playNextAudio();
    };

    audio.play().catch(() => playNextAudio());
  }, []);

  const queueAudio = useCallback(
    (blob: Blob) => {
      audioQueueRef.current.push(blob);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    },
    [playNextAudio]
  );

  // --- WebSocket message handler ---
  const handleMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'transcript':
          if (data.is_final) {
            setInterimText('');
          } else {
            setInterimText(data.text);
          }
          break;

        case 'agent_response':
          setCurrentQuestion(data.text);
          setQuestionNumber(data.question_number);
          setIsProcessing(false);
          setStatusMessage(`Question ${data.question_number}`);
          if (!isReadyRef.current) {
            isReadyRef.current = true;
            setIsReady(true);
          }
          break;

        case 'feedback':
          setFeedbackData(data.data);
          navigate('/feedback');
          break;

        case 'status':
          setStatusMessage(data.message);
          if (data.message === 'Thinking...') {
            setIsProcessing(true);
          }
          break;

        case 'error':
          setStatusMessage(`Error: ${data.message}`);
          setIsProcessing(false);
          break;
      }
    },
    [navigate, setFeedbackData]
  );

  // --- Audio message handler (TTS) ---
  const handleAudioMessage = useCallback(
    (blob: Blob) => {
      blob.arrayBuffer().then((buffer) => {
        const wavBlob = createWavBlob(buffer);
        queueAudio(wavBlob);
      });
    },
    [createWavBlob, queueAudio]
  );

  // --- WebSocket connection ---
  const {
    connect,
    disconnect,
    sendJson,
    sendAudio,
    status: wsStatus,
  } = useWebSocket({
    onMessage: handleMessage,
    onAudioMessage: handleAudioMessage,
  });

  // --- Audio recording ---
  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onAudioChunk: sendAudio,
  });

  // Connect on mount
  useEffect(() => {
    if (!interviewData) {
      navigate('/');
      return;
    }
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send setup data once WebSocket is connected
  useEffect(() => {
    if (wsStatus === 'connected' && interviewData && !setupSentRef.current) {
      setupSentRef.current = true;
      sendJson({
        type: 'setup',
        job_description: interviewData.jobDescription,
        resume: interviewData.resume,
        role: interviewData.jobRole,
        experience_level: interviewData.experience,
      });
    }
  }, [wsStatus, interviewData, sendJson]);

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleEndCall = () => {
    stopRecording();
    sendJson({ type: 'end_interview' });
    setStatusMessage('Generating feedback...');
  };

  if (!interviewData) {
    return null;
  }

  // Show loading state until first agent response
  if (!isReady) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-center">
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white" />
          </div>
        </motion.div>
        <p className="text-xl text-slate-700 dark:text-slate-300">{statusMessage}</p>
      </div>
    );
  }

  const isUserSpeaking = isRecording && !isAgentSpeaking && !isProcessing;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col relative overflow-hidden">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Main Interview Area */}
      <div className="flex-1 p-4 relative">
        {/* AI Box - Top Left */}
        <motion.div
          className="absolute top-4 left-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/30 dark:to-purple-500/30 rounded-3xl border-2 border-indigo-300 dark:border-indigo-600 backdrop-blur-sm overflow-hidden"
          animate={{
            width: isAgentSpeaking ? '70%' : '28%',
            height: isAgentSpeaking ? '70%' : '35%',
            boxShadow: isAgentSpeaking
              ? '0 20px 60px rgba(99, 102, 241, 0.4)'
              : '0 10px 30px rgba(99, 102, 241, 0.2)',
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <div className="h-full flex flex-col items-center justify-center p-6">
            {/* AI Avatar */}
            <motion.div
              className="relative mb-4"
              animate={{ scale: isAgentSpeaking ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 0.8, repeat: isAgentSpeaking ? Infinity : 0 }}
            >
              <div
                className={`rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center relative overflow-hidden transition-all duration-500 ${
                  isAgentSpeaking ? 'w-28 h-28' : 'w-20 h-20'
                }`}
              >
                <span
                  className={`transition-all duration-500 ${
                    isAgentSpeaking ? 'text-5xl' : 'text-3xl'
                  }`}
                >
                  AI
                </span>

                {/* Speaking Animation Rings */}
                <AnimatePresence>
                  {isAgentSpeaking && (
                    <>
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-full border-4 border-indigo-400"
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 1.8 + i * 0.3, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                          }}
                        />
                      ))}
                    </>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* AI Label */}
            <motion.div className="text-center" animate={{ opacity: isAgentSpeaking ? 1 : 0.7 }}>
              <h3
                className={`text-slate-800 dark:text-white mb-1 transition-all duration-500 ${
                  isAgentSpeaking ? 'text-2xl' : 'text-lg'
                }`}
              >
                AI Interviewer
              </h3>
              <p
                className={`text-indigo-600 dark:text-indigo-300 text-sm ${
                  isAgentSpeaking ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {isAgentSpeaking ? 'Speaking...' : isProcessing ? 'Thinking...' : 'Listening...'}
              </p>
            </motion.div>

            {/* AI Message - Only show when AI is speaking */}
            <AnimatePresence mode="wait">
              {isAgentSpeaking && currentQuestion && (
                <motion.div
                  key={questionNumber}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 w-full"
                >
                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-6 border border-indigo-200 dark:border-indigo-700 max-h-48 overflow-y-auto">
                    <p className="text-slate-800 dark:text-white text-base leading-relaxed">
                      {currentQuestion}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Listening Indicator (when not speaking or processing) */}
            {!isAgentSpeaking && !isProcessing && isUserSpeaking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-1.5 mt-4"
              >
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-6 bg-indigo-400 dark:bg-indigo-500 rounded-full"
                    animate={{
                      scaleY: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* User Box - Bottom Right */}
        <motion.div
          className="absolute bottom-4 right-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/30 dark:to-emerald-500/30 rounded-3xl border-2 border-green-300 dark:border-green-600 backdrop-blur-sm overflow-hidden"
          animate={{
            width: isUserSpeaking ? '70%' : '28%',
            height: isUserSpeaking ? '70%' : '35%',
            boxShadow:
              isUserSpeaking
                ? '0 20px 60px rgba(34, 197, 94, 0.4)'
                : '0 10px 30px rgba(34, 197, 94, 0.2)',
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          <div className="h-full flex flex-col items-center justify-center p-6">
            {/* User Avatar */}
            <motion.div
              className="relative mb-4"
              animate={{ scale: isUserSpeaking ? [1, 1.05, 1] : 1 }}
              transition={{
                duration: 0.8,
                repeat: isUserSpeaking ? Infinity : 0,
              }}
            >
              <div
                className={`rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center relative overflow-hidden transition-all duration-500 ${
                  isUserSpeaking ? 'w-28 h-28' : 'w-20 h-20'
                }`}
              >
                <span
                  className={`text-white transition-all duration-500 ${
                    isUserSpeaking ? 'text-3xl' : 'text-xl'
                  }`}
                >
                  You
                </span>

                {/* Speaking Animation Rings */}
                <AnimatePresence>
                  {isUserSpeaking && (
                    <>
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 rounded-full border-4 border-green-400"
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 1.8 + i * 0.3, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                          }}
                        />
                      ))}
                    </>
                  )}
                </AnimatePresence>

                {/* Muted Overlay */}
                {!isRecording && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <MicOff className="w-10 h-10 text-red-400" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* User Label */}
            <motion.div className="text-center" animate={{ opacity: isUserSpeaking ? 1 : 0.7 }}>
              <h3
                className={`text-slate-800 dark:text-white mb-1 transition-all duration-500 ${
                  isUserSpeaking ? 'text-2xl' : 'text-lg'
                }`}
              >
                You
              </h3>
              <p
                className={`text-green-600 dark:text-green-300 text-sm ${
                  isUserSpeaking ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {!isRecording ? 'Muted' : isUserSpeaking ? 'Speaking...' : 'Listening...'}
              </p>
            </motion.div>

            {/* Interim transcript */}
            {isUserSpeaking && interimText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                className="mt-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-3 border border-green-200 dark:border-green-700 max-h-32 overflow-y-auto"
              >
                <p className="text-sm text-slate-600 dark:text-slate-300 italic">{interimText}</p>
              </motion.div>
            )}

            {/* Speaking Indicator */}
            {isUserSpeaking && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2 mt-6"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-10 bg-green-400 dark:bg-green-500 rounded-full"
                    animate={{
                      scaleY: [0.5, 1.5, 0.5],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-300 dark:border-slate-700">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4">
          {/* Mute/Unmute Button */}
          <Button
            variant="outline"
            size="lg"
            onClick={handleMicToggle}
            disabled={wsStatus !== 'connected'}
            className={`w-16 h-16 rounded-full border-2 transition-all ${
              !isRecording
                ? 'bg-red-500 border-red-400 hover:bg-red-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {!isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          {/* End Call Button */}
          <Button
            size="lg"
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 border-2 border-red-500"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </Button>
        </div>

        {/* Status */}
        <div className="text-center mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {statusMessage} {questionNumber > 0 && `| Question ${questionNumber}`}
          </p>
        </div>
      </div>
    </div>
  );
}
