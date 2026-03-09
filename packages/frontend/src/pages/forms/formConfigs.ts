// Re-export types and constants for backward compatibility
export type { FormFieldDef, FormSectionConfig, FormConfig, FormConfigOptions, WizardStepConfig } from './formTypes';
export { STATUS_FLOWS, EDITABLE_STATUSES, VALIDATOR_MAP, getApprovalInfo } from './formConstants';

// Internal imports
import type { FormConfig, FormConfigOptions, FormSectionConfig } from './formTypes';
import { FileText } from 'lucide-react';

// Domain config imports
import { getGrnConfig, getQciConfig, getDrConfig } from './configs/inbound';
import { getMiConfig, getMrnConfig, getMrConfig } from './configs/outbound';
import { getImsfConfig, getWtConfig, getHandoverConfig } from './configs/transfers';
import { getShipmentConfig, getGatePassConfig } from './configs/logistics';
import { getJoConfig, getJoTypeSections as _getJoTypeSections } from './configs/job-orders';
import { getToolConfig, getRentalContractConfig, getGeneratorConfig } from './configs/equipment';
import { getScrapConfig, getSurplusConfig } from './configs/inventory';

// ── Config Registry ──────────────────────────────────────────────────────

const CONFIG_REGISTRY: Record<string, (options: FormConfigOptions) => FormConfig> = {
  // Inbound (V1 + V2 aliases)
  mrrv: getGrnConfig,
  grn: getGrnConfig,
  rfim: getQciConfig,
  qci: getQciConfig,
  osd: getDrConfig,
  dr: getDrConfig,

  // Outbound (V1 + V2 aliases)
  mirv: getMiConfig,
  mi: getMiConfig,
  mrv: getMrnConfig,
  mrn: getMrnConfig,
  mrf: getMrConfig,
  mr: getMrConfig,

  // Transfers
  imsf: getImsfConfig,
  stock_transfer: getWtConfig,
  wt: getWtConfig,
  handover: getHandoverConfig,

  // Logistics
  shipment: getShipmentConfig,
  gatepass: getGatePassConfig,
  gate_pass: getGatePassConfig,

  // Job Orders
  jo: getJoConfig,

  // Equipment
  tool: getToolConfig,
  rental_contract: getRentalContractConfig,
  generator: getGeneratorConfig,

  // Inventory
  scrap: getScrapConfig,
  surplus: getSurplusConfig,
};

// ── Default fallback config ──────────────────────────────────────────────

function getDefaultConfig(): FormConfig {
  return {
    title: 'Generic Form',
    titleEn: 'Generic Form',
    code: 'GEN',
    subtitle: 'Standard Operation Form',
    icon: FileText,
    sections: [
      {
        title: 'Details',
        fields: [{ key: 'description', label: 'Description', type: 'textarea', required: true }],
      },
    ],
  };
}

// ── Public API ───────────────────────────────────────────────────────────

export function getFormConfig(formType: string | undefined, options: FormConfigOptions): FormConfig {
  if (formType && CONFIG_REGISTRY[formType]) {
    return CONFIG_REGISTRY[formType](options);
  }
  return getDefaultConfig();
}

export function getJoTypeSections(joType: string): FormSectionConfig[] {
  return _getJoTypeSections(joType);
}
