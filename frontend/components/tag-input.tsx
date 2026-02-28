'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [input, setInput] = useState('')

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      if (!tags.includes(input.trim().toLowerCase())) {
        onChange([...tags, input.trim().toLowerCase()])
      }
      setInput('')
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-input px-3 py-2.5 transition-colors focus-within:border-electric">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded bg-[#1e293b] px-2 py-1 font-mono text-xs text-electric"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : 'Type and press Enter...'}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
