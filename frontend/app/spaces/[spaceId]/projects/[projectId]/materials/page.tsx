"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Project } from "@/lib/api";
import {
  FileText,
  Upload,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  BookOpen,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface DocumentItem {
  id: string;
  project_id: string;
  filename: string;
  status: "queued" | "processing" | "ready" | "failed";
  page_count: number;
  chunks_count: number;
  error_message?: string;
  created_at: string;
}

interface ChunkItem {
  id: string;
  page_number: number;
  chunk_index: number;
  content: string;
}

interface SearchMatch {
  chunk_id: string;
  filename: string;
  page_number: number;
  content: string;
  similarity: number;
}

export default function MaterialsPage() {
  const { spaceId, projectId } = useParams() as { spaceId: string; projectId: string };
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadData = async () => {
    try {
      setLoading(true);
      const [projData, docsData] = await Promise.all([
        api.getProject(projectId),
        api.listDocuments(projectId),
      ]);
      setProject(projData);
      setDocuments(docsData);
    } catch (err) {
      console.error("Failed to load materials:", err);
      router.push(`/spaces/${spaceId}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && projectId) {
      loadData();
    }
  }, [user, authLoading, projectId]);

  // Polling for processing status
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "queued" || d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const updatedDocs = await api.listDocuments(projectId);
        setDocuments(updatedDocs);
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [documents, projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are supported");
      return;
    }

    try {
      setUploading(true);
      const newDoc = await api.uploadDocument(projectId, file);
      setDocuments([newDoc, ...documents]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      alert(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleInspectDoc = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setLoadingChunks(true);
    try {
      const data = await api.getDocument(doc.id);
      setChunks(data.chunks || []);
    } catch (err) {
      alert("Failed to load document chunks");
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleDeleteDoc = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document and its chunk vectors?")) return;

    try {
      await api.deleteDocument(docId);
      setDocuments(documents.filter((d) => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const results = await api.searchMaterials(projectId, searchQuery.trim(), 4);
      setSearchResults(results);
    } catch (err) {
      alert("Failed to perform vector search");
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </Badge>
        );
      case "queued":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="w-3 h-3" /> Queued
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" /> Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Back Link */}
      <div>
        <Link
          href={`/spaces/${spaceId}/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspace
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e293b] pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-400" />
              Learning Materials & Ingestion
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Upload PDF documents to automatically extract text, split chunks, and index into pgvector.
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="application/pdf"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Document List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Uploaded Documents ({documents.length})
          </h2>

          {documents.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No documents uploaded</h3>
              <p className="text-slate-400 text-xs mt-1 mb-4">
                Upload your lecture notes, textbook chapters, or reference PDFs to feed the AI Tutor.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-3.5 h-3.5" /> Select PDF
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  onClick={() => handleInspectDoc(doc)}
                  className="p-4 hover:border-indigo-500/40 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {doc.filename}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{doc.page_count} Pages</span>
                        <span>•</span>
                        <span>{doc.chunks_count} Chunks</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                      {doc.error_message && (
                        <p className="text-xs text-red-400 mt-1">{doc.error_message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(doc.status)}
                    <button
                      onClick={(e) => handleDeleteDoc(e, doc.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Semantic Vector Retrieval Tester */}
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Semantic Vector Retrieval</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Test how the local <code className="text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded">sentence-transformers</code> model finds relevant chunks in your project via pgvector.
            </p>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask or query project materials..."
                  className="pl-9 text-xs"
                />
              </div>
              <Button type="submit" size="sm" disabled={searching || !searchQuery.trim()} className="w-full gap-2 text-xs">
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Run Vector Search
              </Button>
            </form>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3 border-t border-[#1e293b] pt-4">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Top Matches ({searchResults.length})
                </span>
                {searchResults.map((res, i) => (
                  <div key={i} className="bg-[#090d16] border border-[#1e293b] rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-medium text-white truncate max-w-[150px]">{res.filename}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Pg {res.page_number} • {(res.similarity * 100).toFixed(1)}% match
                      </Badge>
                    </div>
                    <p className="text-slate-300 line-clamp-3 text-[11px] leading-relaxed italic">
                      &quot;{res.content}&quot;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Chunks Inspector Dialog */}
      {selectedDoc && (
        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Layers className="w-4 h-4 text-indigo-400" />
                Extracted Chunks: {selectedDoc.filename}
              </DialogTitle>
              <DialogDescription>
                Review individual semantic chunks and pgvector page references for this document.
              </DialogDescription>
            </DialogHeader>

            {loadingChunks ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : chunks.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No chunks extracted yet or document is still processing.
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="bg-[#090d16] border border-[#1e293b] rounded-xl p-3.5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span className="font-semibold text-indigo-400">Chunk #{chunk.chunk_index + 1}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Page {chunk.page_number}
                      </Badge>
                    </div>
                    <p className="text-slate-200 leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
