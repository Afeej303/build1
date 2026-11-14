import React, { useRef } from 'react';
import { Search, X, RotateCcw, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: FilterGroup[];
  activeFilterCount?: number;
  onReset?: () => void;
  extraActions?: React.ReactNode;
  className?: string;
}

/**
 * FilterBar
 * Administrative search input with quick clear, responsive filter select dropdowns,
 * active filter counter, and filter reset controls.
 */
export function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  activeFilterCount,
  onReset,
  extraActions,
  className,
}: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute active filters if not explicitly provided
  const computedActiveCount =
    activeFilterCount !== undefined
      ? activeFilterCount
      : filters.filter((f) => f.value && f.value !== '' && f.value !== 'all').length +
        (searchValue ? 1 : 0);

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange('');
    }
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {/* Left: Search input & filter dropdowns */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-xl border border-input bg-card pl-9 pr-8 text-xs sm:text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Clear search query"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter Dropdowns */}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((group) => (
              <div key={group.id} className="relative inline-flex items-center">
                <select
                  aria-label={group.label}
                  disabled={group.disabled}
                  value={group.value}
                  onChange={(e) => group.onChange(e.target.value)}
                  className={cn(
                    'h-9 rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50',
                    group.value && group.value !== '' && group.value !== 'all'
                      ? 'border-primary/50 bg-primary/[0.04] text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  <option value="all">{group.label}: All</option>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Active Filter Counter & Reset */}
        {computedActiveCount > 0 && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="press inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-muted/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-mono font-semibold text-primary-foreground">
              {computedActiveCount}
            </span>
          </button>
        )}
      </div>

      {/* Right: Extra Action Slot */}
      {extraActions && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border/60 pt-2 sm:border-0 sm:pt-0">
          {extraActions}
        </div>
      )}
    </div>
  );
}
