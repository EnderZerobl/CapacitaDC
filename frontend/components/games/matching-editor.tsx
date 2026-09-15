"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newPair } from "@/features/games/drafts"
import type { MatchingCard, MatchingConfig } from "@/features/games/types"
import { EditorField } from "./editor-fields"

export function MatchingEditor({ config, onChange }: { config: MatchingConfig; onChange: (config: MatchingConfig) => void }) {
  const update = (id: string, patch: Partial<MatchingCard>) => onChange({ ...config, pairs: config.pairs.map(pair => pair.id === id ? { ...pair, ...patch } : pair) })
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Cada par liga um item ao seu correspondente. As correspondências são embaralhadas para quem joga, e cada uma só pode ser usada uma vez. A nota é a proporção de pares certos, de 0 a 100.</p>
    {config.pairs.map((pair, index) => <section key={pair.id} className="space-y-4 rounded-lg border p-4" aria-label={`Par ${index + 1}`}>
      <div className="flex items-center justify-between"><h3 className="font-semibold">Par {index + 1}</h3><Button type="button" variant="ghost" size="icon" aria-label={`Excluir par ${index + 1}`} onClick={() => onChange({ ...config, pairs: config.pairs.filter(item => item.id !== pair.id) })}><Trash2 className="size-4" /></Button></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label="Item"><Input value={pair.left} onChange={event => update(pair.id, { left: event.target.value })} /></EditorField>
        <EditorField label="Correspondência correta"><Input value={pair.right} onChange={event => update(pair.id, { right: event.target.value })} /></EditorField>
      </div>
      <EditorField label="Feedback deste par (opcional)"><Textarea rows={2} value={pair.feedback} onChange={event => update(pair.id, { feedback: event.target.value })} /></EditorField>
    </section>)}
    <Button type="button" variant="outline" onClick={() => onChange({ ...config, pairs: [...config.pairs, newPair()] })}><Plus className="size-4" />Adicionar par</Button>
    <section className="space-y-3 rounded-lg border border-dashed p-4" aria-label="Opções extras sem par">
      <h3 className="font-semibold">Opções extras sem par (opcional)</h3>
      <p className="text-sm text-muted-foreground">Correspondências que não pertencem a nenhum item, para que sobrar não signifique acertar.</p>
      {config.distractors.map((card, index) => <div key={card.id} className="flex items-end gap-2">
        <div className="flex-1"><EditorField label={`Opção extra ${index + 1}`}><Input value={card.right} onChange={event => onChange({ ...config, distractors: config.distractors.map(item => item.id === card.id ? { ...item, right: event.target.value } : item) })} /></EditorField></div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Excluir opção extra ${index + 1}`} onClick={() => onChange({ ...config, distractors: config.distractors.filter(item => item.id !== card.id) })}><Trash2 className="size-4" /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...config, distractors: [...config.distractors, { id: crypto.randomUUID(), right: "" }] })}><Plus className="size-4" />Adicionar opção extra</Button>
    </section>
  </div>
}
