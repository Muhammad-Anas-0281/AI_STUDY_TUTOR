"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Sparkles, User as UserIcon, LogOut, Compass } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-[#1e293b] bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            AI Study Companion
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/spaces"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                <Compass className="w-4 h-4 text-indigo-400" />
                Spaces
              </Link>
              {user?.email === "smdanas0281@gmail.com" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-[#1e293b] transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Admin
                </Link>
              )}
              <div className="h-4 w-[1px] bg-slate-800 mx-1" />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-300 bg-[#0f172a] border border-[#1e293b] px-3 py-1.5 rounded-full">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="max-w-[120px] truncate">{user.full_name || user.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1e293b] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
