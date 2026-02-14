import { useNavigate } from 'react-router';
import { useInterview } from '../context/interview-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Clock,
  Target,
  Award,
  Home,
  MessageSquare,
} from 'lucide-react';
import { ThemeToggle } from '../components/theme-toggle';

export default function Feedback() {
  const navigate = useNavigate();
  const { interviewData, feedbackData, resetInterview } = useInterview();

  const handleStartNew = () => {
    resetInterview();
    navigate('/');
  };

  if (!interviewData || !feedbackData) {
    navigate('/');
    return null;
  }

  const overallScore = feedbackData.overall_score || 0;
  const questionCount = feedbackData.question_feedback?.length || 0;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 85) return { label: 'Excellent', variant: 'default' as const };
    if (score >= 70) return { label: 'Good', variant: 'secondary' as const };
    return { label: 'Needs Improvement', variant: 'destructive' as const };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4 py-8">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Award className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-4xl dark:text-white">Interview Complete!</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Here's your performance analysis for{' '}
            <strong className="dark:text-white">{interviewData.jobRole}</strong>
          </p>
        </div>

        {/* Overall Score Card */}
        <Card className="shadow-xl border-2 dark:bg-slate-900/50 dark:border-slate-700">
          <CardHeader className="text-center pb-4">
            <CardTitle className="dark:text-white">Overall Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="relative w-48 h-48">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 80}`}
                    strokeDashoffset={`${2 * Math.PI * 80 * (1 - overallScore / 100)}`}
                    className={getScoreColor(overallScore)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className={`text-5xl ${getScoreColor(overallScore)}`}>
                    {Math.round(overallScore)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">out of 100</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Badge {...getScoreBadge(overallScore)} className="text-lg px-4 py-1">
                {getScoreBadge(overallScore).label}
              </Badge>
            </div>

            {/* Overall Assessment */}
            {feedbackData.overall_assessment && (
              <p className="text-center text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                {feedbackData.overall_assessment}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Target className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <div className="text-2xl dark:text-white">{questionCount}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Questions</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <div className="text-2xl dark:text-white">{Math.round(overallScore)}%</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strengths & Improvements */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengths */}
          {feedbackData.strengths && feedbackData.strengths.length > 0 && (
            <Card className="shadow-xl dark:bg-slate-900/50 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {feedbackData.strengths.map((strength, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-green-500 dark:text-green-400 mt-1 shrink-0">+</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Improvements */}
          {feedbackData.improvements && feedbackData.improvements.length > 0 && (
            <Card className="shadow-xl dark:bg-slate-900/50 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {feedbackData.improvements.map((improvement, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-amber-500 dark:text-amber-400 mt-1 shrink-0">-</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Question-by-Question Feedback */}
        {feedbackData.question_feedback && feedbackData.question_feedback.length > 0 && (
          <Card className="shadow-xl dark:bg-slate-900/50 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="dark:text-white">Question-by-Question Feedback</CardTitle>
              <CardDescription className="dark:text-slate-400">
                Detailed analysis for each interview question
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {feedbackData.question_feedback.map((item, index) => (
                <div key={index} className="space-y-4">
                  {index > 0 && <Separator className="dark:bg-slate-700" />}

                  <div className="space-y-3">
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className="dark:border-slate-600 dark:text-slate-300"
                          >
                            Q{index + 1}
                          </Badge>
                        </div>
                        <p className="text-lg dark:text-white">{item.question}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl ${getScoreColor(item.score)}`}>
                          {Math.round(item.score)}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">/ 100</div>
                      </div>
                    </div>

                    {/* Score Progress */}
                    <Progress value={item.score} className="h-2" />

                    {/* Feedback text */}
                    {item.feedback && (
                      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                        <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button onClick={handleStartNew} size="lg" className="gap-2">
            <Home className="w-4 h-4" />
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
