import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useInterview } from '../context/interview-context';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';

const preparationMessages = [
  'Analyzing your resume...',
  'Understanding job requirements...',
  'Preparing interview questions...',
  'Setting up interview room...',
];

export default function Preparing() {
  const navigate = useNavigate();
  const { interviewData } = useInterview();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!interviewData) {
      navigate('/');
      return;
    }

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % preparationMessages.length);
    }, 1500);

    // Navigate to interview after 4 seconds
    const navigationTimer = setTimeout(() => {
      navigate('/interview');
    }, 4000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(navigationTimer);
    };
  }, [interviewData, navigate]);

  if (!interviewData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center space-y-8">
        {/* Loading Animation */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="relative"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-white" />
          </div>
        </motion.div>

        {/* Messages */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-xl text-slate-700 dark:text-slate-300"
          >
            {preparationMessages[currentMessageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
