"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, Project } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  TrendingUp,
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

  const loadSessions = async (keepCurrentActive = true) => {
    try {
      const res = await api.get(`/projects/${projectId}/tutor/sessions`);
      const sessionList = res.data || [];
      setSessions(sessionList);
      if (sessionList.length > 0 && !keepCurrentActive) {
        setActiveSessionId(sessionList[0].id);
        setMessages(sessionList[0].messages || []);
      }
    } catch (err) {
      console.error("Failed to load tutor sessions:", err);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && projectId) {
      loadProject();
      loadSessions(false);
    }
  }, [user, authLoading, projectId]);

  const selectSession = (sess: any) => {
    setActiveSessionId(sess.id);
    setMessages(sess.messages || []);
  };

  const startNewSession = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

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
          body: JSON.stringify({
            question: questionText.trim(),
            session_id: activeSessionId || undefined,
          }),
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
                const lastIdx = prev.length - 1;
                if (lastIdx < 0 || prev[lastIdx].role !== "assistant") return prev;

                const lastMsg = prev[lastIdx];
                let updatedMsg = { ...lastMsg };

                if (eventData.type === "meta") {
                  updatedMsg.citations = eventData.citations || [];
                  updatedMsg.insufficient_evidence = eventData.insufficient_evidence;
                  updatedMsg.confidence_score = eventData.confidence_score;
                } else if (eventData.type === "token") {
                  updatedMsg.content = lastMsg.content + eventData.token;
                } else if (eventData.type === "done") {
                  updatedMsg.id = eventData.message_id || lastMsg.id;
                  updatedMsg.citations = eventData.citations || lastMsg.citations;
                  updatedMsg.insufficient_evidence = eventData.insufficient_evidence;
                }

                const updated = [...prev];
                updated[lastIdx] = updatedMsg;
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
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: "Connection error. Please check your network and try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      loadSessions(true);
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
    <div className="space-y-4">
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
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              AI Tutor
              {project?.name && (
                <span className="text-slate-400 font-normal text-base">— {project.name}</span>
              )}
            </h1>
            <p className="text-xs text-slate-500">
              Ask questions grounded in your uploaded study materials
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/quiz`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow-md shadow-violet-500/20"
          >
            <Brain className="w-3.5 h-3.5" />
            Take Quiz
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewSession}
            className="gap-1.5 text-xs border-[#1e293b] text-slate-300 hover:bg-[#1e293b]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New Chat
          </Button>
        </div>
      </div>

      {/* Two-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Left 3 Columns: Chat Thread & Input */}
        <div className="lg:col-span-3 flex flex-col bg-[#0b1120] border border-[#1e293b] rounded-2xl overflow-hidden shadow-2xl">
          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white mb-1">Ask your AI Study Companion</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your questions are answered strictly from your uploaded project materials — no hallucinations, full source citations.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 gap-2 w-full text-left">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(q)}
                      className="text-xs bg-[#0f172a] hover:bg-indigo-950/40 border border-[#1e293b] hover:border-indigo-500/40 p-3 rounded-xl text-slate-300 hover:text-white transition-all text-left flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity text-base">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20 mt-1">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className="max-w-[87%] space-y-2">
                    {/* Message Bubble */}
                    {msg.role === "user" ? (
                      <div className="px-4 py-3 rounded-2xl rounded-br-none bg-indigo-600 text-white text-sm shadow-lg shadow-indigo-600/20">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="px-4 py-4 rounded-2xl rounded-tl-none bg-[#0f172a] border border-[#1e293b] text-slate-200 text-sm">
                        {msg.content ? (
                          <div className="prose prose-invert prose-sm max-w-none
                            prose-headings:text-white prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4
                            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h3:text-indigo-300
                            prose-p:text-slate-200 prose-p:leading-relaxed prose-p:mb-3
                            prose-strong:text-white prose-strong:font-semibold
                            prose-em:text-slate-300 prose-em:italic
                            prose-code:bg-[#1e293b] prose-code:text-violet-300 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                            prose-pre:bg-[#1e293b] prose-pre:border prose-pre:border-[#334155] prose-pre:rounded-xl prose-pre:p-4 prose-pre:overflow-x-auto
                            prose-ul:text-slate-200 prose-ul:list-disc prose-ul:pl-5 prose-ul:space-y-1
                            prose-ol:text-slate-200 prose-ol:list-decimal prose-ol:pl-5 prose-ol:space-y-1
                            prose-li:text-slate-200 prose-li:leading-relaxed
                            prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-400
                            prose-table:border-collapse prose-table:w-full
                            prose-th:bg-[#1e293b] prose-th:p-2 prose-th:text-left prose-th:text-xs prose-th:text-slate-300 prose-th:font-semibold prose-th:border prose-th:border-[#334155]
                            prose-td:p-2 prose-td:text-xs prose-td:border prose-td:border-[#1e293b] prose-td:text-slate-300
                            prose-a:text-indigo-400 prose-a:underline prose-a:hover:text-indigo-300
                            prose-hr:border-[#1e293b]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 italic text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Retrieving project context and composing answer...
                          </span>
                        )}
                      </div>
                    )}

                    {/* Insufficient Evidence Warning Banner */}
                    {msg.role === "assistant" && msg.insufficient_evidence && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-200 block">Insufficient Evidence in Project Materials</span>
                          The uploaded documents do not contain enough verified data for this query. The Tutor refuses to fabricate information.
                        </div>
                      </div>
                    )}

                    {/* Grounded Citations Drawer */}
                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="border border-[#1e293b] bg-[#090d16]/80 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="w-full px-3 py-2 text-xs font-medium text-slate-400 hover:text-indigo-300 flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                            {msg.citations.length} source{msg.citations.length !== 1 ? "s" : ""} cited
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
                                className="flex items-center justify-between text-[11px] bg-[#0f172a] border border-[#1e293b] px-3 py-2 rounded-lg"
                              >
                                <span className="text-slate-200 font-medium truncate max-w-[200px]">
                                  {c.filename}
                                </span>
                                <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                                  Pg {c.page_number} · {(c.similarity * 100).toFixed(0)}% match
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
          <div className="p-4 border-t border-[#1e293b] bg-[#070b14]">
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
                placeholder="Ask anything about your study materials... (Enter to send, Shift+Enter for newline)"
                rows={1}
                className="flex-1 min-h-[44px] max-h-36 py-3 px-4 text-sm bg-[#0f172a] border-[#1e293b] resize-none rounded-xl focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              />
              <Button
                type="submit"
                disabled={isStreaming || !inputQuestion.trim()}
                className="h-11 px-5 gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-500 rounded-xl"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-semibold">Ask</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3.5 overflow-y-auto max-h-[calc(100vh-210px)]">
          {/* Quick Quiz CTA */}
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/quiz`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 border border-violet-500/30 hover:from-violet-500 hover:to-indigo-600 transition-all shadow-lg shadow-violet-500/20 group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Take Adaptive Quiz</p>
              <p className="text-[11px] text-violet-200">Test your understanding now</p>
            </div>
            <Zap className="w-4 h-4 text-violet-200 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* Growth CTA */}
          <Link
            href={`/spaces/${spaceId}/projects/${projectId}/growth`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-[#0f172a] border border-[#1e293b] hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Growth & Analytics</p>
              <p className="text-[11px] text-slate-500">View your mastery progress</p>
            </div>
          </Link>

          {/* Past Sessions */}
          <Card className="p-4 space-y-3 bg-[#0f172a] border-[#1e293b]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                Chat History
              </span>
              <button
                onClick={startNewSession}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                + New
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-600 italic">No past sessions yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const firstUserMsg = s.messages?.find((m: any) => m.role === "user")?.content || s.title || "Study Session";
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSession(s)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border block ${
                        isActive
                          ? "bg-indigo-600/20 border-indigo-500/40 text-white font-medium"
                          : "bg-[#090d16] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <p className="truncate text-[11px]">{firstUserMsg}</p>
                      <span className="text-[10px] text-slate-600 block pt-0.5">
                        {s.messages?.length || 0} messages
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Learning Goal */}
          <Card className="p-4 space-y-2 bg-[#0f172a] border-[#1e293b]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Learning Goal
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {project?.goal || "Master concepts from your uploaded study materials."}
            </p>
          </Card>

          {/* Indexed Documents */}
          <Card className="p-4 space-y-2 bg-[#0f172a] border-[#1e293b]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Indexed Materials
            </span>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Documents indexed</span>
              <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-300 border-blue-500/20">
                {project?.document_count || 0} files
              </Badge>
            </div>
            <Link
              href={`/spaces/${spaceId}/projects/${projectId}/materials`}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-block pt-1 transition-colors"
            >
              Upload more materials →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
