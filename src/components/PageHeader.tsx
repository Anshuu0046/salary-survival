import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-[1.875rem] font-semibold leading-[1.1] sm:text-[2.25rem]">{title}</h1>
        {description && <div className="mt-1.5 max-w-[62ch] text-[0.9375rem] text-ink-600">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
