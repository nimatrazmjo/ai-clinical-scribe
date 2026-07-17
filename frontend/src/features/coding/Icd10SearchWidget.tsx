import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { Icd10Match, Icd10Suggestion } from '@contracts';
import { useIcd10Search } from './useIcd10Search';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  existingCodes: string[];
  onAdd: (code: Icd10Suggestion) => void;
}

export function Icd10SearchWidget({ existingCodes, onAdd }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const query = useDebounce(inputValue, 300);
  const { data: results = [], isLoading } = useIcd10Search(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
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
    inputRef.current?.focus();
  }

  const showDropdown = open && query.trim().length >= 2;

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
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          aria-label="Search ICD-10 codes"
          aria-autocomplete="list"
          aria-controls={showDropdown ? 'icd10-results' : undefined}
          aria-expanded={showDropdown}
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
          {results.map(match => {
            const already = existingCodes.includes(match.code);
            return (
              <li key={match.code} role="option" aria-selected={already}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => handleSelect(match)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none disabled:cursor-default disabled:opacity-40"
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
