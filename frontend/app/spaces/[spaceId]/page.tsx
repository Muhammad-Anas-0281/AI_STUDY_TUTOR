"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Space, Project } from "@/lib/api";
import { FolderKanban, Plus, ArrowLeft, ArrowRight, Target, BookOpen, Loader2, Sparkles, Trash2 } from "lucide-react";

export default function SpaceDetailPage() {
  const { spaceId } = useParams() as { spaceId: string };
  const { user, loading: authLoading } = useAuth();
  const [space, setSpace] = useState<(Space & { projects: Project[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const loadSpace = async () => {
    try {
      setLoading(true);
      const data = await api.getSpace(spaceId);
      setSpace(data);
    } catch (err) {
      console.error("Failed to load space:", err);
      router.push("/spaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && spaceId) {
      loadSpace();
    }
  }, [user, authLoading, spaceId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setCreating(true);
      const newProj = await api.createProject({
        space_id: spaceId,
        name: name.trim(),
        description: description.trim() || undefined,
        goal: goal.trim() || undefined,
      });
      if (space) {
        setSpace({
          ...space,
          projects: [newProj, ...(space.projects || [])],
        });
      }
      setShowCreateModal(false);
      setName("");
      setDescription("");
      setGoal("");
    } catch (err) {
      alert("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project and all its materials/history?")) return;

    try {
      await api.deleteProject(projectId);
      if (space) {
        setSpace({
          ...space,
          projects: space.projects.filter((p) => p.id !== projectId),
        });
      }
    } catch (err) {
      alert("Failed to delete project");
    }
  };

  if (authLoading || loading || !space) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back link & Space Header */}
      <div>
        <Link
          href="/spaces"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Spaces
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FolderKanban className="w-6 h-6 text-indigo-400" />
              {space.name}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {space.description || "No description set for this space."}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {space.projects.length === 0 ? (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">No projects yet</h2>
          <p className="text-slate-400 text-sm mt-1 mb-6">
            Create a learning project with a specific goal, upload PDFs, and begin studying with the AI Tutor.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Learning Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {space.projects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/spaces/${space.id}/projects/${project.id}`)}
              className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-semibold text-lg text-white group-hover:text-indigo-300 transition-colors">
                  {project.name}
                </h3>
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                  {project.description || "No description provided."}
                </p>

                {project.goal && (
                  <div className="mt-3 text-xs bg-[#090d16] border border-[#1e293b] rounded-lg p-2.5 text-slate-300">
                    <span className="text-indigo-400 font-semibold">Goal:</span> {project.goal}
                  </div>
                )}
              </div>

              <div className="border-t border-[#1e293b] pt-4 mt-6 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{project.document_count || 0} Docs • {project.concept_count || 0} Concepts</span>
                <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform">
                  Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h2 className="text-lg font-bold text-white mb-1">Create Learning Project</h2>
            <p className="text-slate-400 text-xs mb-4">Set up a focused study journey within {space.name}.</p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Transformers & Attention Mechanisms"
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Learning Goal
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Master Self-Attention mathematical formulation"
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1e293b] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
