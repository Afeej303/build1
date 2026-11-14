import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
  showQuickJump?: boolean;
}

/**
 * Generates an array of page numbers and ellipsis tokens
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('ellipsis');
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}

/**
 * Pagination
 * Clean, accessible page switcher with previous/next controls, page numbers,
 * total items counter, and page size selector.
 */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
  pageSizeOptions,
  onPageSizeChange,
  className,
  showQuickJump = false,
}: PaginationProps) {
  if (totalPages <= 1 && !totalItems && !pageSizeOptions) {
    return null;
  }

  const pages = getPageNumbers(currentPage, totalPages);

  // Range calculation for "Showing X to Y of Z"
  let rangeStart = 0;
  let rangeEnd = 0;
  if (totalItems !== undefined && pageSize !== undefined) {
    rangeStart = Math.min((currentPage - 1) * pageSize + 1, totalItems);
    rangeEnd = Math.min(currentPage * pageSize, totalItems);
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {/* Left: Summary and Page Size */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {totalItems !== undefined && pageSize !== undefined ? (
          <span>
            Showing <strong className="font-semibold text-foreground font-mono">{rangeStart}</strong> to{' '}
            <strong className="font-semibold text-foreground font-mono">{rangeEnd}</strong> of{' '}
            <strong className="font-semibold text-foreground font-mono">{totalItems}</strong> entries
          </span>
        ) : totalItems !== undefined ? (
          <span>
            Total <strong className="font-semibold text-foreground font-mono">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-foreground font-mono">{currentPage}</strong> of{' '}
            <strong className="font-semibold text-foreground font-mono">{totalPages}</strong>
          </span>
        )}

        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-1.5 border-l border-border/70 pl-3">
            <span>Per page:</span>
            <select
              aria-label="Select number of items per page"
              disabled={disabled}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-border bg-card px-2 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Controls & Page Numbers */}
      <nav
        aria-label="Pagination"
        className="flex items-center gap-1 self-center sm:self-auto"
      >
        {/* First Page (optional quick jump) */}
        {showQuickJump && totalPages > 5 && (
          <button
            type="button"
            disabled={disabled || currentPage === 1}
            onClick={() => onPageChange(1)}
            aria-label="Go to first page"
            className="press inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}

        {/* Previous Page */}
        <button
          type="button"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className="press inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Number buttons */}
        <div className="flex items-center gap-1 px-1">
          {pages.map((p, index) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-xs text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  •••
                </span>
              );
            }

            const isCurrent = p === currentPage;

            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(p)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  'press inline-flex size-8 items-center justify-center rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 font-mono',
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'border border-border/70 bg-card text-foreground hover:bg-muted'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          disabled={disabled || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className="press inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3.5" />
        </button>

        {/* Last Page (optional quick jump) */}
        {showQuickJump && totalPages > 5 && (
          <button
            type="button"
            disabled={disabled || currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
            aria-label="Go to last page"
            className="press inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}
      </nav>
    </div>
  );
}
