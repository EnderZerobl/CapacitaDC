"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newCategorizedItem, newCategory } from "@/features/games/drafts"
import type { CategorizationConfig } from "@/features/games/types"
import { EditorField, editorSelectClass } from "./editor-fields"

export function CategorizationEditor({ config, onChange }: { config: CategorizationConfig; onChange: (config: CategorizationConfig) => void }) {
  const removeCategory = (id: string) => onChange({
    categories: config.categories.filter(category => category.id !== id),
    items: config.items.map(item => item.category_id === id ? { ...item, category_id: "" } : item),
  })
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Defina as categorias e indique a categoria correta de cada item. Quem joga recebe os itens embaralhados, e a nota é a proporção de itens classificados corretamente, de 0 a 100.</p>
    <section className="space-y-3" aria-label="Categorias">
      <h3 className="font-semibold">Categorias</h3>
      {config.categories.map((category, index) => <div key={category.id} className="space-y-3 rounded-lg border p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1"><EditorField label={`Categoria ${index + 1}`}><Input value={category.text} onChange={event => onChange({ ...config, categories: config.categories.map(item => item.id === category.id ? { ...item, text: event.target.value } : item) })} /></EditorField></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir categoria ${index + 1}`} onClick={() => removeCategory(category.id)}><Trash2 className="size-4" /></Button>
        </div>
        <EditorField label="Descrição (opcional)"><Textarea rows={2} value={category.description} onChange={event => onChange({ ...config, categories: config.categories.map(item => item.id === category.id ? { ...item, description: event.target.value } : item) })} /></EditorField>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...config, categories: [...config.categories, newCategory()] })}><Plus className="size-4" />Adicionar categoria</Button>
    </section>
    <section className="space-y-3" aria-label="Itens para classificar">
      <h3 className="font-semibold">Itens</h3>
      {config.items.map((item, index) => <div key={item.id} className="space-y-3 rounded-lg bg-muted/40 p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1"><EditorField label={`Item ${index + 1}`}><Input value={item.text} onChange={event => onChange({ ...config, items: config.items.map(entry => entry.id === item.id ? { ...entry, text: event.target.value } : entry) })} /></EditorField></div>
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir item ${index + 1}`} onClick={() => onChange({ ...config, items: config.items.filter(entry => entry.id !== item.id) })}><Trash2 className="size-4" /></Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <EditorField label="Categoria correta"><select className={editorSelectClass} value={item.category_id} onChange={event => onChange({ ...config, items: config.items.map(entry => entry.id === item.id ? { ...entry, category_id: event.target.value } : entry) })}><option value="">Selecione a categoria</option>{config.categories.map((category, position) => <option key={category.id} value={category.id}>{category.text || `Categoria ${position + 1}`}</option>)}</select></EditorField>
          <EditorField label="Feedback deste item (opcional)"><Textarea rows={2} value={item.feedback} onChange={event => onChange({ ...config, items: config.items.map(entry => entry.id === item.id ? { ...entry, feedback: event.target.value } : entry) })} /></EditorField>
        </div>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...config, items: [...config.items, newCategorizedItem(config.categories[0]?.id || "")] })}><Plus className="size-4" />Adicionar item</Button>
    </section>
  </div>
}
