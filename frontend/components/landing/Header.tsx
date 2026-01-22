"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Container } from "./Container"

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { label: "Produto", href: "#solucao" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Precos", href: "#precos" },
    { label: "Clientes", href: "#depoimentos" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-out ${
        scrolled
          ? "py-3"
          : "py-5"
      }`}
    >
      {/* Background with blur */}
      <div className={`absolute inset-0 transition-all duration-700 ${
        scrolled 
          ? "bg-background/80 backdrop-blur-2xl border-b border-border/50" 
          : "bg-transparent"
      }`} />
      
      <Container className="relative">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-accent via-accent to-[oklch(0.65_0.22_200)] flex items-center justify-center overflow-hidden shadow-lg shadow-accent/25 group-hover:shadow-accent/40 transition-shadow duration-500">
              <span className="text-accent-foreground font-bold text-xl relative z-10">U</span>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-foreground font-bold text-xl tracking-tight">ucm</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] -mt-0.5">unified commerce</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center">
            <div className="flex items-center p-1.5 rounded-2xl glass glass-border">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="relative px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-300 rounded-xl group"
                >
                  <span className="relative z-10">{item.label}</span>
                  <div className="absolute inset-0 rounded-xl bg-secondary/0 group-hover:bg-secondary/80 transition-all duration-300" />
                </Link>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-5">
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 link-underline"
            >
              Login
            </Link>
            <Link
              href="#"
              className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl overflow-hidden"
            >
              {/* Button background */}
              <div className="absolute inset-0 bg-foreground rounded-xl transition-all duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-accent to-[oklch(0.65_0.22_280)] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-accent/50 to-[oklch(0.65_0.22_280_/_0.5)] rounded-xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
              
              <span className="relative z-10 text-sm font-semibold text-background transition-colors duration-300">Agendar demo</span>
              <svg className="relative z-10 w-4 h-4 text-background transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden relative w-11 h-11 flex items-center justify-center text-foreground rounded-xl glass glass-border transition-all duration-300"
            aria-label="Menu"
          >
            <div className="relative w-5 h-4">
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full transition-all duration-500 ${mobileOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full top-1/2 -translate-y-1/2 transition-all duration-300 ${mobileOpen ? "opacity-0 scale-0" : "opacity-100"}`} />
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full transition-all duration-500 ${mobileOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"}`} />
            </div>
          </button>
        </nav>

        {/* Mobile Menu */}
        <div className={`lg:hidden overflow-hidden transition-all duration-500 ease-out ${mobileOpen ? "max-h-[400px] opacity-100 mt-6" : "max-h-0 opacity-0"}`}>
          <div className="p-4 rounded-2xl glass glass-border">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-all duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-3">
              <Link href="#" className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors">
                Login
              </Link>
              <Link 
                href="#" 
                className="mx-4 py-3.5 bg-gradient-to-r from-accent to-[oklch(0.65_0.22_280)] text-accent-foreground rounded-xl text-center font-semibold"
              >
                Agendar demo
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </header>
  )
}
