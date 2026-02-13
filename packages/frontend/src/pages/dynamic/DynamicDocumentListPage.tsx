import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDynamicDocumentList } from '@/api/hooks/useDynamicDocuments';
import { useDynamicType } from '@/api/hooks/useDynamicDocumentTypes';
import type { StatusFlowConfig } from '@/api/hooks/useDynamicDocumentTypes';
import { Plus, Search, FileText } from 'lucide-react';

export const DynamicDocumentListPage: React.FC = () => {
  const { typeCode } = useParams<{ typeCode: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: typeData } = useDynamicType(typeCode);
  const docType = (typeData as { data?: unknown })?.data as
    | {
        name: string;
        statusFlow: StatusFlowConfig;
        fields: Array<{ fieldKey: string; label: string; showInGrid: boolean }>;
      }
    | undefined;

  const { data, isLoading } = useDynamicDocumentList(typeCode!, {
    page,
    pageSize: 20,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const documents = ((data as { data?: unknown[] })?.data ?? []) as Array<Record<string, unknown>>;
  const pagination = data as { meta?: { total: number; pageSize: number } } | undefined;
  const total = pagination?.meta?.total ?? 0;

  const gridFields = docType?.fields?.filter(f => f.showInGrid) ?? [];
  const statuses = docType?.statusFlow?.statuses ?? [];

  const getStatusColor = (status: string) => {
    const statusDef = statuses.find(s => s.key === status);
    return statusDef?.color ?? 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{docType?.name ?? typeCode}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {total} document{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate(`/admin/dynamic/${typeCode}/new`)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Create New
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search documents..."
            className="input-field w-full pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field w-full md:w-48 appearance-none"
        >
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-white/5 rounded-lg" />
              ))}
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No documents found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Document #</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                  {gridFields.map(f => (
                    <th key={f.fieldKey} className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Created By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc: Record<string, unknown>) => (
                  <tr
                    key={doc.id as string}
                    onClick={() => navigate(`/admin/dynamic/${typeCode}/${doc.id}`)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-nesma-secondary font-medium">
                      {doc.documentNumber as string}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(doc.status as string)}-500/20 text-${getStatusColor(doc.status as string)}-400`}
                      >
                        {doc.status as string}
                      </span>
                    </td>
                    {gridFields.map(f => (
                      <td key={f.fieldKey} className="px-4 py-3 text-sm text-gray-300">
                        {String((doc.data as Record<string, unknown>)?.[f.fieldKey] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {(doc.createdBy as { fullName: string })?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(doc.createdAt as string).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-white/10">
            <p className="text-sm text-gray-400">
              Page {page} of {Math.ceil(total / 20)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
                className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
