import type { ReactNode } from "react"

export const editorSelectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"

export function EditorField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items]
  const destination = index + direction
  if (destination < 0 || destination >= next.length) return items
  ;[next[index], next[destination]] = [next[destination], next[index]]
  return next
}
