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
  TrendingUp,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BrainCircuit,
  Award,
  RefreshCw,
  Compass,
  Activity,
  ArrowRight,
  Check,
  X,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface ConceptGrowthItem {
  id: string;
  name: string;
  description?: string;
  score: number;
  evidence_count: number;
  status: string;
  updated_at?: string;
}

interface QuizTrendPoint {
  attempt_id: string;
  date: string;
  score: number;
  total_questions: number;
}

interface WeakConceptAlert {
  concept_id: string;
  concept_name: string;
  current_score: number;
  reason: string;
}

interface GrowthMetrics {
  project_id: string;
  project_name: string;
  average_mastery: number;
  total_concepts: number;
  improving_count: number;
  stable_count: number;
  needs_attention_count: number;
  total_quizzes_taken: number;
  recent_quiz_average: number;
  concepts: ConceptGrowthItem[];
  quiz_trend: QuizTrendPoint[];
  weak_concept_alerts: WeakConceptAlert[];
  activity_count: number;
}

interface RecommendationItem {
  id: string;
  project_id: string;
  text: string;
  reason?: string;
  status: "pending" | "completed" | "dismissed";
  created_at: string;
}

interface LearningEventItem {
  id: string;
  type: string;
  project_id?: string;
  payload: Record<string, any>;
  created_at: string;
}

export default function GrowthAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const projectId = params.projectId as string;

  const [activeTab, setActiveTab] = useState<"recommendations" | "mastery" | "activity">("recommendations");
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [events, setEvents] = useState<LearningEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingRecs, setGeneratingRecs] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [projectId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [growthRes, recsRes, eventsRes] = await Promise.all([
        api.get(`/projects/${projectId}/growth`),
        api.get(`/projects/${projectId}/recommendations`),
        api.get(`/projects/${projectId}/events`),
      ]);
      setMetrics(growthRes.data);
      setRecommendations(recsRes.data);
      setEvents(eventsRes.data);
    } catch (err: any) {
      console.error("Failed to load growth data:", err);
      setErrorMessage("Could not load growth metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setGeneratingRecs(true);
    setErrorMessage(null);
    try {
      const res = await api.post(`/projects/${projectId}/recommendations/generate`);
      setRecommendations(res.data);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || "Failed to generate recommendations.");
    } finally {
      setGeneratingRecs(false);
    }
  };

  const handleUpdateRecStatus = async (recId: string, status: "completed" | "dismissed") => {
    try {
      await api.patch(`/projects/${projectId}/recommendations/${recId}/status`, { status });
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status } : r))
      );
    } catch (err: any) {
      console.error("Failed to update status:", err);
    }
  };

  const pendingRecommendations = recommendations.filter((r) => r.status === "pending");
  const completedRecommendations = recommendations.filter((r) => r.status === "completed");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
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
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-100">Growth, Analytics & Recommendations</h1>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("recommendations")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "recommendations"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            AI Recommendations
            {pendingRecommendations.length > 0 && (
              <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.2 rounded-full font-mono">
                {pendingRecommendations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("mastery")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "mastery"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            Mastery & Trends
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "activity"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Activity Stream
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {errorMessage && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Top Summary Metrics Row */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Average Mastery */}
            <Card className="border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Average Mastery</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
                {metrics.average_mastery.toFixed(0)}%
              </div>
              <Progress value={metrics.average_mastery} className="h-1.5 bg-slate-800 mt-3" />
            </Card>

            {/* Concepts Status Breakdown */}
            <Card className="border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Curriculum Health</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <BrainCircuit className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-semibold text-emerald-400 font-mono">
                  {metrics.improving_count} Improving
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs font-semibold text-amber-400 font-mono">
                  {metrics.needs_attention_count} Needs Work
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-3">
                {metrics.total_concepts} total learning concepts
              </div>
            </Card>

            {/* Quiz Performance */}
            <Card className="border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Assessment Average</span>
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
                {metrics.recent_quiz_average.toFixed(0)}%
              </div>
              <div className="text-[11px] text-slate-500 mt-3">
                Across {metrics.total_quizzes_taken} completed quizzes
              </div>
            </Card>

            {/* Learning Events Streak */}
            <Card className="border-slate-800 bg-slate-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Learning Momentum</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-2">
                {metrics.activity_count}
              </div>
              <div className="text-[11px] text-slate-500 mt-3">Total recorded study actions</div>
            </Card>
          </div>
        )}

        {/* ================= TAB 1: RECOMMENDATIONS ================= */}
        {activeTab === "recommendations" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  Prescribed Study Actions
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Grounded AI recommendations synthesized from your latest quiz mistakes and weakest concepts.
                </p>
              </div>

              <Button
                onClick={handleGenerateRecommendations}
                disabled={generatingRecs}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow"
              >
                {generatingRecs ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Generate Recommendations
              </Button>
            </div>

            {/* Pending Recommendations List */}
            {pendingRecommendations.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
                <Compass className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="font-semibold text-slate-300">No Active Recommendations</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Take a quiz or click below to generate personalized AI study actions.
                </p>
                <Button
                  onClick={handleGenerateRecommendations}
                  disabled={generatingRecs}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  Generate Recommendations Now
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingRecommendations.map((rec) => (
                  <Card
                    key={rec.id}
                    className="border-slate-800 bg-slate-900/70 hover:border-indigo-500/40 transition shadow-lg overflow-hidden"
                  >
                    <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="text-sm font-medium text-slate-100 leading-relaxed">
                          {rec.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                        </div>
                        {rec.reason && (
                          <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg w-fit">
                            <span className="font-semibold">Why this:</span> {rec.reason}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <Link href={`/spaces/${spaceId}/projects/${projectId}/tutor`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                            Ask Tutor
                          </Button>
                        </Link>
                        <Link href={`/spaces/${spaceId}/projects/${projectId}/quiz`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                          >
                            <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                            Quiz
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateRecStatus(rec.id, "completed")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateRecStatus(rec.id, "dismissed")}
                          className="text-xs text-slate-500 hover:text-slate-400 p-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Recommendations */}
            {completedRecommendations.length > 0 && (
              <div className="pt-6 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Completed Recommendations ({completedRecommendations.length})
                </h3>
                <div className="space-y-2">
                  {completedRecommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400 opacity-75"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="line-through">{rec.text.replace(/\*\*(.*?)\*\*/g, "$1")}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(rec.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MASTERY & TRENDS ================= */}
        {activeTab === "mastery" && metrics && (
          <div className="space-y-6">
            {/* Weak Concept Warning Banner */}
            {metrics.weak_concept_alerts.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-amber-300 font-bold block text-sm">
                    {metrics.weak_concept_alerts.length} Concept(s) Require Attention
                  </strong>
                  <div className="space-y-0.5 text-amber-200/90">
                    {metrics.weak_concept_alerts.map((w) => (
                      <p key={w.concept_id}>
                        • <strong>{w.concept_name}</strong>: {w.reason}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quiz Performance Timeline */}
            <Card className="border-slate-800 bg-slate-900/60 p-6 shadow-xl">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Quiz Score Progression
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Historical scores across all completed assessment sessions.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                {metrics.quiz_trend.length < 2 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Take at least 2 quizzes to render score trendline.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.quiz_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={3}
                          dot={{ fill: "#6366f1", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Concept Mastery Breakdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-emerald-400" />
                Concept Mastery Scores
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.concepts.map((concept) => (
                  <Card key={concept.id} className="border-slate-800 bg-slate-900/60 p-4 shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-200">{concept.name}</h4>
                        {concept.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{concept.description}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono uppercase ${
                          concept.status === "improving"
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                            : concept.status === "stable"
                            ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                            : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                        }`}
                      >
                        {concept.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-slate-400 font-medium">Mastery</span>
                        <span className="font-mono font-bold text-slate-100">{concept.score.toFixed(0)}%</span>
                      </div>
                      <Progress value={concept.score} className="h-1.5 bg-slate-800" />
                      <div className="text-[10px] text-slate-500 pt-1">
                        {concept.evidence_count} evidence points recorded
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ACTIVITY STREAM ================= */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Event Timeline
            </h2>

            {events.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center text-slate-400">
                <Clock className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <p className="font-semibold text-slate-300">No Learning Events Recorded</p>
                <p className="text-xs text-slate-500 mt-1">
                  Upload materials, chat with the AI tutor, or take quizzes to build your activity history.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <Card key={ev.id} className="border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800 text-indigo-400">
                          {ev.type.includes("quiz") ? (
                            <Award className="w-4 h-4" />
                          ) : ev.type.includes("tutor") ? (
                            <MessageSquare className="w-4 h-4" />
                          ) : ev.type.includes("material") ? (
                            <BookOpen className="w-4 h-4" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200 capitalize">
                            {ev.type.replace(/_/g, " ")}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {ev.payload.score !== undefined && `Score: ${ev.payload.score}% • `}
                            {ev.payload.filename && `File: ${ev.payload.filename} • `}
                            {ev.payload.count && `Generated ${ev.payload.count} suggestions • `}
                            {new Date(ev.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-400">
                        {ev.type}
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
