import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { LineItemsTable } from '@/components/LineItemsTable';
import { DocumentComments } from '@/components/DocumentComments';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { useDocumentForm } from './forms/useDocumentForm';
import { FormFieldRenderer } from './forms/FormFieldRenderer';
import { FormSuccessView } from './forms/FormSuccessView';
import { StatusFlowIndicator, ApprovalLevelIndicator } from './forms/FormStatusFlow';
import type { FormFieldDef } from './forms/formConfigs';

export const ResourceForm: React.FC = () => {
  const { formType, id } = useParams<{ formType: string; id: string }>();
  const navigate = useNavigate();

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
        <span className="text-gray-600">/</span>
        <span className="cursor-pointer hover:text-nesma-secondary transition-colors">Forms</span>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium">{formConfig.code}</span>
        {isEditMode && (
          <>
            <span className="text-gray-600">/</span>
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
                <span className="text-[10px] text-gray-500">{formConfig.subtitle}</span>
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
            <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <FormIcon className="text-nesma-secondary" size={28} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          {allSections.map((section, idx) => (
            <div key={idx} className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]"></span>
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

          {/* Line Items Section for MRRV, MIRV, MRV */}
          {hasLineItems && (
            <LineItemsTable
              items={lineItems}
              onItemsChange={setLineItems}
              showCondition={formType === 'mrrv' || formType === 'mrv'}
              showStockAvailability={formType === 'mirv'}
            />
          )}

          {/* Approval Level Indicator (auto-calculated) */}
          {hasLineItems && totalValue > 0 && (
            <ApprovalLevelIndicator approvalInfo={approvalInfo} totalValue={totalValue} />
          )}

          {/* Status Flow */}
          <StatusFlowIndicator statusFlow={statusFlow} isEditMode={isEditMode} docStatus={docStatus} />

          {/* Document Comments (only in edit/view mode) */}
          {isEditMode && id && formType && <DocumentComments documentType={formType} documentId={id} />}

          {/* File Attachments (only in edit/view mode) */}
          {isEditMode && id && formType && <DocumentAttachments entityType={formType} recordId={id} />}

          {/* Auto-creation Indicators */}
          {formType === 'mrrv' && (
            <div className="flex gap-3 flex-wrap">
              {Boolean(formData.rfimRequired) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                  <Info size={14} /> Auto-creates RFIM inspection request
                </div>
              )}
              {lineItems.some(li => li.condition === 'Damaged') && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                  <AlertTriangle size={14} /> Damaged items detected -- OSD report will be created
                </div>
              )}
            </div>
          )}
          {formType === 'mirv' && totalValue > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
              <Info size={14} /> Gate Pass will be auto-created when status changes to &quot;Issued&quot;
            </div>
          )}

          {/* Validation Errors */}
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

          {/* Validation Warnings */}
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

          {/* Submit */}
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
                {submitting ? 'Saving...' : isEditMode ? `Update ${formConfig.code}` : 'Save & Submit'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
