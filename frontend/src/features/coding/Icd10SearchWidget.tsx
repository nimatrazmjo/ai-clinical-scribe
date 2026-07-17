import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { Icd10Match, Icd10Suggestion } from '@contracts';
import { useIcd10Search } from './useIcd10Search';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';

interface Props {
  existingCodes: string[];
  onAdd: (code: Icd10Suggestion) => void;
}

export function Icd10SearchWidget({ existingCodes, onAdd }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const query = useDebounce(inputValue, 300);
  const { data: results = [], isLoading } = useIcd10Search(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset keyboard focus when results change
  useEffect(() => { setFocusedIdx(-1); }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIdx(-1);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleSelect(match: Icd10Match) {
    if (existingCodes.includes(match.code)) return;
    onAdd({ code: match.code, description: match.description, score: match.score });
    setInputValue('');
    setOpen(false);
    setFocusedIdx(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setFocusedIdx(-1);
      return;
    }
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(prev => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIdx >= 0 && focusedIdx < results.length) {
        handleSelect(results[focusedIdx]);
      }
    }
  }

  const showDropdown = open && query.trim().length >= 2;
  const activeOptionId =
    showDropdown && focusedIdx >= 0 && results[focusedIdx]
      ? `icd10-opt-${results[focusedIdx].code}`
      : undefined;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-7 items-center gap-1.5 rounded border border-input bg-background px-2">
        <Search size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search ICD-10…"
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          aria-label="Search ICD-10 codes"
          aria-autocomplete="list"
          aria-controls={showDropdown ? 'icd10-results' : undefined}
          aria-expanded={showDropdown}
          aria-activedescendant={activeOptionId}
          role="combobox"
        />
        {isLoading && (
          <Loader2 size={10} className="shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {showDropdown && (
        <ul
          id="icd10-results"
          role="listbox"
          aria-label="ICD-10 search results"
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-72 overflow-y-auto rounded border border-border bg-popover shadow-md"
        >
          {results.length === 0 && !isLoading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">No matches found</li>
          )}
          {results.map((match, idx) => {
            const already = existingCodes.includes(match.code);
            const isFocused = idx === focusedIdx;
            return (
              <li
                key={match.code}
                id={`icd10-opt-${match.code}`}
                role="option"
                aria-selected={already}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={already}
                  onClick={() => handleSelect(match)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs focus:outline-none disabled:cursor-default disabled:opacity-40',
                    isFocused ? 'bg-accent' : 'hover:bg-accent',
                  )}
                >
                  <span className="font-mono font-semibold">{match.code}</span>
                  <span className="ml-2 text-muted-foreground">{match.description}</span>
                  {already && <span className="ml-1 text-muted-foreground">(added)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
