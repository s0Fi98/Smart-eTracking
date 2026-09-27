// components/Header.jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ClientHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand Heading */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-emerald-500 bg-white p-1 shadow-md group-hover:scale-105 transition-transform duration-150 shrink-0">
              <Image
                src="/image/Guwahati_Municipal_Corporation_logo.svg.png"
                alt="GMC Emblem"
                width={48}
                height={48}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 leading-none">
                Guwahati Municipal Corporation
              </span>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1 group-hover:text-emerald-300 transition-colors">
                GMC Smart Parking
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <Link
              href="/"
              className="hover:text-emerald-400 transition-colors duration-150"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="hover:text-emerald-400 transition-colors duration-150"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="hover:text-emerald-400 transition-colors duration-150"
            >
              Contact
            </Link>
          </nav>

          {/* Sign In Action Button */}
          <div className="hidden md:flex items-center">
            <Link
              href="/signin"
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 transition-all duration-150"
            >
              Sign In
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 pt-3 pb-5 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-slate-300 hover:text-emerald-400 py-1.5"
          >
            Home
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-slate-300 hover:text-emerald-400 py-1.5"
          >
            About
          </Link>
          <Link
            href="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-semibold text-slate-300 hover:text-emerald-400 py-1.5"
          >
            Contact
          </Link>
          <div className="pt-2">
            <Link
              href="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-md transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}