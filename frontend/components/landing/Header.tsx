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
    { label: "Pre�os", href: "#precos" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      {/* Background with blur */}
      <div className={`absolute inset-0 transition-all duration-300 ${
        scrolled 
          ? "bg-background/80 backdrop-blur-xl border-b border-border/30" 
          : "bg-transparent"
      }`} />
      
      <Container className="relative">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background font-semibold text-base">U</span>
            </div>
            <div className="flex flex-col">
              <span className="text-foreground font-semibold text-lg tracking-tight leading-none">ucm</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">unified commerce</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Login
            </Link>
            <Link
              href="#"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium transition-all duration-200 hover:bg-foreground/90 hover:scale-[1.02] active:scale-100"
            >
              <span>Agendar demo</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden relative w-10 h-10 flex items-center justify-center text-foreground rounded-lg border border-border/30 transition-colors"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <div className="relative w-5 h-4">
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full transition-all duration-200 ${mobileOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full top-1/2 -translate-y-1/2 transition-all duration-200 ${mobileOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`absolute left-0 right-0 h-0.5 bg-current rounded-full transition-all duration-200 ${mobileOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"}`} />
            </div>
          </button>
        </nav>

        {/* Mobile Menu */}
        <div id="mobile-menu" className={`lg:hidden overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? "max-h-[320px] opacity-100 mt-4" : "max-h-0 opacity-0"}`}>
          <div className="p-5 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-muted-foreground rounded-lg transition-colors hover:text-foreground hover:bg-secondary/30"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/30 flex flex-col gap-3">
              <Link href="#" className="px-4 py-2 text-muted-foreground transition-colors hover:text-foreground">
                Login
              </Link>
              <Link 
                href="#" 
                className="mx-4 py-3 bg-foreground text-background rounded-lg text-center text-sm font-medium"
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
