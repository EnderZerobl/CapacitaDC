"use client"

import { Fragment } from "react"

// Só endereços completos http(s) viram links. O texto nunca é interpretado como
// HTML: cada trecho é renderizado como texto puro pelo React.
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?'"»”’]+$/

export type TextPart = { text: string; href?: string }

function trimUrl(candidate: string): string {
  let url = candidate.replace(TRAILING_PUNCTUATION, "")
  // Um parêntese final só faz parte do endereço se abrir e fechar dentro dele,
  // como em páginas da Wikipédia; senão ele fecha a frase: "(veja https://x.com)".
  while (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "")
  }
  return url
}

/** Endereço seguro para href, ou null: outros protocolos (javascript:, data:) nunca viram link. */
export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname ? parsed.href : null
  } catch {
    return null
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    const url = trimUrl(match[0])
    const href = safeHref(url)
    if (!href) continue
    if (start > cursor) parts.push({ text: text.slice(cursor, start) })
    parts.push({ text: url, href })
    cursor = start + url.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}

/**
 * Texto de material com URLs clicáveis. Quebras de linha e parágrafos ficam a
 * cargo do contêiner (whitespace-pre-line/pre-wrap), como no texto original.
 */
export function LinkedText({ text }: { text: string }) {
  return <>
    {splitLinks(text).map((part, index) => part.href ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer"
        className="break-all rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {part.text}<span className="sr-only"> (abre em nova aba)</span>
      </a>
    ) : <Fragment key={index}>{part.text}</Fragment>)}
  </>
}
