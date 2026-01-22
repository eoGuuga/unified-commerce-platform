import React from "react"
import { cn } from "@/lib/utils"

interface ContainerProps {
  children: React.ReactNode
  className?: string
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn(
      "w-full mx-auto",
      // Desktop-first: generous max-width for large displays
      "max-w-[1280px] 2xl:max-w-[1400px]",
      // Horizontal padding: generous on desktop, adapts down
      "px-6 sm:px-8 lg:px-12 xl:px-16",
      className
    )}>
      {children}
    </div>
  )
}
