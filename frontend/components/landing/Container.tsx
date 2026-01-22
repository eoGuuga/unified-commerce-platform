import React from "react"
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto max-w-7xl px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}
