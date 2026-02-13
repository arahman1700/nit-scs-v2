import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { BREADCRUMB_LABELS } from '@/config/breadcrumbMap';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(segment: string): string {
  if (BREADCRUMB_LABELS[segment]) return BREADCRUMB_LABELS[segment];
  if (UUID_RE.test(segment)) return segment.slice(0, 8);
  // Auto-capitalize with dash-to-space
  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const Breadcrumbs: React.FC = memo(() => {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  // Hide on root dashboard pages (single segment like /admin, /warehouse)
  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-6 text-sm text-gray-400">
      <Link
        to={`/${segments[0]}`}
        className="hover:text-nesma-secondary transition-colors flex items-center"
        aria-label="Home"
      >
        <Home size={14} />
      </Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = labelFor(seg);

        return (
          <React.Fragment key={path}>
            <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
            {isLast ? (
              <span aria-current="page" className="text-white font-medium truncate max-w-[200px]">
                {label}
              </span>
            ) : (
              <Link to={path} className="hover:text-nesma-secondary transition-colors truncate max-w-[160px]">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
});
