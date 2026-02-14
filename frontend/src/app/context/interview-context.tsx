import { createContext, useContext, useState, ReactNode } from 'react';

export interface InterviewData {
  resume: string;
  jobDescription: string;
  jobRole: string;
  experience: string;
}

export interface InterviewAnswer {
  question: string;
  answer: string;
  duration: number;
}

export interface FeedbackData {
  overall_score: number;
  overall_assessment: string;
  strengths: string[];
  improvements: string[];
  question_feedback: {
    question: string;
    feedback: string;
    score: number;
  }[];
}

interface InterviewContextType {
  interviewData: InterviewData | null;
  setInterviewData: (data: InterviewData) => void;
  answers: InterviewAnswer[];
  addAnswer: (answer: InterviewAnswer) => void;
  feedbackData: FeedbackData | null;
  setFeedbackData: (data: FeedbackData) => void;
  resetInterview: () => void;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export function InterviewProvider({ children }: { children: ReactNode }) {
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);

  const addAnswer = (answer: InterviewAnswer) => {
    setAnswers(prev => [...prev, answer]);
  };

  const resetInterview = () => {
    setInterviewData(null);
    setAnswers([]);
    setFeedbackData(null);
  };

  return (
    <InterviewContext.Provider
      value={{
        interviewData,
        setInterviewData,
        answers,
        addAnswer,
        feedbackData,
        setFeedbackData,
        resetInterview
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within InterviewProvider');
  }
  return context;
}
