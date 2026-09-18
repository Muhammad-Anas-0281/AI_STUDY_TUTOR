"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BrainCircuit,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Award,
  BookOpen,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ListChecks,
  Check,
  RotateCcw,
  MessageSquare,
  Search,
  ArrowUpDown,
  Brain,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface QuestionItem {
  id: string;
  concept_id?: string;
  concept_name?: string;
  type: "mcq" | "open_ended";
  difficulty: string;
  prompt: string;
  options?: string[];
  order_index: number;
}

interface ConceptMastery {
  id: string;
  name: string;
  description: string;
  mastery?: {
    score: number;
    evidence_count: number;
    status: string;
    updated_at: string;
  };
}

interface MasteryDelta {
  concept_id: string;
  concept_name: string;
  old_score: number;
  new_score: number;
  delta: number;
  status: string;
}

interface GradedAnswer {
  question_id: string;
  concept_name?: string;
  type: string;
  user_response: string;
  correct_answer?: string;
  explanation?: string;
  is_correct: boolean;
  score: number;
  rubric_feedback?: {
    understood?: string;
    missing?: string;
    key_concepts?: string[];
  };
}

interface QuizResult {
  attempt_id: string;
  total_score: number;
  total_questions: number;
  correct_count: number;
  completed_at: string;
  answers: GradedAnswer[];
  mastery_deltas: MasteryDelta[];
}

interface PastAttempt {
  id: string;
  project_id: string;
  status: string;
  score?: number;
  total_questions: number;
  started_at: string;
  completed_at?: string;
}

function getMasteryColor(score: number) {
  if (score >= 80) return { text: "text-emerald-400", bg: "bg-emerald-500", badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10", label: "Mastered" };
  if (score >= 60) return { text: "text-blue-400", bg: "bg-blue-500", badge: "border-blue-500/40 text-blue-400 bg-blue-500/10", label: "Proficient" };
  if (score >= 40) return { text: "text-indigo-400", bg: "bg-indigo-500", badge: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10", label: "Practicing" };
  if (score >= 20) return { text: "text-amber-400", bg: "bg-amber-500", badge: "border-amber-500/40 text-amber-400 bg-amber-500/10", label: "Learning" };
  return { text: "text-red-400", bg: "bg-red-500", badge: "border-red-500/40 text-red-400 bg-red-500/10", label: "Struggling" };
}

function RingGauge({ score, size = 72 }: { score: number; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#6366f1" : score >= 20 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

export default function QuizAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const projectId = params.projectId as string;

  // View Tabs: "quiz" | "mastery" | "history"
  const [activeTab, setActiveTab] = useState<"quiz" | "mastery" | "history">("quiz");

  // Quiz Engine State
  const [quizState, setQuizState] = useState<"setup" | "generating" | "active" | "grading" | "result">("setup");
  const [numQuestions, setNumQuestions] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<string>("adaptive");

  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [concepts, setConcepts] = useState<ConceptMastery[]>([]);
  const [conceptSearch, setConceptSearch] = useState<string>("");
  const [conceptFilter, setConceptFilter] = useState<"all" | "weak" | "practicing" | "mastered">("all");
  const [conceptSort, setConceptSort] = useState<"score_asc" | "score_desc" | "evidence" | "name">("score_asc");
  const [history, setHistory] = useState<PastAttempt[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConcepts();
    fetchHistory();
  }, [projectId]);

  const fetchConcepts = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/concepts`);
      setConcepts(res.data);
    } catch (err: any) {
      console.error("Failed to load concepts:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/quiz/history`);
      setHistory(res.data);
    } catch (err: any) {
      console.error("Failed to load history:", err);
    }
  };

  const extractConcepts = async () => {
    setLoadingData(true);
    setErrorMessage(null);
    try {
      const res = await api.post(`/projects/${projectId}/concepts/extract?force=true`);
      setConcepts(res.data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Failed to extract concepts from materials.");
    } finally {
      setLoadingData(false);
    }
  };

  const handleStartQuiz = async () => {
    setQuizState("generating");
    setErrorMessage(null);
    try {
      const res = await api.post(`/projects/${projectId}/quiz/generate`, {
        num_questions: numQuestions,
        difficulty: difficulty,
      });

      setCurrentAttemptId(res.data.id);
      setQuestions(res.data.questions);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setQuizState("active");
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Failed to generate adaptive quiz. Make sure study materials are uploaded.");
      setQuizState("setup");
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!currentAttemptId) return;

    setQuizState("grading");
    setErrorMessage(null);

    const submissionPayload = {
      answers: questions.map((q) => ({
        question_id: q.id,
        user_response: userAnswers[q.id] || "",
      })),
    };

    try {
      const res = await api.post(
        `/projects/${projectId}/quiz/${currentAttemptId}/submit`,
        submissionPayload
      );
      setQuizResult(res.data);
      setQuizState("result");
      fetchConcepts();
      fetchHistory();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Error evaluating quiz submission.");
      setQuizState("active");
    }
  };

  const currentQ = questions[currentQuestionIndex];
  const progressPercent = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(userAnswers).filter((k) => userAnswers[k]?.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}`}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Project
          </Link>
          <div className="h-4 w-[1px] bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-100">Adaptive Quiz & Assessment</h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("quiz")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              activeTab === "quiz" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Take Quiz
          </button>
          <button
            onClick={() => setActiveTab("mastery")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "mastery" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Concept Mastery
            <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.2 rounded-full font-mono">
              {concepts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "history" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            History
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
              {history.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {errorMessage && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* ================= TAB 1: TAKE QUIZ ================= */}
        {activeTab === "quiz" && (
          <>
            {/* Setup State */}
            {quizState === "setup" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                            Adaptive Knowledge Assessment
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-sm">
                            Generates context-grounded multiple-choice and open-ended questions targeting your weakest concepts.
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Question Count
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                          {[3, 4, 5, 6].map((count) => (
                            <button
                              key={count}
                              onClick={() => setNumQuestions(count)}
                              className={`py-2.5 px-4 rounded-lg border text-sm font-semibold transition ${
                                numQuestions === count
                                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-300 shadow-sm"
                                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                              }`}
                            >
                              {count} Questions
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Difficulty Mode
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "adaptive", label: "Adaptive AI", desc: "Weights low mastery concepts" },
                            { id: "medium", label: "Standard", desc: "Balanced conceptual mix" },
                            { id: "hard", label: "Challenging", desc: "Deep synthesis & mechanics" },
                          ].map((d) => (
                            <button
                              key={d.id}
                              onClick={() => setDifficulty(d.id)}
                              className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                                difficulty === d.id
                                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <span className="text-xs font-bold text-slate-200">{d.label}</span>
                              <span className="text-[11px] text-slate-400 mt-1">{d.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          Questions feature deterministic MCQs + AI Rubric open-ended grading.
                        </div>
                        <Button
                          onClick={handleStartQuiz}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 px-6"
                        >
                          <Sparkles className="w-4 h-4" /> Start Assessment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Concept Focus Panel */}
                <div className="space-y-6">
                  <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-emerald-400" />
                          Curriculum Concepts
                        </CardTitle>
                        {concepts.length === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={extractConcepts}
                            disabled={loadingData}
                            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            {loadingData ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Extract"}
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {concepts.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500 space-y-2">
                          <p>No concepts extracted yet.</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={extractConcepts}
                            className="text-xs border-slate-800 text-indigo-400 hover:bg-slate-800"
                          >
                            Extract from Materials
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                          {concepts.slice(0, 6).map((c) => {
                            const score = c.mastery?.score || 0;
                            return (
                              <div
                                key={c.id}
                                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col gap-1.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]">{c.name}</span>
                                  <span className="font-mono text-emerald-400 font-bold">{score.toFixed(0)}%</span>
                                </div>
                                <Progress value={score} className="h-1.5 bg-slate-800" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Generating State */}
            {quizState === "generating" && (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Generating Grounded Assessment...</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Analyzing project materials, selecting weak mastery concepts, and generating balanced MCQs and open-ended questions.
                </p>
              </Card>
            )}

            {/* Active Quiz Runner */}
            {quizState === "active" && currentQ && (
              <div className="space-y-6">
                {/* Runner Header */}
                <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-3.5 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs px-2.5 py-0.5">
                      Question {currentQuestionIndex + 1} of {questions.length}
                    </Badge>
                    {currentQ.concept_name && (
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        Concept: <strong className="text-slate-200 font-medium">{currentQ.concept_name}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">
                      Answered {answeredCount}/{questions.length}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-mono ${
                        currentQ.type === "mcq"
                          ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                          : "border-purple-500/30 text-purple-400 bg-purple-500/10"
                      }`}
                    >
                      {currentQ.type === "mcq" ? "Multiple Choice" : "Open-Ended"}
                    </Badge>
                  </div>
                </div>

                <Progress value={progressPercent} className="h-1.5 bg-slate-800" />

                {/* Question Card */}
                <Card className="border-slate-800 bg-slate-900/70 shadow-2xl">
                  <CardHeader className="pb-4">
                    <div className="text-lg font-medium text-slate-100 leading-relaxed">
                      {currentQ.prompt}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-2">
                    {/* MCQ Options */}
                    {currentQ.type === "mcq" && currentQ.options && (
                      <div className="space-y-3">
                        {currentQ.options.map((option, optIdx) => {
                          const isSelected = userAnswers[currentQ.id] === option;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectAnswer(currentQ.id, option)}
                              className={`w-full p-4 rounded-xl border text-left transition flex items-center justify-between group ${
                                isSelected
                                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-100 shadow-md"
                                  : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80"
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold transition ${
                                    isSelected
                                      ? "border-indigo-400 bg-indigo-500 text-white"
                                      : "border-slate-700 text-slate-500 group-hover:border-slate-500"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                                <span className="text-sm font-medium">{option}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Open Ended Textarea */}
                    {currentQ.type === "open_ended" && (
                      <div className="space-y-2">
                        <textarea
                          rows={5}
                          value={userAnswers[currentQ.id] || ""}
                          onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                          placeholder="Type your detailed explanation here. The AI evaluator will score your precision, depth, and conceptual mechanisms against the learning rubric..."
                          className="w-full p-4 rounded-xl border border-slate-800 bg-slate-950/70 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
                        />
                        <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                          <span>Evaluated by AI Rubric (Completeness & Nuance)</span>
                          <span>{(userAnswers[currentQ.id] || "").length} chars</span>
                        </div>
                      </div>
                    )}

                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentQuestionIndex === 0}
                        onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                        className="border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>

                      {currentQuestionIndex < questions.length - 1 ? (
                        <Button
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                        >
                          Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleSubmitQuiz}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Submit Quiz & Grade
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Grading State */}
            {quizState === "grading" && (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xl">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                  <BrainCircuit className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Grading Assessment with AI Rubric...</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Verifying multiple-choice keys and evaluating open-ended responses against conceptual depth, missing details, and updating concept masteries.
                </p>
              </Card>
            )}

            {/* Results State */}
            {quizState === "result" && quizResult && (
              <div className="space-y-6">
                {/* Result Overview Header */}
                <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div
                        className={`w-20 h-20 rounded-2xl border flex flex-col items-center justify-center shadow-lg ${
                          quizResult.total_score >= 75
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : quizResult.total_score >= 50
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            : "border-red-500/40 bg-red-500/10 text-red-400"
                        }`}
                      >
                        <span className="text-2xl font-black font-mono">{quizResult.total_score.toFixed(0)}%</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Score</span>
                      </div>

                      <div className="space-y-1 text-center md:text-left">
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 justify-center md:justify-start">
                          <Award className="w-5 h-5 text-indigo-400" />
                          Assessment Complete
                        </h2>
                        <p className="text-sm text-slate-400">
                          You scored <strong>{quizResult.correct_count}</strong> of{" "}
                          <strong>{quizResult.total_questions}</strong> questions correctly.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuizState("setup");
                          setQuizResult(null);
                        }}
                        className="border-slate-800 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" /> Take Another Quiz
                      </Button>
                      <Link href={`/spaces/${spaceId}/projects/${projectId}/tutor`}>
                        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4" /> Review with Tutor
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>

                {/* Mastery Deltas — Visual Chart + Per-Concept Cards */}
                {quizResult.mastery_deltas.length > 0 && (
                  <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        Concept Mastery After This Quiz
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Bar chart of new_score per concept */}
                      <div className="w-full h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={quizResult.mastery_deltas.map((d) => ({
                              name: d.concept_name.length > 14 ? d.concept_name.slice(0, 14) + "…" : d.concept_name,
                              fullName: d.concept_name,
                              prev: parseFloat(d.old_score.toFixed(1)),
                              now: parseFloat(d.new_score.toFixed(1)),
                              delta: d.delta,
                            }))}
                            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "#94a3b8" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
                                    <p className="font-bold text-slate-200 mb-1">{d.fullName}</p>
                                    <p className="text-slate-400">Before: <span className="text-slate-200 font-mono">{d.prev}%</span></p>
                                    <p className="text-slate-400">After: <span className="text-indigo-300 font-mono font-bold">{d.now}%</span></p>
                                    <p className={`font-mono font-bold ${d.delta > 0 ? "text-emerald-400" : d.delta < 0 ? "text-red-400" : "text-slate-500"}`}>
                                      {d.delta > 0 ? `+${d.delta}` : d.delta} pts
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            <Bar dataKey="prev" name="Before" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="now" name="After" radius={[4, 4, 0, 0]} barSize={20}>
                              {quizResult.mastery_deltas.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={d.new_score >= 80 ? "#10b981" : d.new_score >= 50 ? "#6366f1" : "#f59e0b"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1e293b] inline-block" /> Before</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Mastered ≥80%</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> Practicing 50–79%</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Needs Work &lt;50%</span>
                      </div>

                      {/* Per-concept delta cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {quizResult.mastery_deltas.map((delta) => {
                          const improved = delta.delta > 0;
                          const declined = delta.delta < 0;
                          return (
                            <div
                              key={delta.concept_id}
                              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-semibold text-xs text-slate-200 leading-snug">{delta.concept_name}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-mono shrink-0 ${
                                    improved
                                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                      : declined
                                      ? "border-red-500/40 text-red-400 bg-red-500/10"
                                      : "border-slate-700 text-slate-400"
                                  }`}
                                >
                                  {improved ? `+${delta.delta}` : `${delta.delta}`} pts
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span>{delta.old_score.toFixed(0)}% → <strong className="text-white">{delta.new_score.toFixed(0)}%</strong></span>
                                  <span className="uppercase font-mono text-[10px] text-slate-500">{delta.status}</span>
                                </div>
                                <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                  {/* Old score bar (grey) */}
                                  <div
                                    className="absolute left-0 top-0 h-full bg-slate-600 rounded-full transition-all"
                                    style={{ width: `${delta.old_score}%` }}
                                  />
                                  {/* New score bar (colored) */}
                                  <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                                      delta.new_score >= 80 ? "bg-emerald-500" : delta.new_score >= 50 ? "bg-indigo-500" : "bg-amber-500"
                                    }`}
                                    style={{ width: `${delta.new_score}%`, opacity: 0.75 }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Question-by-Question Graded Feedback */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-400" />
                    Question Breakdown & AI Rubric Feedback
                  </h3>

                  {quizResult.answers.map((ans, idx) => (
                    <Card
                      key={ans.question_id || idx}
                      className={`border bg-slate-900/70 shadow-lg overflow-hidden ${
                        ans.is_correct ? "border-emerald-500/30" : "border-red-500/30"
                      }`}
                    >
                      <div className="p-5 space-y-4">
                        {/* Status bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {ans.is_correct ? (
                              <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="p-1 rounded-full bg-red-500/20 text-red-400">
                                <XCircle className="w-5 h-5" />
                              </div>
                            )}
                            <span className="text-sm font-bold text-slate-200">
                              Question {idx + 1} ({ans.concept_name || "Concept"})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-xs font-mono ${
                                ans.is_correct
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                  : "border-red-500/40 text-red-400 bg-red-500/10"
                              }`}
                            >
                              Score: {(ans.score * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>

                        {/* User Response vs Ideal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                            <span className="text-slate-400 font-semibold block">Your Response:</span>
                            <p className="text-slate-200 leading-relaxed">{ans.user_response || "(Empty)"}</p>
                          </div>

                          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                            <span className="text-indigo-400 font-semibold block">Reference / Correct Key:</span>
                            <p className="text-slate-200 leading-relaxed">{ans.correct_answer || "(N/A)"}</p>
                          </div>
                        </div>

                        {/* Explanation */}
                        {ans.explanation && (
                          <div className="p-3.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-xs text-slate-300">
                            <strong className="text-indigo-300 block mb-1">Pedagogical Explanation:</strong>
                            <p className="leading-relaxed">{ans.explanation}</p>
                          </div>
                        )}

                        {/* Rubric Breakdown for Open-Ended */}
                        {ans.rubric_feedback && ans.type === "open_ended" && (
                          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
                            <span className="font-bold text-slate-300 block">AI Rubric Analysis:</span>
                            {ans.rubric_feedback.understood && (
                              <p className="text-emerald-300">
                                <strong>Understood:</strong> {ans.rubric_feedback.understood}
                              </p>
                            )}
                            {ans.rubric_feedback.missing && (
                              <p className="text-amber-300">
                                <strong>Missing / Needs Nuance:</strong> {ans.rubric_feedback.missing}
                              </p>
                            )}
                            {ans.rubric_feedback.key_concepts && ans.rubric_feedback.key_concepts.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-slate-400">Key terms to review:</span>
                                {ans.rubric_feedback.key_concepts.map((term, tIdx) => (
                                  <Badge key={tIdx} variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                                    {term}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= TAB 2: CONCEPT MASTERY ================= */}
        {activeTab === "mastery" && (() => {
          const mastered = concepts.filter(c => (c.mastery?.score || 0) >= 80).length;
          const proficient = concepts.filter(c => (c.mastery?.score || 0) >= 60 && (c.mastery?.score || 0) < 80).length;
          const practicing = concepts.filter(c => (c.mastery?.score || 0) >= 40 && (c.mastery?.score || 0) < 60).length;
          const learning = concepts.filter(c => (c.mastery?.score || 0) >= 20 && (c.mastery?.score || 0) < 40).length;
          const struggling = concepts.filter(c => (c.mastery?.score || 0) < 20).length;

          const studyTip = (score: number): string => {
            if (score >= 80) return "Excellent! Try teaching this concept to solidify retention.";
            if (score >= 60) return "Good progress — review edge cases and advanced applications.";
            if (score >= 40) return "Keep practicing — focus on the core definitions and examples.";
            if (score >= 20) return "Needs more attention — revisit materials and ask the AI Tutor.";
            return "Start here — read the source material and ask the AI Tutor for an explanation.";
          };

          const evidenceStrength = (count: number): { label: string; color: string } => {
            if (count >= 10) return { label: "Strong evidence base", color: "text-emerald-400" };
            if (count >= 5) return { label: "Moderate evidence", color: "text-blue-400" };
            if (count >= 2) return { label: "Limited evidence", color: "text-amber-400" };
            return { label: "Very low evidence", color: "text-red-400" };
          };

          const filteredConcepts = concepts
            .filter((c) => {
              const score = c.mastery?.score || 0;
              if (conceptSearch.trim()) {
                const q = conceptSearch.toLowerCase();
                const matchName = c.name.toLowerCase().includes(q);
                const matchDesc = (c.description || "").toLowerCase().includes(q);
                if (!matchName && !matchDesc) return false;
              }
              if (conceptFilter === "weak") return score < 40;
              if (conceptFilter === "practicing") return score >= 40 && score < 80;
              if (conceptFilter === "mastered") return score >= 80;
              return true;
            })
            .sort((a, b) => {
              const scoreA = a.mastery?.score || 0;
              const scoreB = b.mastery?.score || 0;
              const countA = a.mastery?.evidence_count || 0;
              const countB = b.mastery?.evidence_count || 0;
              if (conceptSort === "score_asc") return scoreA - scoreB;
              if (conceptSort === "score_desc") return scoreB - scoreA;
              if (conceptSort === "evidence") return countB - countA;
              if (conceptSort === "name") return a.name.localeCompare(b.name);
              return 0;
            });

          return (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-emerald-400" />
                    Project Concept Mastery
                    <span className="text-xs font-normal text-slate-500">— {concepts.length} concepts tracked</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bayesian moving-average mastery tracking evaluated across quizzes and tutor interactions.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extractConcepts}
                    disabled={loadingData}
                    className="border-slate-800 text-slate-300 hover:bg-slate-800 flex items-center gap-2 text-xs"
                  >
                    {loadingData ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Re-extract Concepts
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setActiveTab("quiz"); setQuizState("setup"); }}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5 font-semibold"
                  >
                    <Brain className="w-3.5 h-3.5" /> Start Quiz
                  </Button>
                </div>
              </div>

              {/* Tier Distribution Summary Strip */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Mastered", count: mastered, color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", dot: "bg-emerald-500", filterKey: "mastered" as const },
                  { label: "Proficient", count: proficient, color: "bg-blue-500/10 border-blue-500/30 text-blue-400", dot: "bg-blue-500", filterKey: "practicing" as const },
                  { label: "Practicing", count: practicing, color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400", dot: "bg-indigo-500", filterKey: "practicing" as const },
                  { label: "Learning", count: learning, color: "bg-amber-500/10 border-amber-500/30 text-amber-400", dot: "bg-amber-500", filterKey: "weak" as const },
                  { label: "Struggling", count: struggling, color: "bg-red-500/10 border-red-500/30 text-red-400", dot: "bg-red-500", filterKey: "weak" as const },
                ].map(({ label, count, color, dot, filterKey }) => (
                  <button
                    key={label}
                    onClick={() => setConceptFilter(conceptFilter === filterKey ? "all" : filterKey)}
                    className={`flex flex-col items-center p-3 rounded-xl border ${color} text-center transition hover:opacity-90 cursor-pointer`}
                  >
                    <div className={`w-2 h-2 rounded-full ${dot} mb-1.5`} />
                    <span className="text-xl font-black">{count}</span>
                    <span className="text-[10px] font-medium mt-0.5 opacity-80">{label}</span>
                  </button>
                ))}
              </div>

              {/* Mastery Distribution Bar */}
              {concepts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Curriculum Progress Ratio</p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {mastered > 0 && <div className="bg-emerald-500 rounded-full" style={{ flex: mastered }} title={`Mastered: ${mastered}`} />}
                    {proficient > 0 && <div className="bg-blue-500 rounded-full" style={{ flex: proficient }} title={`Proficient: ${proficient}`} />}
                    {practicing > 0 && <div className="bg-indigo-500 rounded-full" style={{ flex: practicing }} title={`Practicing: ${practicing}`} />}
                    {learning > 0 && <div className="bg-amber-500 rounded-full" style={{ flex: learning }} title={`Learning: ${learning}`} />}
                    {struggling > 0 && <div className="bg-red-500 rounded-full" style={{ flex: struggling }} title={`Struggling: ${struggling}`} />}
                  </div>
                </div>
              )}

              {/* Search, Filter & Sort Toolbar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={conceptSearch}
                    onChange={(e) => setConceptSearch(e.target.value)}
                    placeholder="Search concepts or topics..."
                    className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  <button
                    onClick={() => setConceptFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                      conceptFilter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200 bg-slate-950"
                    }`}
                  >
                    All ({concepts.length})
                  </button>
                  <button
                    onClick={() => setConceptFilter("weak")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
                      conceptFilter === "weak" ? "bg-red-600 text-white shadow" : "text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    Needs Work ({struggling + learning})
                  </button>
                  <button
                    onClick={() => setConceptFilter("practicing")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                      conceptFilter === "practicing" ? "bg-blue-600 text-white shadow" : "text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20"
                    }`}
                  >
                    In Progress ({practicing + proficient})
                  </button>
                  <button
                    onClick={() => setConceptFilter("mastered")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                      conceptFilter === "mastered" ? "bg-emerald-600 text-white shadow" : "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                    }`}
                  >
                    Mastered ({mastered})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={conceptSort}
                    onChange={(e: any) => setConceptSort(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="score_asc">Priority (Lowest First)</option>
                    <option value="score_desc">Highest Mastery</option>
                    <option value="evidence">Most Evidence</option>
                    <option value="name">Alphabetical (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Cards Grid */}
              {concepts.length === 0 ? (
                <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
                  <BrainCircuit className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="font-semibold text-slate-300">No Concepts Available</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Upload study materials to automatically extract learning concepts.
                  </p>
                  <Button onClick={extractConcepts} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                    Extract Concepts Now
                  </Button>
                </Card>
              ) : filteredConcepts.length === 0 ? (
                <Card className="border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
                  <Search className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm text-slate-300 font-medium">No concepts match your filter</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setConceptSearch(""); setConceptFilter("all"); }}
                    className="text-xs border-slate-700 text-slate-300"
                  >
                    Reset Filters
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredConcepts.map((concept, idx) => {
                    const score = concept.mastery?.score || 0;
                    const count = concept.mastery?.evidence_count || 0;
                    const status = concept.mastery?.status || "needs_attention";
                    const mc = getMasteryColor(score);
                    const ev = evidenceStrength(count);
                    const tip = studyTip(score);
                    const isWeak = score < 40;
                    const rank = idx + 1;

                    return (
                      <Card
                        key={concept.id}
                        className={`border bg-slate-900 shadow-xl overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-0.5 ${
                          isWeak ? "border-red-500/20 hover:border-red-500/40" : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className={`h-1 w-full ${mc.bg} opacity-80`} />

                        <div className="p-5 space-y-4">
                          {/* Top Row: Gauge & Title */}
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              <RingGauge score={score} size={64} />
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xs font-black ${mc.text}`}>{score.toFixed(0)}%</span>
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] text-slate-500 font-mono">#{rank}</span>
                                {isWeak && (
                                  <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400 bg-red-500/10 px-1.5 py-0">
                                    Needs Work
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-bold text-sm text-white leading-tight">{concept.name}</h3>
                            </div>
                          </div>

                          {/* Progress bar with milestones */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={`font-bold ${mc.text}`}>{mc.label}</span>
                              <span className="text-slate-200 font-mono font-bold">{score.toFixed(1)}%</span>
                            </div>
                            <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`absolute left-0 top-0 h-full rounded-full ${mc.bg}`}
                                style={{ width: `${score}%`, opacity: 0.85 }}
                              />
                              {[40, 60, 80].map((m) => (
                                <div
                                  key={m}
                                  className="absolute top-0 h-full w-px bg-slate-600/50"
                                  style={{ left: `${m}%` }}
                                />
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-600">
                              <span>0%</span>
                              <span>40%</span>
                              <span>60%</span>
                              <span>80%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          {/* Description */}
                          {concept.description && (
                            <div className="bg-slate-950/60 rounded-xl px-3 py-2.5 border border-slate-800">
                              <p className="text-[11px] text-slate-300 leading-relaxed">{concept.description}</p>
                            </div>
                          )}

                          {/* Evidence & Status Panels */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-1">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Evidence Points</p>
                              <p className="text-lg font-black text-white font-mono">{count}</p>
                              <p className={`text-[10px] font-semibold ${ev.color}`}>{ev.label}</p>
                            </div>

                            <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-1">
                              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Status</p>
                              <Badge variant="outline" className={`text-[10px] font-bold uppercase px-2 py-0.5 ${mc.badge}`}>
                                {status.replace(/_/g, " ")}
                              </Badge>
                              {concept.mastery?.updated_at && (
                                <p className="text-[10px] text-slate-600">
                                  Updated {new Date(concept.mastery.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Evidence Strength Meter */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>Evidence Strength</span>
                              <span className={`font-semibold ${ev.color}`}>{Math.min(count, 10)}/10</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  count >= 10 ? "bg-emerald-500" :
                                  count >= 5 ? "bg-blue-500" :
                                  count >= 2 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min((count / 10) * 100, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* AI Study Tip */}
                          <div className={`rounded-xl px-3 py-2.5 border flex items-start gap-2 ${
                            isWeak
                              ? "bg-red-500/5 border-red-500/20"
                              : score >= 80
                              ? "bg-emerald-500/5 border-emerald-500/20"
                              : "bg-indigo-500/5 border-indigo-500/20"
                          }`}>
                            <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isWeak ? "text-red-400" : score >= 80 ? "text-emerald-400" : "text-indigo-400"}`} />
                            <p className="text-[11px] leading-relaxed text-slate-300">{tip}</p>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            <Link
                              href={`/spaces/${spaceId}/projects/${projectId}/tutor?q=${encodeURIComponent("Explain " + concept.name + " in detail with core principles and examples.")}`}
                              className="flex-1"
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5"
                              >
                                <MessageSquare className="w-3 h-3 text-indigo-400" />
                                Study with Tutor
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              onClick={() => {
                                setActiveTab("quiz");
                                setQuizState("setup");
                              }}
                              className={`flex-1 text-xs gap-1.5 ${
                                isWeak
                                  ? "bg-red-600 hover:bg-red-500 text-white"
                                  : "bg-violet-600 hover:bg-violet-500 text-white"
                              }`}
                            >
                              <Brain className="w-3 h-3" />
                              Practice Quiz
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ================= TAB 3: HISTORY ================= */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-100">Assessment History</h2>

            {history.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
                <Clock className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="font-semibold text-slate-300">No Assessment History</p>
                <p className="text-xs text-slate-500 mt-1">Take your first adaptive quiz to track growth over time.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((attempt) => (
                  <Card key={attempt.id} className="border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center font-mono font-bold text-sm ${
                            (attempt.score || 0) >= 75
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : (attempt.score || 0) >= 50
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                              : "border-red-500/40 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {attempt.score !== null ? `${attempt.score?.toFixed(0)}%` : "In Prog"}
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-slate-200">
                            {attempt.total_questions} Questions Assessment
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(attempt.started_at).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-xs font-mono uppercase ${
                          attempt.status === "completed"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-amber-500/40 text-amber-400"
                        }`}
                      >
                        {attempt.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
