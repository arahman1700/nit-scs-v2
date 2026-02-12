import React, { useMemo } from 'react';
import type { FieldDefinition } from '@/api/hooks/useDynamicDocumentTypes';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';

interface DynamicFormRendererProps {
  fields: FieldDefinition[];
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  fields,
  data,
  onChange,
  errors = {},
  disabled = false,
}) => {
  // Separate header fields from line item fields
  const headerFields = useMemo(
    () => fields.filter(f => !f.isLineItem && f.showInForm).sort((a, b) => a.sortOrder - b.sortOrder),
    [fields],
  );

  // Group fields by section
  const sections = useMemo(() => {
    const groups = new Map<string, FieldDefinition[]>();
    for (const field of headerFields) {
      const section = field.sectionName || 'General';
      const existing = groups.get(section) ?? [];
      existing.push(field);
      groups.set(section, existing);
    }
    return Array.from(groups.entries());
  }, [headerFields]);

  // Check conditional display
  const isFieldVisible = (field: FieldDefinition): boolean => {
    if (!field.conditionalDisplay) return true;
    const cond = field.conditionalDisplay as { dependsOn: string; operator: string; value: unknown };
    const depValue = data[cond.dependsOn];
    switch (cond.operator) {
      case 'eq':
        return depValue === cond.value;
      case 'ne':
        return depValue !== cond.value;
      case 'in':
        return Array.isArray(cond.value) && cond.value.includes(depValue);
      default:
        return true;
    }
  };

  const handleFieldChange = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      {sections.map(([sectionName, sectionFields]) => (
        <div key={sectionName} className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{sectionName}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {sectionFields.map(field =>
              isFieldVisible(field) ? (
                <div key={field.id} className={`col-span-1 md:col-span-${field.colSpan}`}>
                  <DynamicFieldRenderer
                    field={field}
                    value={data[field.fieldKey]}
                    onChange={handleFieldChange}
                    disabled={disabled}
                    error={errors[field.fieldKey]}
                  />
                </div>
              ) : null,
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
