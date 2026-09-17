"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Project, Space } from "@/lib/api";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Compass,
  CheckCircle2,
  TrendingUp,
  BrainCircuit,
  GraduationCap,
  Loader2,
} from "lucide-react";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([api.listProjects(), api.listSpaces()])
        .then(([projData, spaceData]) => {
          setProjects(projData);
          setSpaces(spaceData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // If user is logged in, show personalized learning dashboard
  if (user) {
    return (
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Welcome back
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-2">
                {user.full_name || user.email}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Here is your ongoing learning summary across spaces and projects.
              </p>
            </div>
            <Link
              href="/spaces"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 text-sm w-fit"
            >
              <Compass className="w-4 h-4" />
              Explore Spaces
            </Link>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Active Projects
            </h2>
            <Link
              href="/spaces"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View All Spaces <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 text-center">
              <p className="text-slate-400 text-sm mb-4">No active projects yet.</p>
              <Link
                href="/spaces"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
              >
                Go to Spaces to Create One
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href={`/spaces/${p.space_id}/projects/${p.id}`}
                  className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-5 transition-all hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                      {p.description || "No description provided."}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-500">
                    <span>Mastery: {p.average_mastery || 0}%</span>
                    <span className="text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Landing Page for guests
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-12">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full text-xs font-medium text-indigo-300">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        AI-Powered Learning & Growth Workspace
      </div>

      {/* Hero Title & Description */}
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Master any skill with a{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            persistent AI companion
          </span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Upload learning materials, converse with a grounded AI Tutor, test your understanding
          with adaptive assessments, and track continuous concept mastery.
        </p>
      </div>

      {/* Action CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          href="/register"
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-base"
        >
          <Sparkles className="w-4 h-4" />
          Start Learning Free
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
        <Link
          href="/login"
          className="w-full sm:w-auto bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 hover:text-white border border-[#1e293b] font-medium px-8 py-3.5 rounded-xl transition-colors flex items-center justify-center text-base"
        >
          Sign In
        </Link>
      </div>

      {/* Feature Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full pt-8">
        <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Grounded RAG Tutor</h3>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Streaming answers backed by page-level citations. Refuses to fabricate when evidence is missing.
          </p>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Adaptive Quizzes</h3>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Dynamically targets weak concepts with MCQ and rubric-graded open-ended questions.
          </p>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 mb-4">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Mastery & Growth</h3>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Continuous skill estimation with actionable, automated next-step recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
