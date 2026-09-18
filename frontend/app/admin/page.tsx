"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  Shield,
  Users,
  Cpu,
  Activity,
  Server,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Layers,
  FileText,
  HelpCircle,
  Zap,
  ArrowRight,
  Database,
  Terminal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface AdminStats {
  total_users: number;
  total_spaces: number;
  total_projects: number;
  total_documents: number;
  total_chunks: number;
  total_quizzes_taken: number;
  total_events: number;
  total_ai_requests: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
  spaces_count: number;
  projects_count: number;
}

interface AIUsageLog {
  id: string;
  user_id?: string;
  project_id?: string;
  feature: string;
  provider: string;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

interface AIUsageSummary {
  total_requests: number;
  avg_latency_ms: number;
  success_rate: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  by_feature: Record<string, number>;
  by_provider: Record<string, number>;
  by_model: Record<string, number>;
  recent_logs: AIUsageLog[];
}

interface BackgroundJob {
  id: string;
  job_id: string;
  type: string;
  status: string;
  attempts: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

interface SystemHealth {
  status: string;
  database_healthy: boolean;
  database_latency_ms: number;
  pgvector_installed: boolean;
  redis_healthy: boolean;
  redis_latency_ms: number;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [aiSummary, setAiSummary] = useState<AIUsageSummary | null>(null);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [aiFeatureFilter, setAiFeatureFilter] = useState("");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);

  const loadAllAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, aiRes, jobsRes, healthRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/ai-usage?limit=50"),
        api.get("/admin/jobs?limit=30"),
        api.get("/admin/system-health"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setAiSummary(aiRes.data);
      setJobs(jobsRes.data);
      setHealth(healthRes.data);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const ADMIN_EMAIL = "smdanas0281@gmail.com";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && user.email !== ADMIN_EMAIL) {
      // Non-admin users are redirected immediately
      router.push("/spaces");
    } else if (user && user.email === ADMIN_EMAIL) {
      loadAllAdminData();
    }
  }, [user, authLoading]);

  const handleRetryJob = async (jobId: string) => {
    try {
      setRetryingJobId(jobId);
      await api.post(`/admin/jobs/${jobId}/retry`);
      const jobsRes = await api.get("/admin/jobs?limit=30");
      setJobs(jobsRes.data);
    } catch (err) {
      alert("Failed to retry job");
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleViewUser = async (userId: string) => {
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setSelectedUserDetail(res.data);
    } catch (err) {
      console.error("Failed to load user detail:", err);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredAILogs = (aiSummary?.recent_logs || []).filter((log) =>
    aiFeatureFilter ? log.feature === aiFeatureFilter : true
  );

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400">Loading system metrics and telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Platform Administration & Observability
                </h1>
                <Badge
                  variant="default"
                  className={`text-[10px] uppercase font-semibold tracking-wider ${
                    health?.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {health?.status === "healthy" ? "🟢 Systems Operational" : "🟡 Degraded Mode"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Live platform telemetry, token consumption, AI request logs, and infrastructure health.
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAllAdminData}
          className="gap-2 text-xs border-[#1e293b] hover:bg-[#1e293b]"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
        </Button>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#0f172a] border border-[#1e293b] p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Activity className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Users className="w-3.5 h-3.5" /> Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="ai-usage" className="gap-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Cpu className="w-3.5 h-3.5" /> AI Observability ({aiSummary?.total_requests || 0})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Layers className="w-3.5 h-3.5" /> Jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Server className="w-3.5 h-3.5" /> System Health
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: OVERVIEW --- */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Total Users
              </span>
              <p className="text-2xl font-black text-white">{stats?.total_users || 0}</p>
              <span className="text-[10px] text-slate-500">{stats?.total_spaces || 0} active spaces</span>
            </Card>

            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Projects
              </span>
              <p className="text-2xl font-black text-white">{stats?.total_projects || 0}</p>
              <span className="text-[10px] text-slate-500">{stats?.total_documents || 0} docs ({stats?.total_chunks || 0} chunks)</span>
            </Card>

            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Quizzes Evaluated
              </span>
              <p className="text-2xl font-black text-white">{stats?.total_quizzes_taken || 0}</p>
              <span className="text-[10px] text-slate-500">{stats?.total_events || 0} learning events</span>
            </Card>

            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Total AI Calls
              </span>
              <p className="text-2xl font-black text-white">{stats?.total_ai_requests || 0}</p>
              <span className="text-[10px] text-emerald-400 font-medium">$0 Free Tier (Groq + Gemini)</span>
            </Card>
          </div>

          {/* Infrastructure Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 bg-[#0f172a] border-[#1e293b] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" /> Live Services Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <div>
                      <p className="text-xs font-medium text-white">PostgreSQL (Supabase Pooler)</p>
                      <p className="text-[10px] text-slate-500">Latency: {health?.database_latency_ms} ms</p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Connected
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-4 h-4 text-violet-400" />
                    <div>
                      <p className="text-xs font-medium text-white">pgvector Extension (384-dim)</p>
                      <p className="text-[10px] text-slate-500">Cosine Distance Indexing Active</p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs font-medium text-white">AI Inference Engines</p>
                      <p className="text-[10px] text-slate-500">Groq (Tutor Stream) + Gemini (Quiz & Grading)</p>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Ready
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-[#0f172a] border-[#1e293b] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" /> AI Usage Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Success Rate</span>
                  <p className="text-lg font-bold text-emerald-400">{aiSummary?.success_rate}%</p>
                </div>
                <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Avg Latency</span>
                  <p className="text-lg font-bold text-white">{(aiSummary?.avg_latency_ms || 0) / 1000} s</p>
                </div>
                <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Input Tokens</span>
                  <p className="text-lg font-bold text-slate-200">{aiSummary?.total_input_tokens}</p>
                </div>
                <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Output Tokens</span>
                  <p className="text-lg font-bold text-slate-200">{aiSummary?.total_output_tokens}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("ai-usage")}
                className="w-full text-xs gap-1.5"
              >
                Inspect All AI Logs ➔
              </Button>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB 2: USERS DIRECTORY --- */}
        <TabsContent value="users" className="space-y-6">
          <Card className="p-6 bg-[#0f172a] border-[#1e293b] space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search user by email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <span className="text-xs text-slate-400">Total Registered: {users.length}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090d16] text-slate-400 uppercase font-semibold border-b border-[#1e293b]">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Spaces</th>
                    <th className="p-3.5">Projects</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] bg-[#0f172a]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#090d16]/50 transition-colors">
                      <td className="p-3.5 font-medium text-white">
                        <div>
                          <p>{u.email}</p>
                          {u.full_name && <p className="text-[10px] text-slate-400">{u.full_name}</p>}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            u.role === "admin"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-slate-300">{u.spaces_count}</td>
                      <td className="p-3.5 text-slate-300">{u.projects_count}</td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewUser(u.id)}
                          className="text-[11px] h-7 px-2.5"
                        >
                          Drill-down
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Drill-down modal / panel */}
          {selectedUserDetail && (
            <Card className="p-6 bg-[#0f172a] border-indigo-500/40 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  User Profile: {selectedUserDetail.user.email}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserDetail(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕ Close
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-[#090d16] rounded-xl border border-[#1e293b]">
                  <span className="text-slate-400 block text-[10px] uppercase">Spaces Owned</span>
                  <span className="text-base font-bold text-white">{selectedUserDetail.spaces.length}</span>
                </div>
                <div className="p-3 bg-[#090d16] rounded-xl border border-[#1e293b]">
                  <span className="text-slate-400 block text-[10px] uppercase">AI Calls Generated</span>
                  <span className="text-base font-bold text-indigo-400">{selectedUserDetail.total_ai_requests}</span>
                </div>
                <div className="p-3 bg-[#090d16] rounded-xl border border-[#1e293b]">
                  <span className="text-slate-400 block text-[10px] uppercase">Recent Events</span>
                  <span className="text-base font-bold text-emerald-400">{selectedUserDetail.recent_events.length}</span>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* --- TAB 3: AI OBSERVABILITY & LOGS --- */}
        <TabsContent value="ai-usage" className="space-y-6">
          {/* Telemetry Filter & Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Feature Breakdown</span>
              <div className="space-y-1">
                {Object.entries(aiSummary?.by_feature || {}).map(([feat, cnt]) => (
                  <div key={feat} className="flex justify-between text-xs">
                    <span className="text-slate-300 font-mono">{feat}</span>
                    <Badge variant="secondary" className="text-[10px]">{cnt}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Provider Breakdown</span>
              <div className="space-y-1">
                {Object.entries(aiSummary?.by_provider || {}).map(([prov, cnt]) => (
                  <div key={prov} className="flex justify-between text-xs">
                    <span className="text-slate-300 capitalize">{prov}</span>
                    <Badge variant="secondary" className="text-[10px]">{cnt}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 bg-[#0f172a] border-[#1e293b] space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase">Active Models</span>
              <div className="space-y-1">
                {Object.entries(aiSummary?.by_model || {}).map(([mod, cnt]) => (
                  <div key={mod} className="flex justify-between text-xs">
                    <span className="text-slate-300 truncate max-w-[150px] font-mono text-[11px]">{mod}</span>
                    <Badge variant="secondary" className="text-[10px]">{cnt}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Logs Table */}
          <Card className="p-6 bg-[#0f172a] border-[#1e293b] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" /> Recent AI Request Logs
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={aiFeatureFilter === "" ? "default" : "outline"}
                  onClick={() => setAiFeatureFilter("")}
                  className="text-[11px] h-7 px-2.5"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={aiFeatureFilter === "tutor_chat" ? "default" : "outline"}
                  onClick={() => setAiFeatureFilter("tutor_chat")}
                  className="text-[11px] h-7 px-2.5"
                >
                  Tutor
                </Button>
                <Button
                  size="sm"
                  variant={aiFeatureFilter === "quiz_generation" ? "default" : "outline"}
                  onClick={() => setAiFeatureFilter("quiz_generation")}
                  className="text-[11px] h-7 px-2.5"
                >
                  Quiz
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090d16] text-slate-400 uppercase font-semibold border-b border-[#1e293b]">
                  <tr>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Feature</th>
                    <th className="p-3.5">Provider / Model</th>
                    <th className="p-3.5">Latency</th>
                    <th className="p-3.5">Tokens (In/Out)</th>
                    <th className="p-3.5">Cost</th>
                    <th className="p-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] bg-[#0f172a]">
                  {filteredAILogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No AI request logs recorded matching this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAILogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#090d16]/50 transition-colors">
                        <td className="p-3.5">
                          {log.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </td>
                        <td className="p-3.5 font-medium text-white">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {log.feature}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-slate-300">
                          <div>
                            <span className="font-semibold capitalize text-indigo-300">{log.provider}</span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{log.model}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono">
                          {log.latency_ms} ms
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">
                          {log.input_tokens} / {log.output_tokens}
                        </td>
                        <td className="p-3.5 text-emerald-400 font-mono">
                          ${log.cost_usd.toFixed(4)}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* --- TAB 4: BACKGROUND JOBS --- */}
        <TabsContent value="jobs" className="space-y-6">
          <Card className="p-6 bg-[#0f172a] border-[#1e293b] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" /> Background Tasks & Job Ledger
              </h3>
              <Badge variant="secondary" className="text-xs">
                {jobs.length} Jobs Total
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#090d16] text-slate-400 uppercase font-semibold border-b border-[#1e293b]">
                  <tr>
                    <th className="p-3.5">Job ID</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Attempts</th>
                    <th className="p-3.5">Last Error</th>
                    <th className="p-3.5">Created</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] bg-[#0f172a]">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                        No background jobs logged. (Ingestion and assessment are operating synchronously or on-demand).
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id} className="hover:bg-[#090d16]/50 transition-colors">
                        <td className="p-3.5 font-mono text-white truncate max-w-[120px]">{j.job_id}</td>
                        <td className="p-3.5 text-slate-300 font-mono">{j.type}</td>
                        <td className="p-3.5">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              j.status === "ready"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : j.status === "failed"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {j.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-slate-300">{j.attempts}</td>
                        <td className="p-3.5 text-rose-400 truncate max-w-[150px]">{j.last_error || "—"}</td>
                        <td className="p-3.5 text-slate-400">{new Date(j.created_at).toLocaleTimeString()}</td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retryingJobId === j.id}
                            onClick={() => handleRetryJob(j.id)}
                            className="text-[11px] h-7 px-2.5"
                          >
                            {retryingJobId === j.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retry"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* --- TAB 5: SYSTEM HEALTH --- */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-5 bg-[#0f172a] border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-indigo-400" /> PostgreSQL
                </span>
                <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Healthy
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <p>Status: <span className="text-emerald-400 font-semibold">Online</span></p>
                <p>Connection Latency: <span className="text-white font-mono">{health?.database_latency_ms} ms</span></p>
                <p>Pooler: <span className="text-slate-400">Supabase AWS Seoul (port 6543)</span></p>
              </div>
            </Card>

            <Card className="p-5 bg-[#0f172a] border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" /> pgvector Extension
                </span>
                <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Active
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <p>Embedding Dimension: <span className="text-white font-mono">384-dim (MiniLM)</span></p>
                <p>Indexing: <span className="text-emerald-400 font-semibold">Cosine Similarity (<span className="font-mono">&lt;=&gt;</span>)</span></p>
                <p>Status: <span className="text-emerald-400">Available</span></p>
              </div>
            </Card>

            <Card className="p-5 bg-[#0f172a] border-[#1e293b] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Redis Cache / Queue
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {health?.redis_healthy ? "Online" : "Optional"}
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <p>Broker: <span className="text-slate-400">Upstash Serverless Redis</span></p>
                <p>Health: <span className={health?.redis_healthy ? "text-emerald-400" : "text-slate-400"}>{health?.redis_healthy ? "Connected" : "Standby"}</span></p>
                <p>Worker Queue: <span className="text-emerald-400">Ready</span></p>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
