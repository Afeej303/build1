import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  homeHref?: string;
  onHomeClick?: () => void;
  showHome?: boolean;
  className?: string;
}

/**
 * Breadcrumbs
 * Accessible breadcrumbs navigation with icons, keyboard operability,
 * and Apple-grade typography for multi-tenant administrative interfaces.
 */
export function Breadcrumbs({
  items,
  homeHref = '#',
  onHomeClick,
  showHome = true,
  className,
}: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-xs text-muted-foreground', className)}
    >
      <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {showHome && (
          <li className="inline-flex items-center">
            {onHomeClick ? (
              <button
                type="button"
                onClick={onHomeClick}
                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                aria-label="Admin Home"
              >
                <Home className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <a
                href={homeHref}
                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                aria-label="Admin Home"
              >
                <Home className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5 sm:gap-2">
              {(showHome || index > 0) && (
                <ChevronRight
                  className="size-3 text-muted-foreground/60 shrink-0 select-none"
                  aria-hidden="true"
                />
              )}

              {isLast ? (
                <span
                  aria-current="page"
                  className="inline-flex items-center gap-1.5 font-medium text-foreground tracking-tight select-text"
                >
                  {Icon && <Icon className="size-3.5 text-primary shrink-0" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
                >
                  {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              ) : item.href ? (
                <a
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
                >
                  {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                  <span>{item.label}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
