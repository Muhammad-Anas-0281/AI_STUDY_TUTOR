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
} from "lucide-react";
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
        {activeTab === "mastery" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Project Concept Mastery</h2>
                <p className="text-xs text-slate-400">
                  Bayesian moving-average mastery tracking evaluated across quizzes and tutor interactions.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={extractConcepts}
                disabled={loadingData}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
              >
                {loadingData ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Re-extract Concepts
              </Button>
            </div>

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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concepts.map((concept) => {
                  const score = concept.mastery?.score || 0;
                  const count = concept.mastery?.evidence_count || 0;
                  const status = concept.mastery?.status || "needs_attention";

                  return (
                    <Card key={concept.id} className="border-slate-800 bg-slate-900/60 shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base font-bold text-slate-200">{concept.name}</CardTitle>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono uppercase ${
                              status === "improving"
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : status === "stable"
                                ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                                : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                            }`}
                          >
                            {status.replace("_", " ")}
                          </Badge>
                        </div>
                        {concept.description && (
                          <CardDescription className="text-slate-400 text-xs line-clamp-2">
                            {concept.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-slate-400">Mastery Level</span>
                          <span className="font-mono text-base font-bold text-slate-100">{score.toFixed(0)}%</span>
                        </div>
                        <Progress value={score} className="h-2 bg-slate-800" />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>Evidence points: {count}</span>
                          <span>Last updated: {concept.mastery?.updated_at ? new Date(concept.mastery.updated_at).toLocaleDateString() : "Never"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
