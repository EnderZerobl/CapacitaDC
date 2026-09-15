"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BoardCard, GameBoard } from "@/features/games/types"
import { editorSelectClass, moveItem } from "./editor-fields"

// Selects and move buttons keep every board usable by keyboard and on small screens.
export function MatchingBoard({ board, value, onChange, disabled }: { board: GameBoard; value: Record<string, string>; onChange: (leftId: string, rightId: string) => void; disabled?: boolean }) {
  const taken = new Map(Object.entries(value).map(([leftId, rightId]) => [rightId, leftId]))
  return <fieldset disabled={disabled} className="space-y-4">
    <p className="text-sm text-muted-foreground">Escolha a correspondência de cada item. Cada correspondência pode ser usada uma única vez.</p>
    {(board.left || []).map((card, index) => <label key={card.id} className="grid gap-2 rounded-lg border p-4 text-sm">
      <span className="font-medium">{index + 1}. {card.text}</span>
      <select className={editorSelectClass} value={value[card.id] || ""} onChange={event => onChange(card.id, event.target.value)}>
        <option value="">Selecione a correspondência</option>
        {(board.right || []).map(option => <option key={option.id} value={option.id} disabled={taken.has(option.id) && taken.get(option.id) !== card.id}>{option.text}</option>)}
      </select>
    </label>)}
  </fieldset>
}

export function OrderingBoard({ items, onChange, disabled }: { items: BoardCard[]; onChange: (items: BoardCard[]) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="space-y-3">
    <p className="text-sm text-muted-foreground">Use as setas para colocar os itens na sequência correta.</p>
    <ol className="space-y-2">{items.map((item, index) => <li key={item.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">{index + 1}</span>
      <span className="flex-1 whitespace-pre-wrap">{item.text}</span>
      <Button type="button" size="icon" variant="ghost" aria-label={`Mover ${item.text} para cima`} disabled={disabled || index === 0} onClick={() => onChange(moveItem(items, index, -1))}><ArrowUp className="size-4" /></Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Mover ${item.text} para baixo`} disabled={disabled || index === items.length - 1} onClick={() => onChange(moveItem(items, index, 1))}><ArrowDown className="size-4" /></Button>
    </li>)}</ol>
  </fieldset>
}

export function CategorizationBoard({ board, value, onChange, disabled }: { board: GameBoard; value: Record<string, string>; onChange: (itemId: string, categoryId: string) => void; disabled?: boolean }) {
  const categories = board.categories || []
  return <fieldset disabled={disabled} className="space-y-4">
    <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
      <p className="font-medium">Categorias</p>
      <ul className="space-y-1">{categories.map(category => <li key={category.id}><span className="font-medium">{category.text}</span>{category.description && <span className="text-muted-foreground"> — {category.description}</span>}</li>)}</ul>
    </div>
    {(board.items || []).map(item => <label key={item.id} className="grid gap-2 rounded-lg border p-4 text-sm">
      <span className="whitespace-pre-wrap font-medium">{item.text}</span>
      <select className={editorSelectClass} value={value[item.id] || ""} onChange={event => onChange(item.id, event.target.value)}>
        <option value="">Selecione a categoria</option>
        {categories.map(category => <option key={category.id} value={category.id}>{category.text}</option>)}
      </select>
    </label>)}
  </fieldset>
}
