import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusPill, ease } from './ui';
import { useHQ, queueOf, patientOf } from '../../lib/hqms';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

export function QueueList({
  deptId,
  showDone = true,
  highlight,
}: {
  deptId: string;
  showDone?: boolean;
  highlight?: string | undefined;
}) {
  const s = useHQ();
  const order = { called: 0, waiting: 1, done: 2 } as const;
  const list = queueOf(s, deptId)
    .filter((t) => showDone || t.status !== 'done')
    .sort((a, b) => order[a.status] - order[b.status] || a.issuedAt - b.issuedAt);

  if (!list.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Queue is empty</p>;
  }

  return (
    <ul className="divide-y divide-border">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const p = patientOf(s, t.uhid);
          return (
            <motion.li
              key={t.code}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease }}
              className={cn('overflow-hidden', t.status === 'done' && 'opacity-50')}
            >
              <div
                className={cn(
                  'flex items-center gap-4 px-5 py-3.5 transition-colors duration-500',
                  highlight === t.code && 'bg-accent/60'
                )}
              >
                <div className="flex items-center gap-1.5 w-20 shrink-0">
                  <span className="mono font-semibold text-sm">{t.code}</span>
                  {t.isEmergency && (
                    <span className="text-[10px] font-bold text-destructive" title="Emergency priority">
                      <AlertCircle className="size-3 text-destructive" />
                    </span>
                  )}
                </div>
                <span className="flex-1 truncate text-sm">
                  {p?.name}
                  <span className="ml-2 text-muted-foreground mono text-[12px]">{t.uhid}</span>
                </span>
                <StatusPill status={t.status} />
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
