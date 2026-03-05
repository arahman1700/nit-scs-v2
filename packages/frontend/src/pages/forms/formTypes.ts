// ── Form Config Types ─────────────────────────────────────────────────────

export interface FormFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: string;
}

export interface FormSectionConfig {
  title: string;
  fields: FormFieldDef[];
}

export interface FormConfig {
  title: string;
  titleEn: string;
  code: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  sections: FormSectionConfig[];
}

export interface FormConfigOptions {
  projectOptions: string[];
  warehouseOptions: string[];
  supplierOptions: string[];
  mrrvOptions: string[];
  inspectorOptions: string[];
  isEditMode: boolean;
  currentUserName: string;
}
