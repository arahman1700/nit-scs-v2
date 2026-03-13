import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertCircle, AlertTriangle, Info, Loader2, Eye, Paperclip } from 'lucide-react';
import { LineItemsTable } from '@/components/LineItemsTable';
import { DocumentComments } from '@/components/DocumentComments';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { FileUploadZone } from '@/components/FileUploadZone';
import type { UploadedFile } from '@/components/FileUploadZone';
import { useDocumentForm } from '@/pages/forms/useDocumentForm';
import { FormFieldRenderer } from '@/components/forms/FormFieldRenderer';
import { FormSuccessView } from '@/components/forms/FormSuccessView';
import { FormWizard } from '@/components/forms/FormWizard';
import { StatusFlowIndicator, ApprovalLevelIndicator } from '@/components/forms/FormStatusFlow';
import type { FormFieldDef, FormSectionConfig, FormConfig } from '@/pages/forms/formConfigs';
import type { WizardStep } from '@/components/forms/FormWizard';
import type { VoucherLineItem } from '@nit-scs-v2/shared/types';

// ── Shared prop types for extracted sub-components ──────────────────────

interface SharedFormProps {
  allSections: FormSectionConfig[];
  isEditable: boolean;
  isEditMode: boolean;
  formData: Record<string, unknown>;
  lineItems: VoucherLineItem[];
  setLineItems: React.Dispatch<React.SetStateAction<VoucherLineItem[]>>;
  hasLineItems: boolean;
  totalValue: number;
  approvalInfo: { level: string; color: string };
  statusFlow: string[];
  docStatus: string;
  formType: string | undefined;
  id: string | undefined;
  errors: { field: string; rule: string; message: string }[];
  warnings: { field: string; rule: string; message: string }[];
  submitting: boolean;
  uploadedFiles: Record<string, { url: string; name: string; size: number }>;
  uploadPending: boolean;
  uploadError: Error | null;
  getFieldValue: (field: { key: string; defaultValue?: string }) => string;
  getCheckboxValue: (key: string) => boolean;
  handleInputChange: (key: string, value: unknown) => void;
  handleFileUpload: (fieldKey: string, file: File) => Promise<void>;
  handleRemoveFile: (fieldKey: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  /** Multi-file upload zone state for QCI / DR / Scrap new-document mode */
  uploadZoneFiles: UploadedFile[];
  setUploadZoneFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

// ── Flat form content (original rendering) ──────────────────────────────

const FlatFormContent: React.FC<SharedFormProps & { formCode: string; navigate: ReturnType<typeof useNavigate> }> = ({
  allSections,
  isEditable,
  isEditMode,
  formData,
  lineItems,
  setLineItems,
  hasLineItems,
  totalValue,
  approvalInfo,
  statusFlow,
  docStatus,
  formType,
  id,
  errors,
  warnings,
  submitting,
  formCode,
  navigate,
  uploadedFiles,
  uploadPending,
  uploadError,
  getFieldValue,
  getCheckboxValue,
  handleInputChange,
  handleFileUpload,
  handleRemoveFile,
  handleSubmit,
  uploadZoneFiles,
  setUploadZoneFiles,
}) => (
  <form onSubmit={handleSubmit} className="p-8 space-y-10">
    {allSections.map((section, idx) => (
      <div key={idx} className="space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-3">
          <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
          {section.title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {section.fields.map((field: FormFieldDef, fIdx: number) => (
            <FormFieldRenderer
              key={fIdx}
              field={field}
              isEditable={isEditable}
              isEditMode={isEditMode}
              value={getFieldValue(field)}
              checkboxValue={getCheckboxValue(field.key)}
              uploadedFile={uploadedFiles[field.key]}
              uploadPending={uploadPending}
              uploadError={uploadError}
              onInputChange={handleInputChange}
              onFileUpload={handleFileUpload}
              onRemoveFile={handleRemoveFile}
            />
          ))}
        </div>
      </div>
    ))}

    {hasLineItems && (
      <LineItemsTable
        items={lineItems}
        onItemsChange={setLineItems}
        showCondition={formType === 'mrrv' || formType === 'mrv'}
        showStockAvailability={formType === 'mirv'}
      />
    )}

    {hasLineItems && totalValue > 0 && <ApprovalLevelIndicator approvalInfo={approvalInfo} totalValue={totalValue} />}

    <StatusFlowIndicator statusFlow={statusFlow} isEditMode={isEditMode} docStatus={docStatus} />

    {isEditMode && id && formType && <DocumentComments documentType={formType} documentId={id} />}
    {isEditMode && id && formType && <DocumentAttachments entityType={formType} recordId={id} />}

    {/* Multi-file upload zone for QCI inspection photos, DR evidence, and Scrap condition photos */}
    {(formType === 'rfim' || formType === 'osd' || formType === 'scrap') && (!isEditMode || isEditable) && (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-3">
          <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
          <Paperclip size={18} className="text-nesma-secondary" />
          {formType === 'rfim' ? 'Inspection Photos' : formType === 'osd' ? 'Evidence Photos' : 'Condition Photos'}
          {formType === 'scrap' && <span className="text-xs font-normal text-gray-400 ml-1">(minimum 3 required)</span>}
        </h3>
        <FileUploadZone
          entityType={formType === 'rfim' ? 'rfim' : formType === 'osd' ? 'osd' : 'scrap'}
          entityId={isEditMode ? id : undefined}
          maxFiles={10}
          acceptedTypes=".jpg,.jpeg,.png,.pdf"
          files={uploadZoneFiles}
          onFilesChange={setUploadZoneFiles}
        />
      </div>
    )}

    {formType === 'mrrv' && (
      <div className="flex gap-3 flex-wrap">
        {Boolean(formData.rfimRequired) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
            <Info size={14} /> Auto-creates QCI inspection request
          </div>
        )}
        {lineItems.some(li => li.condition === 'Damaged') && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            <AlertTriangle size={14} /> Damaged items detected -- DR report will be created
          </div>
        )}
      </div>
    )}
    {formType === 'mirv' && totalValue > 0 && (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <Info size={14} /> Gate Pass will be auto-created when status changes to &quot;Issued&quot;
      </div>
    )}

    {errors.length > 0 && (
      <div className="space-y-2">
        {errors.map((err, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>
              {err.field ? `${err.field}: ` : ''}
              {err.message}
            </span>
            {err.rule && <span className="text-[10px] text-red-500/60 ml-auto">{err.rule}</span>}
          </div>
        ))}
      </div>
    )}

    {warnings.length > 0 && (
      <div className="space-y-2">
        {warnings.map((warn, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {warn.field ? `${warn.field}: ` : ''}
              {warn.message}
            </span>
            {warn.rule && <span className="text-[10px] text-amber-500/60 ml-auto">{warn.rule}</span>}
          </div>
        ))}
      </div>
    )}

    <div className="pt-8 border-t border-white/10 flex justify-end gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white font-medium transition-all"
      >
        Cancel
      </button>
      {(!isEditMode || isEditable) && (
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-nesma-primary/30 hover:shadow-nesma-primary/50 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
        >
          <Save size={18} />
          {submitting ? 'Saving...' : isEditMode ? `Update ${formCode}` : 'Save & Submit'}
        </button>
      )}
    </div>
  </form>
);

// ── Review summary for wizard's final step ──────────────────────────────

const ReviewSummary: React.FC<{
  allSections: FormSectionConfig[];
  getFieldValue: (field: { key: string; defaultValue?: string }) => string;
  getCheckboxValue: (key: string) => boolean;
  lineItems: VoucherLineItem[];
  hasLineItems: boolean;
  totalValue: number;
  approvalInfo: { level: string; color: string };
  statusFlow: string[];
  isEditMode: boolean;
  docStatus: string;
  errors: { field: string; rule: string; message: string }[];
  warnings: { field: string; rule: string; message: string }[];
}> = ({
  allSections,
  getFieldValue,
  getCheckboxValue,
  lineItems,
  hasLineItems,
  totalValue,
  approvalInfo,
  statusFlow,
  isEditMode,
  docStatus,
  errors,
  warnings,
}) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3 mb-4">
      <Eye size={20} className="text-nesma-secondary" />
      <h3 className="text-lg font-bold text-white">Review Your Submission</h3>
    </div>
    <p className="text-sm text-gray-400">Please review all the information below before submitting.</p>

    {/* Read-only field summary */}
    {allSections.map((section, sIdx) => (
      <div key={sIdx} className="glass-card rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-nesma-secondary">{section.title}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {section.fields.map((field, fIdx) => {
            const value =
              field.type === 'checkbox' ? (getCheckboxValue(field.key) ? 'Yes' : 'No') : getFieldValue(field) || '--';
            return (
              <div key={fIdx} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-sm text-gray-400">{field.label}</span>
                <span className="text-sm text-white font-medium text-right max-w-[60%] truncate">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    ))}

    {/* Line items summary */}
    {hasLineItems && lineItems.length > 0 && (
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-nesma-secondary">Line Items ({lineItems.length})</h4>
        <div className="text-sm text-gray-300">
          {lineItems.map((li, i) => (
            <div key={i} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
              <span className="truncate max-w-[60%]">{li.itemName || `Item ${i + 1}`}</span>
              <span className="text-white font-medium">
                {li.quantity} x {li.unitPrice?.toLocaleString() ?? '0'} = SAR {li.totalPrice?.toLocaleString() ?? '0'}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-3 mt-2 border-t border-white/10 font-bold">
            <span className="text-white">Total Value</span>
            <span className="text-nesma-secondary">SAR {totalValue.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )}

    {/* Approval level */}
    {hasLineItems && totalValue > 0 && <ApprovalLevelIndicator approvalInfo={approvalInfo} totalValue={totalValue} />}

    {/* Status flow */}
    <StatusFlowIndicator statusFlow={statusFlow} isEditMode={isEditMode} docStatus={docStatus} />

    {/* Errors */}
    {errors.length > 0 && (
      <div className="space-y-2">
        {errors.map((err, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>
              {err.field ? `${err.field}: ` : ''}
              {err.message}
            </span>
          </div>
        ))}
      </div>
    )}

    {/* Warnings */}
    {warnings.length > 0 && (
      <div className="space-y-2">
        {warnings.map((warn, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {warn.field ? `${warn.field}: ` : ''}
              {warn.message}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Wizard-based form content ───────────────────────────────────────────

const WizardFormContent: React.FC<SharedFormProps & { formConfig: FormConfig }> = ({
  formConfig,
  allSections,
  isEditable,
  isEditMode,
  formData,
  lineItems,
  setLineItems,
  hasLineItems,
  totalValue,
  approvalInfo,
  statusFlow,
  docStatus,
  formType,
  id,
  errors,
  warnings,
  submitting,
  uploadedFiles,
  uploadPending,
  uploadError,
  getFieldValue,
  getCheckboxValue,
  handleInputChange,
  handleFileUpload,
  handleRemoveFile,
  handleSubmit,
   
  uploadZoneFiles: _uploadZoneFiles,
   
  setUploadZoneFiles: _setUploadZoneFiles,
}) => {
  const wizardStepDefs = formConfig.wizardSteps!;

  const wizardSteps: WizardStep[] = useMemo(
    () =>
      wizardStepDefs.map(stepDef => {
        // Steps with sectionIndices render the corresponding form sections
        if (stepDef.sectionIndices.length > 0) {
          const stepSections = stepDef.sectionIndices.filter(i => i < allSections.length).map(i => allSections[i]);

          return {
            id: stepDef.id,
            label: stepDef.label,
            content: (
              <div className="space-y-10 p-8">
                {stepSections.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                      <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
                      {section.title}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {section.fields.map((field: FormFieldDef, fIdx: number) => (
                        <FormFieldRenderer
                          key={fIdx}
                          field={field}
                          isEditable={isEditable}
                          isEditMode={isEditMode}
                          value={getFieldValue(field)}
                          checkboxValue={getCheckboxValue(field.key)}
                          uploadedFile={uploadedFiles[field.key]}
                          uploadPending={uploadPending}
                          uploadError={uploadError}
                          onInputChange={handleInputChange}
                          onFileUpload={handleFileUpload}
                          onRemoveFile={handleRemoveFile}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Show line items on steps that reference section index 1 (typically the "details" step) */}
                {hasLineItems && stepDef.sectionIndices.includes(1) && (
                  <LineItemsTable
                    items={lineItems}
                    onItemsChange={setLineItems}
                    showCondition={formType === 'mrrv' || formType === 'mrv'}
                    showStockAvailability={formType === 'mirv'}
                  />
                )}

                {/* Auto-creation indicators for relevant steps */}
                {formType === 'mrrv' && stepDef.sectionIndices.includes(1) && (
                  <div className="flex gap-3 flex-wrap">
                    {Boolean(formData.rfimRequired) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                        <Info size={14} /> Auto-creates QCI inspection request
                      </div>
                    )}
                    {lineItems.some(li => li.condition === 'Damaged') && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                        <AlertTriangle size={14} /> Damaged items detected -- DR report will be created
                      </div>
                    )}
                  </div>
                )}
                {formType === 'mirv' && totalValue > 0 && stepDef.sectionIndices.includes(1) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                    <Info size={14} /> Gate Pass will be auto-created when status changes to &quot;Issued&quot;
                  </div>
                )}

                {/* Document comments/attachments in edit mode */}
                {isEditMode && id && formType && stepDef.sectionIndices.includes(0) && (
                  <>
                    <DocumentComments documentType={formType} documentId={id} />
                    <DocumentAttachments entityType={formType} recordId={id} />
                  </>
                )}
              </div>
            ),
          };
        }

        // Steps with empty sectionIndices render the review summary
        return {
          id: stepDef.id,
          label: stepDef.label,
          content: (
            <div className="p-8">
              <ReviewSummary
                allSections={allSections}
                getFieldValue={getFieldValue}
                getCheckboxValue={getCheckboxValue}
                lineItems={lineItems}
                hasLineItems={hasLineItems}
                totalValue={totalValue}
                approvalInfo={approvalInfo}
                statusFlow={statusFlow}
                isEditMode={isEditMode}
                docStatus={docStatus}
                errors={errors}
                warnings={warnings}
              />
            </div>
          ),
        };
      }),
    [
      wizardStepDefs,
      allSections,
      isEditable,
      isEditMode,
      formData,
      lineItems,
      hasLineItems,
      totalValue,
      approvalInfo,
      statusFlow,
      docStatus,
      formType,
      id,
      errors,
      warnings,
      uploadedFiles,
      uploadPending,
      uploadError,
      getFieldValue,
      getCheckboxValue,
      handleInputChange,
      handleFileUpload,
      handleRemoveFile,
      setLineItems,
    ],
  );

  const onWizardSubmit = () => {
    // Create a synthetic form event to reuse the existing handleSubmit logic
    const syntheticEvent = {
      preventDefault: () => {},
    } as React.FormEvent;
    handleSubmit(syntheticEvent);
  };

  return (
    <div className="p-8">
      <FormWizard steps={wizardSteps} onSubmit={onWizardSubmit} submitting={submitting} />
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────

export const ResourceForm: React.FC = () => {
  const { formType, id } = useParams<{ formType: string; id: string }>();
  const navigate = useNavigate();
  const [uploadZoneFiles, setUploadZoneFiles] = useState<UploadedFile[]>([]);

  const {
    formData,
    setFormData,
    lineItems,
    setLineItems,
    isEditMode,
    isEditable,
    isLoadingDoc,
    existingDoc,
    docStatus,
    submitted,
    submitting,
    errors,
    warnings,
    documentNumber,
    reset,
    totalValue,
    approvalInfo,
    hasLineItems,
    nextNumber,
    statusFlow,
    uploadedFiles,
    handleFileUpload,
    handleRemoveFile,
    handleInputChange,
    formConfig,
    allSections,
    editableStatuses,
    initialized,
    detailQuery,
    uploadPending,
    uploadError,
    handleSubmit,
    getFieldValue,
    getCheckboxValue,
  } = useDocumentForm(formType, id);

  const FormIcon = formConfig.icon;
  const hasWizard = !!formConfig.wizardSteps && formConfig.wizardSteps.length > 0;

  // Loading state for edit mode
  if (isLoadingDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
        <Loader2 size={40} className="text-nesma-secondary animate-spin mb-4" />
        <p className="text-gray-400">Loading document...</p>
      </div>
    );
  }

  // Document not found
  if (isEditMode && !isLoadingDoc && !existingDoc && initialized === false && detailQuery && !detailQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] glass-card rounded-2xl p-8 text-center animate-fade-in mx-auto max-w-2xl mt-10 border border-red-500/30 bg-gradient-to-b from-red-900/10 to-transparent">
        <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-6 border border-red-500/50">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Document Not Found</h2>
        <p className="text-gray-400 mb-6">
          The document with ID <span className="font-mono text-nesma-secondary">{id}</span> could not be found.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-medium transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <FormSuccessView
        isEditMode={isEditMode}
        id={id}
        documentNumber={documentNumber}
        formCode={formConfig.code}
        hasLineItems={hasLineItems}
        totalValue={totalValue}
        approvalInfo={approvalInfo}
        onReset={() => {
          reset();
          setFormData({});
          setLineItems([]);
          setUploadZoneFiles([]);
        }}
        onNavigateBack={() => navigate(-1)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-sm text-gray-400">
        <span
          onClick={() => navigate('/admin')}
          className="cursor-pointer hover:text-nesma-secondary transition-colors"
        >
          Dashboard
        </span>
        <span className="text-gray-400">/</span>
        <span className="cursor-pointer hover:text-nesma-secondary transition-colors">Forms</span>
        <span className="text-gray-400">/</span>
        <span className="text-white font-medium">{formConfig.code}</span>
        {isEditMode && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-nesma-secondary font-mono text-xs">{id}</span>
          </>
        )}
      </div>

      {/* Non-editable warning */}
      {isEditMode && !isEditable && (
        <div className="flex items-center gap-3 px-5 py-4 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <p className="font-medium">This document cannot be edited</p>
            <p className="text-sm text-amber-400/70">
              Documents with status &quot;{docStatus}&quot; are read-only. Only documents in{' '}
              {editableStatuses.join(' / ')} status can be modified.
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{formConfig.title}</h1>
              <p className="text-lg text-gray-400 mb-3">{formConfig.titleEn}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
                  {isEditMode ? id : nextNumber}
                </span>
                <span className="text-[10px] text-gray-400">{formConfig.subtitle}</span>
                {isEditMode && docStatus && (
                  <span
                    className={`text-xs px-2 py-1 rounded border ${isEditable ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}
                  >
                    {docStatus}
                  </span>
                )}
                {!isEditMode && (
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Required fields
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <FormIcon className="text-nesma-secondary" size={28} />
              </div>
            </div>
          </div>
        </div>

        {hasWizard && (!isEditMode || isEditable) ? (
          <WizardFormContent
            formConfig={formConfig}
            allSections={allSections}
            isEditable={isEditable}
            isEditMode={isEditMode}
            formData={formData}
            lineItems={lineItems}
            setLineItems={setLineItems}
            hasLineItems={hasLineItems}
            totalValue={totalValue}
            approvalInfo={approvalInfo}
            statusFlow={statusFlow}
            docStatus={docStatus}
            formType={formType}
            id={id}
            errors={errors}
            warnings={warnings}
            submitting={submitting}
            uploadedFiles={uploadedFiles}
            uploadPending={uploadPending}
            uploadError={uploadError}
            getFieldValue={getFieldValue}
            getCheckboxValue={getCheckboxValue}
            handleInputChange={handleInputChange}
            handleFileUpload={handleFileUpload}
            handleRemoveFile={handleRemoveFile}
            handleSubmit={handleSubmit}
            uploadZoneFiles={uploadZoneFiles}
            setUploadZoneFiles={setUploadZoneFiles}
          />
        ) : (
          <FlatFormContent
            allSections={allSections}
            isEditable={isEditable}
            isEditMode={isEditMode}
            formData={formData}
            lineItems={lineItems}
            setLineItems={setLineItems}
            hasLineItems={hasLineItems}
            totalValue={totalValue}
            approvalInfo={approvalInfo}
            statusFlow={statusFlow}
            docStatus={docStatus}
            formType={formType}
            id={id}
            errors={errors}
            warnings={warnings}
            submitting={submitting}
            formCode={formConfig.code}
            navigate={navigate}
            uploadedFiles={uploadedFiles}
            uploadPending={uploadPending}
            uploadError={uploadError}
            getFieldValue={getFieldValue}
            getCheckboxValue={getCheckboxValue}
            handleInputChange={handleInputChange}
            handleFileUpload={handleFileUpload}
            handleRemoveFile={handleRemoveFile}
            handleSubmit={handleSubmit}
            uploadZoneFiles={uploadZoneFiles}
            setUploadZoneFiles={setUploadZoneFiles}
          />
        )}
      </div>
    </div>
  );
};
