import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useDynamicDocument,
  useCreateDynamicDocument,
  useUpdateDynamicDocument,
  useTransitionDynamicDocument,
} from '@/api/hooks/useDynamicDocuments';
import { useDynamicType } from '@/api/hooks/useDynamicDocumentTypes';
import type { StatusFlowConfig, FieldDefinition } from '@/api/hooks/useDynamicDocumentTypes';
import { DynamicFormRenderer } from '@/components/dynamic-form/DynamicFormRenderer';
import { DynamicLineItemsTable } from '@/components/dynamic-form/DynamicLineItemsTable';
import { CustomFieldsSection } from '@/components/forms/CustomFieldsSection';
import { ArrowLeft, Save, Send, Clock, AlertCircle } from 'lucide-react';

export const DynamicDocumentFormPage: React.FC = () => {
  const { typeCode, id } = useParams<{ typeCode: string; id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  // Fetch type definition (for fields + status flow)
  const { data: typeData } = useDynamicType(typeCode);
  const docType = (
    typeData as { data?: { id: string; name: string; statusFlow: StatusFlowConfig; fields: FieldDefinition[] } }
  )?.data;

  // Fetch existing document (if editing)
  const { data: docData, isLoading: loadingDoc } = useDynamicDocument(typeCode!, isNew ? undefined : id);
  const existingDoc = (
    docData as { data?: { id: string; documentNumber: string; status: string; data: Record<string, unknown> } }
  )?.data;

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [lineItems, setLineItems] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<number, Record<string, string>>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const createMut = useCreateDynamicDocument(typeCode!);
  const updateMut = useUpdateDynamicDocument(typeCode!);
  const transitionMut = useTransitionDynamicDocument(typeCode!);

  // Split fields into header fields and line-item fields
  const headerFields = useMemo(() => (docType?.fields ?? []).filter(f => !f.isLineItem), [docType?.fields]);
  const lineFields = useMemo(() => (docType?.fields ?? []).filter(f => f.isLineItem), [docType?.fields]);
  const hasLineItems = lineFields.length > 0;

  // Initialize form data from defaults or existing doc
  useEffect(() => {
    if (existingDoc?.data) {
      setFormData(existingDoc.data);
      const existingLines = (existingDoc as unknown as { lines?: Record<string, unknown>[] }).lines;
      if (existingLines) setLineItems(existingLines);
    } else if (docType?.fields && isNew) {
      const defaults: Record<string, unknown> = {};
      for (const field of headerFields) {
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          defaults[field.fieldKey] = field.defaultValue;
        }
      }
      setFormData(defaults);
    }
  }, [existingDoc, docType, isNew, headerFields]);

  // Available transitions
  const transitions = useMemo(() => {
    if (!docType?.statusFlow || !existingDoc) return [];
    const flow = docType.statusFlow;
    return flow.transitions[existingDoc.status] ?? [];
  }, [docType, existingDoc]);

  const getStatusLabel = (key: string) => {
    return docType?.statusFlow?.statuses?.find(s => s.key === key)?.label ?? key;
  };

  const handleSave = async () => {
    setErrors({});
    setLineErrors({});
    const payload = {
      data: formData,
      ...(hasLineItems && { lines: lineItems }),
      ...(Object.keys(customFieldValues).length > 0 && { customFields: customFieldValues }),
    };
    try {
      if (isNew) {
        await createMut.mutateAsync(payload);
      } else {
        await updateMut.mutateAsync({ id: id!, ...payload });
      }
      navigate(`/admin/dynamic/${typeCode}`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (
          err as {
            response?: {
              data?: {
                errors?: Array<{ field: string; message: string; line?: number }>;
              };
            };
          }
        ).response;
        if (resp?.data?.errors) {
          const errMap: Record<string, string> = {};
          const lineErrMap: Record<number, Record<string, string>> = {};
          for (const e of resp.data.errors) {
            if (e.line !== undefined) {
              if (!lineErrMap[e.line]) lineErrMap[e.line] = {};
              lineErrMap[e.line][e.field] = e.message;
            } else {
              errMap[e.field] = e.message;
            }
          }
          setErrors(errMap);
          setLineErrors(lineErrMap);
        }
      }
    }
  };

  const handleTransition = async (targetStatus: string) => {
    if (!id) return;
    await transitionMut.mutateAsync({ id, targetStatus });
  };

  if (!docType) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Loading form definition...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isNew ? `New ${docType.name}` : (existingDoc?.documentNumber ?? 'Loading...')}
            </h1>
            {existingDoc && <p className="text-sm text-gray-400 mt-1">Status: {getStatusLabel(existingDoc.status)}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Transition buttons */}
          {transitions.map(targetStatus => (
            <button
              key={targetStatus}
              onClick={() => handleTransition(targetStatus)}
              disabled={transitionMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nesma-secondary/20 text-nesma-secondary hover:bg-nesma-secondary/30 transition-colors"
            >
              <Send size={16} />
              {getStatusLabel(targetStatus)}
            </button>
          ))}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={createMut.isPending || updateMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {(Object.keys(errors).length > 0 || Object.keys(lineErrors).length > 0) && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Please fix the following errors:</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(errors).map(([field, msg]) => (
                <li key={field} className="text-xs text-red-300">
                  {msg}
                </li>
              ))}
              {Object.entries(lineErrors).map(([rowIdx, fields]) =>
                Object.entries(fields).map(([field, msg]) => (
                  <li key={`${rowIdx}-${field}`} className="text-xs text-red-300">
                    Row {Number(rowIdx) + 1}: {msg}
                  </li>
                )),
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Form */}
      {loadingDoc && !isNew ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/5 rounded-lg w-1/3" />
            <div className="h-12 bg-white/5 rounded-lg" />
            <div className="h-12 bg-white/5 rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          <DynamicFormRenderer
            fields={headerFields}
            data={formData}
            onChange={setFormData}
            errors={errors}
            disabled={false}
          />

          {hasLineItems && (
            <DynamicLineItemsTable
              lineFields={lineFields}
              lines={lineItems}
              onLinesChange={setLineItems}
              errors={lineErrors}
            />
          )}

          <CustomFieldsSection
            entityType={`dynamic_${typeCode}`}
            entityId={isNew ? undefined : id}
            values={customFieldValues}
            onChange={setCustomFieldValues}
          />
        </>
      )}

      {/* History */}
      {existingDoc &&
        (
          existingDoc as unknown as {
            history?: Array<{
              id: string;
              fromStatus: string | null;
              toStatus: string;
              performedAt: string;
              performedBy?: { fullName: string };
            }>;
          }
        ).history && (
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock size={20} className="text-nesma-secondary" />
              Status History
            </h3>
            <div className="space-y-3">
              {(
                existingDoc as unknown as {
                  history: Array<{
                    id: string;
                    fromStatus: string | null;
                    toStatus: string;
                    performedAt: string;
                    comment?: string;
                    performedBy?: { fullName: string };
                  }>;
                }
              ).history.map(entry => (
                <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <div className="w-2 h-2 rounded-full bg-nesma-secondary" />
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {entry.fromStatus ? `${getStatusLabel(entry.fromStatus)} → ` : ''}
                      {getStatusLabel(entry.toStatus)}
                    </p>
                    {entry.comment && <p className="text-xs text-gray-400 mt-1">{entry.comment}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{entry.performedBy?.fullName}</p>
                    <p className="text-xs text-gray-500">{new Date(entry.performedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};
