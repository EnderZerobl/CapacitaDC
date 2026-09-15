"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newOrderingItem } from "@/features/games/drafts"
import type { OrderingConfig } from "@/features/games/types"
import { EditorField, moveItem } from "./editor-fields"

export function OrderingEditor({ config, onChange }: { config: OrderingConfig; onChange: (config: OrderingConfig) => void }) {
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Cadastre os itens já na ordem correta: esta sequência é o gabarito. Quem joga recebe os itens embaralhados, e a nota é a proporção de posições certas, de 0 a 100.</p>
    <ol className="space-y-3">
      {config.items.map((item, index) => <li key={item.id} className="flex items-end gap-2">
        <div className="flex-1"><EditorField label={`${index + 1}ª posição`}><Input value={item.text} onChange={event => onChange({ ...config, items: config.items.map(entry => entry.id === item.id ? { ...entry, text: event.target.value } : entry) })} /></EditorField></div>
        <Button type="button" size="icon" variant="ghost" aria-label={`Mover item ${index + 1} para cima`} disabled={index === 0} onClick={() => onChange({ ...config, items: moveItem(config.items, index, -1) })}><ArrowUp className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Mover item ${index + 1} para baixo`} disabled={index === config.items.length - 1} onClick={() => onChange({ ...config, items: moveItem(config.items, index, 1) })}><ArrowDown className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Excluir item ${index + 1}`} onClick={() => onChange({ ...config, items: config.items.filter(entry => entry.id !== item.id) })}><Trash2 className="size-4" /></Button>
      </li>)}
    </ol>
    <Button type="button" variant="outline" onClick={() => onChange({ ...config, items: [...config.items, newOrderingItem()] })}><Plus className="size-4" />Adicionar item</Button>
    <EditorField label="Explicação da sequência (opcional)"><Textarea rows={2} value={config.explanation} onChange={event => onChange({ ...config, explanation: event.target.value })} /></EditorField>
  </div>
}
