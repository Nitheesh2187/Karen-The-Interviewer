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


class QuestionFeedback(BaseModel):
    question: str
    answer: str
    feedback: str
    score: float  # 0-100


class InterviewFeedback(BaseModel):
    overall_score: float  # 0-100
    overall_assessment: str
    strengths: list[str]
    improvements: list[str]
    question_feedback: list[QuestionFeedback]
