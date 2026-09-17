"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Project } from "@/lib/api";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  TrendingUp,
  BarChart3,
  FileText,
  ArrowLeft,
  ArrowRight,
  Target,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function ProjectDashboardPage() {
  const { spaceId, projectId } = useParams() as { spaceId: string; projectId: string };
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await api.getProject(projectId);
      setProject(data);
    } catch (err) {
      console.error("Failed to load project:", err);
      router.push(`/spaces/${spaceId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && projectId) {
      loadProject();
    }
  }, [user, authLoading, projectId]);

  if (authLoading || loading || !project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button & Summary Strip */}
      <div>
        <Link
          href={`/spaces/${spaceId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Space
        </Link>

        {/* Project Header Banner */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                  Project Workspace
                </span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-2">
                  {project.name}
                </h1>
                <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                  {project.description || "No description set for this project."}
                </p>
              </div>

              {/* Mastery Indicator */}
              <div className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4 min-w-[180px] text-center">
                <span className="text-xs text-slate-400 font-medium">Estimated Mastery</span>
                <div className="text-2xl font-bold text-indigo-400 mt-0.5">
                  {project.average_mastery || 0}%
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${project.average_mastery || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {project.goal && (
              <div className="flex items-center gap-2.5 text-sm bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-indigo-200">
                <Target className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong className="font-semibold text-white">Target Goal:</strong> {project.goal}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 Core Learning Loop Action Cards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Learning Subsystems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Materials */}
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/materials`}
            className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-white group-hover:text-blue-300 transition-colors">
                Materials & Ingestion
              </h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                Upload PDFs, extract text & diagrams, and index chunk embeddings via pgvector.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-blue-400 font-medium">
              <span>{project.document_count || 0} Documents</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Open <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>

          {/* AI Tutor */}
          <div className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-white">AI Tutor</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                Grounded chat with streaming tokens, page citations, and insufficient evidence refusal.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-indigo-400 font-medium">
              <span>Grounded RAG</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Start Chat <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Adaptive Quiz */}
          <div className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-white">Adaptive Assessment</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                MCQ and open-ended questions targeting weak concepts with LLM rubric grading.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>{project.concept_count || 0} Concepts</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Take Quiz <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* Growth & Analytics */}
          <div className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-white">Growth & Insights</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                Mastery trends, weakness detection, and tailored next-step recommendations.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1e293b] flex items-center justify-between text-xs text-violet-400 font-medium">
              <span>Recommendations</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Growth <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
