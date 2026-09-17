"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Project } from "@/lib/api";
import {
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Send,
  Loader2,
  BookOpen,
  Target,
  AlertTriangle,
  FileText,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Citation {
  filename: string;
  page_number: number;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence_score?: number;
  insufficient_evidence?: boolean;
  created_at?: string;
}

export default function TutorPage() {
  const { spaceId, projectId } = useParams() as { spaceId: string; projectId: string };
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const questionText = customPrompt || inputQuestion;
    if (!questionText.trim() || isStreaming) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const newMessages: Message[] = [
      ...messages,
      {
        id: userMessageId,
        role: "user",
        content: questionText.trim(),
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        citations: [],
        insufficient_evidence: false,
      },
    ];

    setMessages(newMessages);
    setInputQuestion("");
    setIsStreaming(true);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/projects/${projectId}/tutor/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ question: questionText.trim() }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to Tutor stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.substring(6));

              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                  if (eventData.type === "meta") {
                    updated[lastIdx].citations = eventData.citations || [];
                    updated[lastIdx].insufficient_evidence = eventData.insufficient_evidence;
                    updated[lastIdx].confidence_score = eventData.confidence_score;
                  } else if (eventData.type === "token") {
                    updated[lastIdx].content += eventData.token;
                  } else if (eventData.type === "done") {
                    updated[lastIdx].id = eventData.message_id || updated[lastIdx].id;
                    updated[lastIdx].citations = eventData.citations || updated[lastIdx].citations;
                    updated[lastIdx].insufficient_evidence = eventData.insufficient_evidence;
                  }
                }
                return updated;
              });
            } catch (jsonErr) {
              console.error("Error parsing SSE event:", jsonErr);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
          updated[lastIdx].content = "⚠️ Connection error. Please check your network and try again.";
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    "Explain the primary concept in simple terms",
    "How is this formulated mathematically?",
    "Give me a real-world application example",
    "What are common pitfalls or mistakes in this topic?",
  ];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Strip */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}`}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#1e293b] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                AI Tutor: {project?.name}
              </h1>
              <Badge variant="default" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Grounded RAG Active
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Answers are strictly grounded in your uploaded project materials with page-level citations.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setMessages([])}
          className="gap-1.5 text-xs text-slate-400"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Clear Session
        </Button>
      </div>

      {/* Two-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)] min-h-[550px]">
        {/* Left 3 Columns: Chat Thread & Input */}
        <div className="lg:col-span-3 flex flex-col bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-base font-bold text-white">Ask your AI Study Companion</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask any question about your uploaded materials. The AI Tutor retrieves relevant pages, cites its sources, and avoids fabricating unverified information.
                </p>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 gap-2 w-full pt-4 text-left">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(q)}
                      className="text-xs bg-[#090d16] hover:bg-indigo-950/40 border border-[#1e293b] hover:border-indigo-500/40 p-2.5 rounded-xl text-slate-300 hover:text-white transition-all text-left flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">➔</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20 mt-1">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-2`}>
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-600/10"
                          : "bg-[#090d16] border border-[#1e293b] text-slate-200 rounded-tl-none whitespace-pre-wrap"
                      }`}
                    >
                      {msg.content || (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 italic">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Retrieving project context...
                        </span>
                      )}
                    </div>

                    {/* Insufficient Evidence Warning Banner */}
                    {msg.role === "assistant" && msg.insufficient_evidence && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-200 block">Insufficient Project Evidence</span>
                          The uploaded documents for this project do not contain sufficient verified data to answer this query reliably. The Tutor refuses to invent information.
                        </div>
                      </div>
                    )}

                    {/* Grounded Citations Drawer */}
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="border border-[#1e293b] bg-[#090d16]/80 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="w-full px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-indigo-300 flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                            Supporting Sources ({msg.citations.length})
                          </span>
                          {expandedSources[msg.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {expandedSources[msg.id] && (
                          <div className="p-2.5 border-t border-[#1e293b] space-y-1.5 bg-[#090d16]">
                            {msg.citations.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="flex items-center justify-between text-[11px] bg-[#0f172a] border border-[#1e293b] px-2.5 py-1.5 rounded-lg"
                              >
                                <span className="text-white font-medium truncate max-w-[200px]">
                                  {c.filename}
                                </span>
                                <Badge variant="secondary" className="text-[10px]">
                                  Page {c.page_number} • {(c.similarity * 100).toFixed(0)}% match
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t border-[#1e293b] bg-[#090d16]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2.5"
            >
              <Textarea
                ref={textareaRef}
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI Tutor a question (Shift+Enter for newline)..."
                rows={1}
                className="flex-1 min-h-[44px] max-h-32 py-2.5 px-3.5 text-sm"
              />
              <Button
                type="submit"
                disabled={isStreaming || !inputQuestion.trim()}
                className="h-11 px-4 gap-1.5 shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Ask</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Right 1 Column: Project Context Rail */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Learning Goal
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {project?.goal || "Master concepts from your uploaded study materials."}
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Indexed Documents
            </span>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Total Materials</span>
              <Badge variant="secondary">{project?.document_count || 0} files</Badge>
            </div>
            <Link
              href={`/spaces/${spaceId}/projects/${projectId}/materials`}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-block pt-1"
            >
              Upload more materials ➔
            </Link>
          </Card>

          <Card className="p-4 space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Suggested Actions
            </span>
            <div className="space-y-2">
              <Link
                href={`/spaces/${spaceId}/projects/${projectId}/materials`}
                className="w-full text-left text-xs bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] p-2.5 rounded-xl text-slate-300 block transition-colors"
              >
                📚 Manage Materials
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
