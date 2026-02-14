import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Github, Globe, Linkedin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/theme-toggle';

const DESCRIPTION =
  'AI-powered mock interview practice. Speak naturally, get real-time feedback, and sharpen your skills before the big day.';
const TYPING_SPEED = 20;

export default function Landing() {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const [showButton, setShowButton] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  useEffect(() => {
    const startDelay = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTypedText(DESCRIPTION.slice(0, i));
        if (i >= DESCRIPTION.length) {
          clearInterval(interval);
          setTimeout(() => setShowButton(true), 400);
          setTimeout(() => setShowLinks(true), 800);
        }
      }, TYPING_SPEED);
      return () => clearInterval(interval);
    }, 800);

    return () => clearTimeout(startDelay);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-4 relative">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-2xl w-full text-center space-y-8">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent leading-tight"
        >
          AI Mock Interview
        </motion.h1>

        <div className="min-h-[80px]">
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed">
            {typedText}
            <span className="text-white animate-pulse">|</span>
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={showButton ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={showButton ? '' : 'opacity-0'}
        >
          <Button
            onClick={() => navigate('/setup')}
            size="lg"
            className="h-14 px-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-full gap-2"
          >
            Try Now
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={showLinks ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className={`flex items-center justify-center gap-6 pt-8 ${showLinks ? '' : 'opacity-0'}`}
        >
          <a
            href="https://github.com/nitheesh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://linkedin.com/in/nitheesh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-white transition-colors"
          >
            <Linkedin className="w-5 h-5" />
          </a>
          <a
            href="https://nitheesh.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-white transition-colors"
          >
            <Globe className="w-5 h-5" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
