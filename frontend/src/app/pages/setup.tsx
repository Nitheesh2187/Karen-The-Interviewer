import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useInterview } from '../context/interview-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Briefcase, FileText, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../components/theme-toggle';

export default function Setup() {
  const navigate = useNavigate();
  const { setInterviewData } = useInterview();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    jobRole: '',
    experience: '',
    jobDescription: '',
    resume: '',
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleStartInterview = () => {
    setInterviewData(formData);
    navigate('/preparing');
  };

  const isStep1Valid = formData.jobRole && formData.experience && formData.jobDescription;
  const isStep2Valid = formData.resume.trim().length > 0;

  const canProceed = step === 1 ? isStep1Valid : step === 2 ? isStep2Valid : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-3xl shadow-2xl dark:bg-slate-900/50 dark:border-slate-700">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Mock Interview
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Practice with AI-powered conversational interviews
            </CardDescription>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    s === step
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-110'
                      : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`w-12 h-1 mx-1 rounded ${
                      s < step ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-600">
            {step === 1 && 'Job Details'}
            {step === 2 && 'Your Resume'}
            {step === 3 && 'Ready to Start'}
          </div>
        </CardHeader>

        <CardContent className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {/* Step 1: Job Details */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="jobRole" className="flex items-center gap-2 text-base">
                    <Briefcase className="w-4 h-4" />
                    Job Role
                  </Label>
                  <Input
                    id="jobRole"
                    placeholder="e.g., Senior Software Engineer, Product Manager..."
                    value={formData.jobRole}
                    onChange={(e) => setFormData({ ...formData, jobRole: e.target.value })}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience" className="text-base">
                    Experience Level
                  </Label>
                  <Select
                    value={formData.experience}
                    onValueChange={(value) => setFormData({ ...formData, experience: value })}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select your experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                      <SelectItem value="mid">Mid Level (2-5 years)</SelectItem>
                      <SelectItem value="senior">Senior Level (5-10 years)</SelectItem>
                      <SelectItem value="lead">Lead/Principal (10+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobDescription" className="text-base">
                    Job Description
                  </Label>
                  <Textarea
                    id="jobDescription"
                    placeholder="Paste the job description for the role you're applying to..."
                    value={formData.jobDescription}
                    onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                    className="min-h-40 resize-y"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Resume */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <Label htmlFor="resume" className="flex items-center gap-2 text-base">
                    <FileText className="w-4 h-4" />
                    Your Resume
                  </Label>
                  <Textarea
                    id="resume"
                    placeholder="Paste your resume content here..."
                    value={formData.resume}
                    onChange={(e) => setFormData({ ...formData, resume: e.target.value })}
                    className="min-h-[300px] resize-y"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Paste your resume text to help the AI understand your background and experience
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Ready to Start */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 py-8"
              >
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full">
                      <Sparkles className="w-16 h-16 text-indigo-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl mb-2">You're All Set!</h3>
                    <p className="text-gray-600">
                      Your AI interviewer is ready to have a natural conversation with you
                    </p>
                  </div>

                  <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                    <CardContent className="p-6 space-y-4">
                      <h4 className="font-medium">Interview Details</h4>
                      <div className="space-y-3 text-sm text-left">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Role:</span>
                          <span className="font-medium">{formData.jobRole}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Experience:</span>
                          <span className="font-medium capitalize">{formData.experience} Level</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Format:</span>
                          <span className="font-medium">Conversational Interview</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3 text-sm text-gray-600">
                    <p>Tip: Speak naturally as you would in a real interview</p>
                    <p>Make sure your microphone is working</p>
                  </div>

                  <Button
                    onClick={handleStartInterview}
                    size="lg"
                    className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    Start Interview
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          {step < 3 && (
            <div className="flex justify-between items-center pt-8 mt-8 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
