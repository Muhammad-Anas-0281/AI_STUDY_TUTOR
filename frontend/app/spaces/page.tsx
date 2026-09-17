"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Space } from "@/lib/api";
import { Compass, Plus, FolderKanban, ArrowRight, Loader2, Sparkles, BookOpen, Trash2 } from "lucide-react";

export default function SpacesPage() {
  const { user, loading: authLoading } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const data = await api.listSpaces();
      setSpaces(data);
    } catch (err) {
      console.error("Failed to load spaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      loadSpaces();
    }
  }, [user, authLoading]);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    try {
      setCreating(true);
      const space = await api.createSpace({
        name: newSpaceName.trim(),
        description: newSpaceDesc.trim() || undefined,
      });
      setSpaces([space, ...spaces]);
      setShowCreateModal(false);
      setNewSpaceName("");
      setNewSpaceDesc("");
    } catch (err) {
      alert("Failed to create space");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSpace = async (e: React.MouseEvent, spaceId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this space and all its projects?")) return;

    try {
      await api.deleteSpace(spaceId);
      setSpaces(spaces.filter((s) => s.id !== spaceId));
    } catch (err) {
      alert("Failed to delete space");
    }
  };

  if (authLoading || (loading && spaces.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-indigo-400" />
            Learning Spaces
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Organize your subjects, disciplines, or certification roadmaps.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 text-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Create Space
        </button>
      </div>

      {/* Grid of Spaces */}
      {spaces.length === 0 ? (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">No spaces yet</h2>
          <p className="text-slate-400 text-sm mt-1 mb-6">
            Create your first learning space to group related projects and study materials.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Your First Space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((space) => (
            <div
              key={space.id}
              onClick={() => router.push(`/spaces/${space.id}`)}
              className="group bg-[#0f172a] border border-[#1e293b] hover:border-indigo-500/40 rounded-2xl p-6 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-500/5 relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <button
                    onClick={(e) => handleDeleteSpace(e, space.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete space"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-semibold text-lg text-white group-hover:text-indigo-300 transition-colors">
                  {space.name}
                </h3>
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">
                  {space.description || "No description provided."}
                </p>
              </div>

              <div className="border-t border-[#1e293b] pt-4 mt-6 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{space.projects_count || 0} Projects</span>
                <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform">
                  Explore <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h2 className="text-lg font-bold text-white mb-1">Create Learning Space</h2>
            <p className="text-slate-400 text-xs mb-4">A high-level area like Machine Learning, Japanese, or Cloud Architecture.</p>

            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Space Name
                </label>
                <input
                  type="text"
                  required
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g. Distributed Systems"
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  placeholder="Brief description of this learning domain..."
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
