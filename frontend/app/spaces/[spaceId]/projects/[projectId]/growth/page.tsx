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
  Zap,
  Target,
  Flame,
  BarChart2,
  Brain,
  ChevronRight,
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
  AreaChart,
  Area,
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

export default function GrowthAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const projectId = params.projectId as string;

  const [activeTab, setActiveTab] = useState<"overview" | "concepts" | "recommendations" | "activity">("overview");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <TrendingUp className="w-6 h-6 text-indigo-400 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400">Loading your learning analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sticky Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">Growth & Analytics</h1>
              {metrics && <p className="text-[11px] text-slate-500">{metrics.project_name}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick actions */}
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/quiz`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow"
          >
            <Brain className="w-3.5 h-3.5" /> Take Quiz
          </Link>
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/tutor`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#1e293b] hover:bg-[#334155] text-slate-200 rounded-lg transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Ask Tutor
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAllData}
            className="text-slate-400 hover:text-slate-200 px-2"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* ===== HERO STATS BANNER ===== */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Average Mastery */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
              <div className="relative">
                <RingGauge score={metrics.average_mastery} size={60} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-black text-white">{metrics.average_mastery.toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Avg Mastery</p>
                <p className={`text-sm font-bold mt-0.5 ${getMasteryColor(metrics.average_mastery).text}`}>
                  {getMasteryColor(metrics.average_mastery).label}
                </p>
              </div>
            </div>

            {/* Quizzes Taken */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Quizzes Taken</p>
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Award className="w-3.5 h-3.5 text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-black text-white font-mono">{metrics.total_quizzes_taken}</p>
              <p className="text-[11px] text-slate-500 mt-1">Avg score {metrics.recent_quiz_average.toFixed(0)}%</p>
            </div>

            {/* Concepts Health */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Concepts</p>
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-black text-white font-mono">{metrics.total_concepts}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-emerald-400 font-semibold">{metrics.improving_count} ok</span>
                <span className="text-slate-600">·</span>
                <span className="text-[10px] text-amber-400 font-semibold">{metrics.needs_attention_count} need work</span>
              </div>
            </div>

            {/* Activity */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Study Events</p>
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Flame className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-black text-white font-mono">{metrics.activity_count}</p>
              <p className="text-[11px] text-slate-500 mt-1">Total learning actions</p>
            </div>
          </div>
        )}

        {/* ===== WEAK CONCEPT ALERT ===== */}
        {metrics && metrics.weak_concept_alerts.length > 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-bold text-amber-300">{metrics.weak_concept_alerts.length} concept{metrics.weak_concept_alerts.length > 1 ? "s" : ""} need attention</p>
              <div className="flex flex-wrap gap-2">
                {metrics.weak_concept_alerts.map((w) => (
                  <div key={w.concept_id} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-semibold text-amber-200">{w.concept_name}</span>
                    <span className="text-amber-300/70 ml-2">· {w.reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link href={`/spaces/${spaceId}/projects/${projectId}/quiz`}>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs shrink-0">
                Practice Now
              </Button>
            </Link>
          </div>
        )}

        {/* ===== TAB SWITCHER ===== */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit gap-1">
          {([
            { id: "overview" as const, icon: BarChart2, label: "Overview", count: undefined as number | undefined },
            { id: "concepts" as const, icon: BrainCircuit, label: "Concepts", count: undefined as number | undefined },
            { id: "recommendations" as const, icon: Compass, label: "AI Advice", count: pendingRecommendations.length as number | undefined },
            { id: "activity" as const, icon: Activity, label: "Activity", count: undefined as number | undefined },
          ]).map(({ id, icon: Icon, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === id
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count != null && count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full font-mono ${activeTab === id ? "bg-white/20 text-white" : "bg-indigo-500/30 text-indigo-300"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: OVERVIEW — Quiz Trendline ===== */}
        {activeTab === "overview" && metrics && (
          <div className="space-y-5">
            {/* Quiz Score Progression */}
            <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Quiz Score Progression
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Your performance across all completed assessment sessions over time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.quiz_trend.length < 2 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-slate-800 rounded-xl">
                    <BarChart2 className="w-8 h-8 text-slate-700" />
                    <p className="text-sm text-slate-400 font-medium">Not enough data yet</p>
                    <p className="text-xs text-slate-500">Take at least 2 quizzes to see your score trendline.</p>
                    <Link href={`/spaces/${spaceId}/projects/${projectId}/quiz`}>
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs mt-1">
                        Take a Quiz Now
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics.quiz_trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
                                <p className="text-slate-400 mb-1">{label}</p>
                                <p className="font-bold text-indigo-300 text-base">{payload[0].value}%</p>
                                <p className="text-slate-500">{payload[0].payload.total_questions} questions</p>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          fill="url(#scoreGrad)"
                          dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: "#818cf8" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Concept Mastery Bar Chart */}
            {metrics.concepts.length > 0 && (
              <Card className="border-slate-800 bg-slate-900/60 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-400" />
                    Concept Mastery Overview
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Current mastery score per extracted concept (0–100%).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.concepts.map((c) => ({
                          name: c.name.length > 16 ? c.name.slice(0, 16) + "…" : c.name,
                          fullName: c.name,
                          score: parseFloat(c.score.toFixed(1)),
                          colorScore: c.score,
                        }))}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            const mc = getMasteryColor(d.colorScore);
                            return (
                              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
                                <p className="font-bold text-slate-200 mb-1">{d.fullName}</p>
                                <p className={`font-black text-base ${mc.text}`}>{d.score}%</p>
                                <p className={`font-semibold ${mc.text}`}>{mc.label}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={28}>
                          {metrics.concepts.map((c, i) => (
                            <Cell
                              key={i}
                              fill={c.score >= 80 ? "#10b981" : c.score >= 60 ? "#3b82f6" : c.score >= 40 ? "#6366f1" : c.score >= 20 ? "#f59e0b" : "#ef4444"}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Mastered ≥80%</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Proficient 60–79%</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Practicing 40–59%</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Learning 20–39%</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Struggling &lt;20%</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ===== TAB: CONCEPTS ===== */}
        {activeTab === "concepts" && metrics && (() => {
          // Derived stats for the tier summary
          const mastered = metrics.concepts.filter(c => c.score >= 80).length;
          const proficient = metrics.concepts.filter(c => c.score >= 60 && c.score < 80).length;
          const practicing = metrics.concepts.filter(c => c.score >= 40 && c.score < 60).length;
          const learning = metrics.concepts.filter(c => c.score >= 20 && c.score < 40).length;
          const struggling = metrics.concepts.filter(c => c.score < 20).length;

          // Study tips by tier
          const studyTip = (score: number): string => {
            if (score >= 80) return "Excellent! Try teaching this concept to solidify retention.";
            if (score >= 60) return "Good progress — review edge cases and advanced applications.";
            if (score >= 40) return "Keep practicing — focus on the core definitions and examples.";
            if (score >= 20) return "Needs more attention — revisit materials and ask the AI Tutor.";
            return "Start here — read the source material and ask the AI Tutor for an explanation.";
          };

          // Evidence strength label
          const evidenceStrength = (count: number): { label: string; color: string } => {
            if (count >= 10) return { label: "Strong evidence base", color: "text-emerald-400" };
            if (count >= 5) return { label: "Moderate evidence", color: "text-blue-400" };
            if (count >= 2) return { label: "Limited evidence", color: "text-amber-400" };
            return { label: "Very low evidence", color: "text-red-400" };
          };

          return (
            <div className="space-y-6">
              {/* Section header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-400" />
                    Project Concept Mastery
                    <span className="text-xs font-normal text-slate-500">— {metrics.concepts.length} concepts tracked</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bayesian moving-average mastery scores updated after every quiz and tutor session.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/spaces/${spaceId}/projects/${projectId}/tutor`}>
                    <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Ask Tutor
                    </Button>
                  </Link>
                  <Link href={`/spaces/${spaceId}/projects/${projectId}/quiz`}>
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5">
                      <Brain className="w-3.5 h-3.5" /> Take Quiz
                    </Button>
                  </Link>
                </div>
              </div>

              {/* ── Tier Distribution Summary Strip ── */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Mastered", count: mastered, color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", dot: "bg-emerald-500" },
                  { label: "Proficient", count: proficient, color: "bg-blue-500/10 border-blue-500/30 text-blue-400", dot: "bg-blue-500" },
                  { label: "Practicing", count: practicing, color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400", dot: "bg-indigo-500" },
                  { label: "Learning", count: learning, color: "bg-amber-500/10 border-amber-500/30 text-amber-400", dot: "bg-amber-500" },
                  { label: "Struggling", count: struggling, color: "bg-red-500/10 border-red-500/30 text-red-400", dot: "bg-red-500" },
                ].map(({ label, count, color, dot }) => (
                  <div key={label} className={`flex flex-col items-center p-3 rounded-xl border ${color} text-center`}>
                    <div className={`w-2 h-2 rounded-full ${dot} mb-1.5`} />
                    <span className="text-xl font-black">{count}</span>
                    <span className="text-[10px] font-medium mt-0.5 opacity-80">{label}</span>
                  </div>
                ))}
              </div>

              {/* ── Mastery Distribution Bar ── */}
              {metrics.concepts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Overall Mastery Distribution</p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {mastered > 0 && <div className="bg-emerald-500 rounded-full" style={{ flex: mastered }} title={`Mastered: ${mastered}`} />}
                    {proficient > 0 && <div className="bg-blue-500 rounded-full" style={{ flex: proficient }} title={`Proficient: ${proficient}`} />}
                    {practicing > 0 && <div className="bg-indigo-500 rounded-full" style={{ flex: practicing }} title={`Practicing: ${practicing}`} />}
                    {learning > 0 && <div className="bg-amber-500 rounded-full" style={{ flex: learning }} title={`Learning: ${learning}`} />}
                    {struggling > 0 && <div className="bg-red-500 rounded-full" style={{ flex: struggling }} title={`Struggling: ${struggling}`} />}
                  </div>
                </div>
              )}

              {/* ── Concept Cards Grid ── */}
              {metrics.concepts.length === 0 ? (
                <Card className="border-slate-800 bg-slate-900/60 p-12 text-center">
                  <BrainCircuit className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-300 font-semibold">No Concepts Yet</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Upload study materials and extract concepts to track your mastery.</p>
                  <Link href={`/spaces/${spaceId}/projects/${projectId}/materials`}>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">Upload Materials</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...metrics.concepts]
                    .sort((a, b) => a.score - b.score) // weakest first
                    .map((concept, idx) => {
                      const mc = getMasteryColor(concept.score);
                      const ev = evidenceStrength(concept.evidence_count);
                      const tip = studyTip(concept.score);
                      const rank = idx + 1;
                      const isWeak = concept.score < 40;
                      return (
                        <Card
                          key={concept.id}
                          className={`border bg-slate-900 shadow-xl overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-0.5 ${
                            isWeak ? "border-red-500/20 hover:border-red-500/40" : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {/* Card accent top bar */}
                          <div className={`h-1 w-full ${mc.bg} opacity-80`} />

                          <div className="p-5 space-y-4">
                            {/* ── Header Row ── */}
                            <div className="flex items-start gap-3">
                              {/* Ring gauge */}
                              <div className="relative shrink-0">
                                <RingGauge score={concept.score} size={64} />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className={`text-xs font-black ${mc.text}`}>{concept.score.toFixed(0)}%</span>
                                </div>
                              </div>

                              <div className="flex-1 min-w-0 pt-0.5">
                                {/* Rank badge */}
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] text-slate-500 font-mono">#{rank} weakest</span>
                                  {isWeak && (
                                    <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400 bg-red-500/10 px-1.5 py-0">
                                      Needs Work
                                    </Badge>
                                  )}
                                </div>
                                {/* Concept name */}
                                <h3 className="font-bold text-sm text-white leading-tight">{concept.name}</h3>
                              </div>
                            </div>

                            {/* ── Mastery Level Bar ── */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${mc.text}`}>{mc.label}</span>
                                <span className="text-slate-200 font-mono font-bold">{concept.score.toFixed(1)}%</span>
                              </div>
                              <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`absolute left-0 top-0 h-full rounded-full ${mc.bg}`}
                                  style={{ width: `${concept.score}%`, opacity: 0.85 }}
                                />
                                {/* Milestone markers */}
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

                            {/* ── Description ── */}
                            {concept.description && (
                              <div className="bg-slate-950/60 rounded-xl px-3 py-2.5 border border-slate-800">
                                <p className="text-[11px] text-slate-300 leading-relaxed">{concept.description}</p>
                              </div>
                            )}

                            {/* ── Evidence & Data Quality ── */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-1">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Evidence Points</p>
                                <p className="text-lg font-black text-white font-mono">{concept.evidence_count}</p>
                                <p className={`text-[10px] font-semibold ${ev.color}`}>{ev.label}</p>
                              </div>

                              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-1">
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Status</p>
                                <Badge variant="outline" className={`text-[10px] font-bold uppercase px-2 py-0.5 ${mc.badge}`}>
                                  {concept.status.replace(/_/g, " ")}
                                </Badge>
                                {concept.updated_at && (
                                  <p className="text-[10px] text-slate-600">
                                    Updated {new Date(concept.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* ── Evidence Strength Bar ── */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>Evidence Strength</span>
                                <span className={`font-semibold ${ev.color}`}>{Math.min(concept.evidence_count, 10)}/10</span>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    concept.evidence_count >= 10 ? "bg-emerald-500" :
                                    concept.evidence_count >= 5 ? "bg-blue-500" :
                                    concept.evidence_count >= 2 ? "bg-amber-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.min((concept.evidence_count / 10) * 100, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* ── AI Study Tip ── */}
                            <div className={`rounded-xl px-3 py-2.5 border flex items-start gap-2 ${
                              isWeak
                                ? "bg-red-500/5 border-red-500/20"
                                : concept.score >= 80
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : "bg-indigo-500/5 border-indigo-500/20"
                            }`}>
                              <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isWeak ? "text-red-400" : concept.score >= 80 ? "text-emerald-400" : "text-indigo-400"}`} />
                              <p className="text-[11px] leading-relaxed text-slate-300">{tip}</p>
                            </div>

                            {/* ── Quick Action Buttons ── */}
                            <div className="flex items-center gap-2 pt-1">
                              <Link
                                href={`/spaces/${spaceId}/projects/${projectId}/tutor`}
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
                              <Link
                                href={`/spaces/${spaceId}/projects/${projectId}/quiz`}
                                className="flex-1"
                              >
                                <Button
                                  size="sm"
                                  className={`w-full text-xs gap-1.5 ${
                                    isWeak
                                      ? "bg-red-600 hover:bg-red-500 text-white"
                                      : "bg-violet-600 hover:bg-violet-500 text-white"
                                  }`}
                                >
                                  <Brain className="w-3 h-3" />
                                  {isWeak ? "Practice Now" : "Take Quiz"}
                                </Button>
                              </Link>
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

        {/* ===== TAB: RECOMMENDATIONS ===== */}
        {activeTab === "recommendations" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  AI Study Recommendations
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Personalized actions synthesized from your quiz results and weakest concepts.
                </p>
              </div>
              <Button
                onClick={handleGenerateRecommendations}
                disabled={generatingRecs}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                {generatingRecs ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generatingRecs ? "Generating…" : "Generate New"}
              </Button>
            </div>

            {pendingRecommendations.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center">
                <Compass className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-slate-300 font-semibold mb-1">No Active Recommendations</p>
                <p className="text-xs text-slate-500 mb-5">Take a quiz or click below to generate your personalized study plan.</p>
                <Button
                  onClick={handleGenerateRecommendations}
                  disabled={generatingRecs}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  {generatingRecs ? "Generating…" : "Generate Recommendations"}
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRecommendations.map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 transition-all shadow-lg"
                  >
                    {/* Priority number */}
                    <div className="absolute top-4 left-4 w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-400">
                      {idx + 1}
                    </div>

                    <div className="pl-9 space-y-3">
                      <p className="text-sm font-medium text-slate-100 leading-relaxed">
                        {rec.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                      </p>

                      {rec.reason && (
                        <div className="flex items-start gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl w-fit max-w-full">
                          <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                          <span><span className="font-semibold text-indigo-200">Why: </span>{rec.reason}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/spaces/${spaceId}/projects/${projectId}/tutor`}>
                          <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
                            <MessageSquare className="w-3 h-3 text-indigo-400" /> Ask Tutor
                          </Button>
                        </Link>
                        <Link href={`/spaces/${spaceId}/projects/${projectId}/quiz`}>
                          <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5">
                            <Brain className="w-3 h-3 text-emerald-400" /> Practice Quiz
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateRecStatus(rec.id, "completed")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateRecStatus(rec.id, "dismissed")}
                          className="text-slate-600 hover:text-slate-400 px-2"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed */}
            {completedRecommendations.length > 0 && (
              <div className="pt-5 border-t border-slate-800 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Completed ({completedRecommendations.length})
                </h3>
                <div className="space-y-1.5">
                  {completedRecommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-xs text-slate-500"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="line-through">{rec.text.replace(/\*\*(.*?)\*\*/g, "$1")}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600 shrink-0 ml-3">
                        {new Date(rec.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: ACTIVITY ===== */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Learning Activity Stream
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">All your study sessions, quizzes, and material uploads.</p>
            </div>

            {events.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-slate-300 font-semibold mb-1">No Activity Yet</p>
                <p className="text-xs text-slate-500">Upload materials, chat with the Tutor, or take quizzes to build your activity history.</p>
              </Card>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />
                <div className="space-y-3 pl-12">
                  {events.map((ev) => {
                    const isQuiz = ev.type.includes("quiz");
                    const isTutor = ev.type.includes("tutor");
                    const isMaterial = ev.type.includes("material");
                    return (
                      <div key={ev.id} className="relative">
                        {/* Timeline dot */}
                        <div
                          className={`absolute -left-7 top-3 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center ${
                            isQuiz ? "bg-violet-500" : isTutor ? "bg-indigo-500" : isMaterial ? "bg-blue-500" : "bg-slate-600"
                          }`}
                        />
                        <Card className="border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-all">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-lg ${isQuiz ? "bg-violet-500/10 text-violet-400" : isTutor ? "bg-indigo-500/10 text-indigo-400" : isMaterial ? "bg-blue-500/10 text-blue-400" : "bg-slate-800 text-slate-400"}`}>
                                {isQuiz ? <Award className="w-4 h-4" /> : isTutor ? <MessageSquare className="w-4 h-4" /> : isMaterial ? <BookOpen className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-200 capitalize">{ev.type.replace(/_/g, " ")}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {ev.payload.score !== undefined && `Score: ${ev.payload.score}% · `}
                                  {ev.payload.filename && `${ev.payload.filename} · `}
                                  {ev.payload.count && `${ev.payload.count} items · `}
                                  {new Date(ev.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-500 shrink-0">
                              {ev.type}
                            </Badge>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
