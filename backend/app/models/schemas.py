from pydantic import BaseModel
from typing import Optional


class InterviewSetup(BaseModel):
    job_description: str
    resume: str
    role: str
    experience_level: str  # "junior", "mid", "senior"


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class FeedbackScore(BaseModel):
    relevance: float
    depth: float
    clarity: float
    technical_accuracy: float


class QuestionFeedback(BaseModel):
    question: str
    answer: str
    scores: FeedbackScore
    comments: str


class InterviewFeedback(BaseModel):
    overall_score: float
    overall_assessment: str
    strengths: list[str]
    improvements: list[str]
    question_feedback: list[QuestionFeedback]
