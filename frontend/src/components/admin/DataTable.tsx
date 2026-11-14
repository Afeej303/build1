import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  skeletonRows?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  stickyHeader?: boolean;
  className?: string;
  containerClassName?: string;
}

/**
 * DataTable
 * Generic, accessible, high-performance table component supporting generic records,
 * sort indicators, loading skeletons, and integrated empty states.
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  skeletonRows = 5,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription = 'There are currently no items matching your criteria or filters.',
  emptyAction,
  emptyIcon,
  stickyHeader = false,
  className,
  containerClassName,
}: DataTableProps<T>) {
  const getSortIcon = (columnKey: string) => {
    if (sortField !== columnKey) {
      return <ArrowUpDown className="size-3 text-muted-foreground/50 transition-colors group-hover:text-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="size-3 text-primary" />
    ) : (
      <ArrowDown className="size-3 text-primary" />
    );
  };

  const getSortAria = (columnKey: string): React.AriaAttributes['aria-sort'] => {
    if (sortField !== columnKey) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className={cn('surface overflow-hidden', containerClassName)}>
      <div className="overflow-x-auto">
        <table className={cn('w-full border-collapse text-left text-xs sm:text-sm', className)}>
          <thead className={cn('bg-muted/40 border-b border-border/80', stickyHeader && 'sticky top-0 z-10 backdrop-blur-md')}>
            <tr>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={col.sortable ? getSortAria(col.key) : undefined}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] select-none',
                      alignClass,
                      col.headerClassName
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={cn(
                          'group inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1 transition-colors hover:text-foreground',
                          col.align === 'right' && 'flex-row-reverse'
                        )}
                      >
                        <span>{col.header}</span>
                        {getSortIcon(col.key)}
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-row-${rowIndex}`}>
                  {columns.map((col, colIndex) => (
                    <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="px-4 py-3.5">
                      <div
                        className={cn(
                          'skeleton h-4 rounded-md',
                          colIndex === 0 ? 'w-24' : colIndex === columns.length - 1 ? 'w-16 ml-auto' : 'w-32'
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State Row
              <tr>
                <td colSpan={columns.length} className="p-8 sm:p-12 text-center">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    borderDashed={false}
                    compact
                  />
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row, index) => {
                const rowKey = keyExtractor(row, index);
                const isClickable = !!onRowClick;

                return (
                  <tr
                    key={rowKey}
                    onClick={isClickable ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      isClickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={isClickable ? 0 : undefined}
                    role={isClickable ? 'button' : undefined}
                    className={cn(
                      'transition-colors duration-150',
                      isClickable
                        ? 'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/60'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

                      let renderedCell: React.ReactNode;
                      try {
                        renderedCell = col.render
                          ? col.render(row, index)
                          : (row as Record<string, unknown>)[col.key] !== undefined
                          ? String((row as Record<string, unknown>)[col.key])
                          : '—';
                      } catch (cellErr) {
                        console.error(`DataTable cell render error on column ${col.key}:`, cellErr);
                        renderedCell = <span className="text-muted-foreground text-xs italic">—</span>;
                      }

                      return (
                        <td
                          key={`${rowKey}-${col.key}`}
                          className={cn('px-4 py-3.5 text-foreground align-middle', alignClass, col.className)}
                        >
                          {renderedCell}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
