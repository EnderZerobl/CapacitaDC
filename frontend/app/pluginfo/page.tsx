"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PlugInfoPage() {
  const router = useRouter()
  useEffect(() => {
    router.push("/")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Redirecionando...</div>
    </div>
  )
}
