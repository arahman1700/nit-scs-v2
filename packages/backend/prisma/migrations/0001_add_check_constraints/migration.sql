-- Add CHECK constraints for all status, type, priority, and quantity fields
-- These were previously documented as /// CHECK: comments in the Prisma schema
-- but never enforced at the database level.

-- ══════════════════════════════════════════════════════════════════════
-- REFERENCE TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE ports
  ADD CONSTRAINT chk_ports_port_type
  CHECK (port_type IN ('sea', 'air', 'land'));

-- ══════════════════════════════════════════════════════════════════════
-- MASTER DATA TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE entities
  ADD CONSTRAINT chk_entities_status
  CHECK (status IN ('active', 'inactive'));

ALTER TABLE projects
  ADD CONSTRAINT chk_projects_status
  CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled'));

ALTER TABLE employees
  ADD CONSTRAINT chk_employees_department
  CHECK (department IN ('logistics', 'warehouse', 'transport', 'projects', 'quality', 'finance', 'admin'));

ALTER TABLE employees
  ADD CONSTRAINT chk_employees_system_role
  CHECK (system_role IN ('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff', 'logistics_coordinator', 'site_engineer', 'qc_officer', 'freight_forwarder', 'transport_supervisor', 'scrap_committee_member', 'technical_manager', 'gate_officer', 'inventory_specialist', 'shipping_officer', 'finance_user', 'customs_specialist', 'compliance_officer'));

ALTER TABLE suppliers
  ADD CONSTRAINT chk_suppliers_rating
  CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE suppliers
  ADD CONSTRAINT chk_suppliers_status
  CHECK (status IN ('active', 'inactive', 'blocked'));

ALTER TABLE warehouses
  ADD CONSTRAINT chk_warehouses_status
  CHECK (status IN ('active', 'inactive', 'closed'));

ALTER TABLE items
  ADD CONSTRAINT chk_items_category
  CHECK (category IN ('construction', 'electrical', 'mechanical', 'safety', 'tools', 'consumables', 'spare_parts'));

ALTER TABLE items
  ADD CONSTRAINT chk_items_status
  CHECK (status IN ('active', 'inactive', 'discontinued'));

ALTER TABLE generators
  ADD CONSTRAINT chk_generators_status
  CHECK (status IN ('available', 'assigned', 'maintenance', 'decommissioned'));

ALTER TABLE generators
  ADD CONSTRAINT chk_generators_depreciation_method
  CHECK (depreciation_method IN ('straight_line', 'usage_based'));

-- ══════════════════════════════════════════════════════════════════════
-- INBOUND TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE mrrv
  ADD CONSTRAINT chk_mrrv_status
  CHECK (status IN ('draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected'));

ALTER TABLE mrrv_lines
  ADD CONSTRAINT chk_mrrv_lines_qty_received
  CHECK (qty_received > 0);

ALTER TABLE mrrv_lines
  ADD CONSTRAINT chk_mrrv_lines_condition
  CHECK (condition IN ('good', 'damaged', 'mixed'));

ALTER TABLE rfim
  ADD CONSTRAINT chk_rfim_inspection_type
  CHECK (inspection_type IN ('Visual', 'Functional', 'Dimensional', 'Lab Test'));

ALTER TABLE rfim
  ADD CONSTRAINT chk_rfim_priority
  CHECK (priority IN ('Normal', 'Urgent', 'Critical'));

ALTER TABLE rfim
  ADD CONSTRAINT chk_rfim_result
  CHECK (result IN ('pass', 'fail', 'conditional'));

ALTER TABLE rfim
  ADD CONSTRAINT chk_rfim_status
  CHECK (status IN ('pending', 'in_progress', 'completed'));

ALTER TABLE osd_reports
  ADD CONSTRAINT chk_osd_reports_status
  CHECK (status IN ('draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating', 'resolved', 'closed'));

ALTER TABLE osd_reports
  ADD CONSTRAINT chk_osd_reports_resolution_type
  CHECK (resolution_type IN ('credit_note', 'replacement', 'price_adjustment', 'insurance_claim', 'write_off', 'returned'));

ALTER TABLE osd_lines
  ADD CONSTRAINT chk_osd_lines_damage_type
  CHECK (damage_type IN ('physical', 'water', 'missing_parts', 'wrong_item', 'expired', 'other'));

-- ══════════════════════════════════════════════════════════════════════
-- OUTBOUND TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE mirv
  ADD CONSTRAINT chk_mirv_priority
  CHECK (priority IN ('normal', 'urgent', 'emergency'));

ALTER TABLE mirv
  ADD CONSTRAINT chk_mirv_status
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'completed', 'rejected', 'cancelled'));

ALTER TABLE mirv
  ADD CONSTRAINT chk_mirv_reservation_status
  CHECK (reservation_status IN ('none', 'reserved', 'released'));

ALTER TABLE mirv_lines
  ADD CONSTRAINT chk_mirv_lines_qty_requested
  CHECK (qty_requested > 0);

ALTER TABLE mrv
  ADD CONSTRAINT chk_mrv_return_type
  CHECK (return_type IN ('return_to_warehouse', 'return_to_supplier', 'scrap', 'transfer_to_project'));

ALTER TABLE mrv
  ADD CONSTRAINT chk_mrv_status
  CHECK (status IN ('draft', 'pending', 'received', 'completed', 'rejected'));

ALTER TABLE mrv_lines
  ADD CONSTRAINT chk_mrv_lines_qty_returned
  CHECK (qty_returned > 0);

ALTER TABLE mrv_lines
  ADD CONSTRAINT chk_mrv_lines_condition
  CHECK (condition IN ('good', 'used', 'damaged'));

ALTER TABLE gate_passes
  ADD CONSTRAINT chk_gate_passes_pass_type
  CHECK (pass_type IN ('inbound', 'outbound', 'transfer'));

ALTER TABLE gate_passes
  ADD CONSTRAINT chk_gate_passes_status
  CHECK (status IN ('draft', 'pending', 'approved', 'released', 'returned', 'expired', 'cancelled'));

ALTER TABLE gate_pass_items
  ADD CONSTRAINT chk_gate_pass_items_quantity
  CHECK (quantity > 0);

ALTER TABLE material_requisitions
  ADD CONSTRAINT chk_mrf_department
  CHECK (department IN ('electrical', 'mechanical', 'civil', 'safety', 'general'));

ALTER TABLE material_requisitions
  ADD CONSTRAINT chk_mrf_priority
  CHECK (priority IN ('urgent', 'high', 'medium', 'low'));

ALTER TABLE material_requisitions
  ADD CONSTRAINT chk_mrf_status
  CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'checking_stock', 'from_stock', 'needs_purchase', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled'));

ALTER TABLE mrf_lines
  ADD CONSTRAINT chk_mrf_lines_qty_requested
  CHECK (qty_requested > 0);

ALTER TABLE mrf_lines
  ADD CONSTRAINT chk_mrf_lines_source
  CHECK (source IN ('from_stock', 'purchase_required', 'both', 'tbd'));

ALTER TABLE stock_transfers
  ADD CONSTRAINT chk_stock_transfers_transfer_type
  CHECK (transfer_type IN ('warehouse_to_warehouse', 'project_to_project', 'warehouse_to_project', 'project_to_warehouse'));

ALTER TABLE stock_transfers
  ADD CONSTRAINT chk_stock_transfers_status
  CHECK (status IN ('draft', 'pending', 'approved', 'shipped', 'received', 'completed', 'cancelled'));

ALTER TABLE stock_transfer_lines
  ADD CONSTRAINT chk_stock_transfer_lines_quantity
  CHECK (quantity > 0);

-- ══════════════════════════════════════════════════════════════════════
-- JOB ORDER TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE job_orders
  ADD CONSTRAINT chk_job_orders_jo_type
  CHECK (jo_type IN ('transport', 'equipment', 'rental_monthly', 'rental_daily', 'scrap', 'generator_rental', 'generator_maintenance'));

ALTER TABLE job_orders
  ADD CONSTRAINT chk_job_orders_status
  CHECK (status IN ('draft', 'pending_approval', 'quoted', 'approved', 'assigned', 'in_progress', 'on_hold', 'completed', 'closure_pending', 'closure_approved', 'invoiced', 'rejected', 'cancelled'));

ALTER TABLE job_orders
  ADD CONSTRAINT chk_job_orders_priority
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE jo_generator_details
  ADD CONSTRAINT chk_jo_gen_maintenance_type
  CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency'));

ALTER TABLE jo_equipment_lines
  ADD CONSTRAINT chk_jo_equipment_lines_quantity
  CHECK (quantity > 0);

ALTER TABLE jo_payments
  ADD CONSTRAINT chk_jo_payments_payment_status
  CHECK (payment_status IN ('pending', 'approved', 'paid', 'disputed'));

-- ══════════════════════════════════════════════════════════════════════
-- INVENTORY TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE inventory_levels
  ADD CONSTRAINT chk_inventory_levels_qty_on_hand
  CHECK (qty_on_hand >= 0);

ALTER TABLE inventory_levels
  ADD CONSTRAINT chk_inventory_levels_qty_reserved
  CHECK (qty_reserved >= 0);

ALTER TABLE inventory_lots
  ADD CONSTRAINT chk_inventory_lots_available_qty
  CHECK (available_qty >= 0);

ALTER TABLE inventory_lots
  ADD CONSTRAINT chk_inventory_lots_reserved_qty
  CHECK (reserved_qty >= 0);

ALTER TABLE inventory_lots
  ADD CONSTRAINT chk_inventory_lots_status
  CHECK (status IN ('active', 'depleted', 'expired', 'blocked'));

ALTER TABLE lot_consumptions
  ADD CONSTRAINT chk_lot_consumptions_quantity
  CHECK (quantity > 0);

ALTER TABLE leftover_materials
  ADD CONSTRAINT chk_leftover_condition
  CHECK (condition IN ('new', 'used', 'damaged'));

ALTER TABLE leftover_materials
  ADD CONSTRAINT chk_leftover_ownership
  CHECK (ownership IN ('nit', 'client', 'third_party'));

ALTER TABLE leftover_materials
  ADD CONSTRAINT chk_leftover_disposition
  CHECK (disposition IN ('return_to_warehouse', 'reuse', 'transfer_to_client', 'sell', 'scrap'));

ALTER TABLE leftover_materials
  ADD CONSTRAINT chk_leftover_status
  CHECK (status IN ('identified', 'under_review', 'approved', 'in_progress', 'completed'));

-- ══════════════════════════════════════════════════════════════════════
-- SHIPPING & LOGISTICS TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE shipments
  ADD CONSTRAINT chk_shipments_mode
  CHECK (mode_of_shipment IN ('sea_fcl', 'sea_lcl', 'air', 'land', 'courier'));

ALTER TABLE shipments
  ADD CONSTRAINT chk_shipments_status
  CHECK (status IN ('draft', 'po_issued', 'in_production', 'ready_to_ship', 'in_transit', 'at_port', 'customs_clearing', 'cleared', 'in_delivery', 'delivered', 'cancelled'));

ALTER TABLE customs_tracking
  ADD CONSTRAINT chk_customs_tracking_stage
  CHECK (stage IN ('docs_submitted', 'declaration_filed', 'under_inspection', 'awaiting_payment', 'duties_paid', 'ready_for_release', 'released', 'on_hold', 'rejected'));

ALTER TABLE customs_tracking
  ADD CONSTRAINT chk_customs_tracking_inspection_type
  CHECK (inspection_type IN ('document_review', 'xray_scan', 'physical_inspection', 'lab_testing', 'green_channel'));

ALTER TABLE customs_tracking
  ADD CONSTRAINT chk_customs_tracking_payment_status
  CHECK (payment_status IN ('pending_calculation', 'awaiting_payment', 'paid', 'refund_pending'));

ALTER TABLE supplier_equipment_rates
  ADD CONSTRAINT chk_supplier_rates_status
  CHECK (status IN ('active', 'inactive', 'expired'));

-- ══════════════════════════════════════════════════════════════════════
-- SYSTEM TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE audit_log
  ADD CONSTRAINT chk_audit_log_action
  CHECK (action IN ('create', 'update', 'delete'));

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_status
  CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE tasks
  ADD CONSTRAINT chk_tasks_priority
  CHECK (priority IN ('high', 'medium', 'low'));

ALTER TABLE company_documents
  ADD CONSTRAINT chk_company_docs_category
  CHECK (category IN ('policy', 'procedure', 'contract', 'certificate', 'template', 'sop', 'other'));

ALTER TABLE company_documents
  ADD CONSTRAINT chk_company_docs_visibility
  CHECK (visibility IN ('all', 'admin_only', 'management'));

ALTER TABLE email_logs
  ADD CONSTRAINT chk_email_logs_status
  CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed'));

-- ══════════════════════════════════════════════════════════════════════
-- V2 MODULE TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE imsf
  ADD CONSTRAINT chk_imsf_material_type
  CHECK (material_type IN ('normal', 'hazardous'));

ALTER TABLE imsf
  ADD CONSTRAINT chk_imsf_status
  CHECK (status IN ('created', 'sent', 'confirmed', 'in_transit', 'delivered', 'completed', 'rejected'));

ALTER TABLE bin_card_transactions
  ADD CONSTRAINT chk_bin_card_tx_type
  CHECK (transaction_type IN ('receipt', 'issue', 'adjustment', 'transfer'));

ALTER TABLE bin_card_transactions
  ADD CONSTRAINT chk_bin_card_tx_ref_type
  CHECK (reference_type IN ('grn', 'mi', 'wt', 'adjustment'));

ALTER TABLE rental_contracts
  ADD CONSTRAINT chk_rental_contracts_status
  CHECK (status IN ('draft', 'pending_approval', 'active', 'extended', 'terminated', 'rejected'));

ALTER TABLE generator_maintenance
  ADD CONSTRAINT chk_gen_maint_type
  CHECK (maintenance_type IN ('daily', 'weekly', 'monthly', 'annual'));

ALTER TABLE generator_maintenance
  ADD CONSTRAINT chk_gen_maint_status
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue'));

ALTER TABLE surplus_items
  ADD CONSTRAINT chk_surplus_disposition
  CHECK (disposition IN ('transfer', 'return', 'retain', 'sell'));

ALTER TABLE surplus_items
  ADD CONSTRAINT chk_surplus_status
  CHECK (status IN ('identified', 'evaluated', 'approved', 'actioned', 'closed', 'rejected'));

ALTER TABLE scrap_items
  ADD CONSTRAINT chk_scrap_material_type
  CHECK (material_type IN ('cable', 'mv_cable', 'hv_cable', 'aluminum', 'copper', 'steel', 'cable_tray', 'wood', 'other'));

ALTER TABLE scrap_items
  ADD CONSTRAINT chk_scrap_status
  CHECK (status IN ('identified', 'reported', 'approved', 'in_ssc', 'sold', 'disposed', 'closed', 'rejected'));

ALTER TABLE ssc_bids
  ADD CONSTRAINT chk_ssc_bids_status
  CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected'));

ALTER TABLE tools
  ADD CONSTRAINT chk_tools_condition
  CHECK (condition IN ('good', 'under_maintenance', 'damaged', 'decommissioned'));

ALTER TABLE tool_issues
  ADD CONSTRAINT chk_tool_issues_status
  CHECK (status IN ('issued', 'overdue', 'returned'));

ALTER TABLE warehouse_zones
  ADD CONSTRAINT chk_warehouse_zones_zone_type
  CHECK (zone_type IN ('civil', 'mechanical', 'electrical', 'scrap', 'container', 'open_yard', 'hazardous'));

ALTER TABLE bin_locations
  ADD CONSTRAINT chk_bin_locations_type
  CHECK (location_type IN ('picking', 'bulk', 'staging', 'quarantine', 'returns', 'overflow'));

ALTER TABLE storekeeper_handovers
  ADD CONSTRAINT chk_handovers_status
  CHECK (status IN ('initiated', 'in_progress', 'completed'));

ALTER TABLE cycle_counts
  ADD CONSTRAINT chk_cycle_counts_status
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE cycle_counts
  ADD CONSTRAINT chk_cycle_counts_count_type
  CHECK (count_type IN ('full', 'abc_based', 'zone', 'random'));

ALTER TABLE cycle_count_lines
  ADD CONSTRAINT chk_cycle_count_lines_status
  CHECK (status IN ('pending', 'counted', 'verified', 'adjusted'));

ALTER TABLE cross_docks
  ADD CONSTRAINT chk_cross_docks_status
  CHECK (status IN ('identified', 'approved', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE inspection_checklist_items
  ADD CONSTRAINT chk_inspection_items_type
  CHECK (inspection_type IN ('visual', 'measurement', 'functional', 'documentation'));

-- ══════════════════════════════════════════════════════════════════════
-- WAREHOUSE OPS TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE packing_sessions
  ADD CONSTRAINT chk_packing_sessions_status
  CHECK (status IN ('in_progress', 'completed', 'cancelled'));

ALTER TABLE packing_lines
  ADD CONSTRAINT chk_packing_lines_container_type
  CHECK (container_type IN ('carton', 'pallet', 'crate', 'loose'));

ALTER TABLE staging_assignments
  ADD CONSTRAINT chk_staging_source_doc_type
  CHECK (source_doc_type IN ('grn', 'mi', 'wt', 'cross_dock'));

ALTER TABLE staging_assignments
  ADD CONSTRAINT chk_staging_direction
  CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE staging_assignments
  ADD CONSTRAINT chk_staging_status
  CHECK (status IN ('staged', 'moved', 'expired'));

ALTER TABLE dock_doors
  ADD CONSTRAINT chk_dock_doors_door_type
  CHECK (door_type IN ('inbound', 'outbound', 'both'));

ALTER TABLE dock_doors
  ADD CONSTRAINT chk_dock_doors_status
  CHECK (status IN ('available', 'occupied', 'maintenance'));

ALTER TABLE yard_appointments
  ADD CONSTRAINT chk_yard_appt_type
  CHECK (appointment_type IN ('delivery', 'pickup', 'transfer'));

ALTER TABLE yard_appointments
  ADD CONSTRAINT chk_yard_appt_ref_type
  CHECK (reference_type IN ('asn', 'grn', 'mi', 'wt'));

ALTER TABLE yard_appointments
  ADD CONSTRAINT chk_yard_appt_status
  CHECK (status IN ('scheduled', 'checked_in', 'loading', 'completed', 'cancelled', 'no_show'));

ALTER TABLE truck_visits
  ADD CONSTRAINT chk_truck_visits_purpose
  CHECK (purpose IN ('delivery', 'pickup', 'transfer'));

ALTER TABLE truck_visits
  ADD CONSTRAINT chk_truck_visits_status
  CHECK (status IN ('in_yard', 'at_dock', 'departed'));

ALTER TABLE sensors
  ADD CONSTRAINT chk_sensors_sensor_type
  CHECK (sensor_type IN ('temperature', 'humidity', 'smoke', 'motion', 'weight'));

ALTER TABLE sensor_alerts
  ADD CONSTRAINT chk_sensor_alerts_alert_type
  CHECK (alert_type IN ('threshold_high', 'threshold_low', 'offline'));

-- ══════════════════════════════════════════════════════════════════════
-- EQUIPMENT & COMPLIANCE TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE equipment_delivery_notes
  ADD CONSTRAINT chk_equip_dn_condition
  CHECK (condition_on_delivery IN ('excellent', 'good', 'fair', 'poor'));

ALTER TABLE equipment_delivery_notes
  ADD CONSTRAINT chk_equip_dn_status
  CHECK (status IN ('draft', 'confirmed', 'cancelled'));

ALTER TABLE equipment_return_notes
  ADD CONSTRAINT chk_equip_rn_condition
  CHECK (condition_on_return IN ('excellent', 'good', 'fair', 'poor'));

ALTER TABLE equipment_return_notes
  ADD CONSTRAINT chk_equip_rn_fuel_level
  CHECK (fuel_level IN ('full', 'three_quarter', 'half', 'quarter', 'empty'));

ALTER TABLE equipment_return_notes
  ADD CONSTRAINT chk_equip_rn_status
  CHECK (status IN ('draft', 'inspected', 'confirmed', 'disputed'));

ALTER TABLE supplier_evaluations
  ADD CONSTRAINT chk_supplier_eval_status
  CHECK (status IN ('draft', 'completed'));

ALTER TABLE transport_orders
  ADD CONSTRAINT chk_transport_orders_status
  CHECK (status IN ('draft', 'scheduled', 'in_transit', 'delivered', 'cancelled'));

ALTER TABLE visitor_passes
  ADD CONSTRAINT chk_visitor_passes_status
  CHECK (status IN ('scheduled', 'checked_in', 'checked_out', 'overstay', 'cancelled'));

ALTER TABLE annual_maintenance_contracts
  ADD CONSTRAINT chk_amc_status
  CHECK (status IN ('draft', 'active', 'expired', 'terminated'));

ALTER TABLE annual_maintenance_contracts
  ADD CONSTRAINT chk_amc_coverage_type
  CHECK (coverage_type IN ('comprehensive', 'parts_only', 'labor_only'));

ALTER TABLE annual_maintenance_contracts
  ADD CONSTRAINT chk_amc_pm_frequency
  CHECK (preventive_maintenance_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly'));

ALTER TABLE assets
  ADD CONSTRAINT chk_assets_category
  CHECK (category IN ('equipment', 'vehicle', 'furniture', 'it_hardware', 'tools', 'other'));

ALTER TABLE assets
  ADD CONSTRAINT chk_assets_depreciation_method
  CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none'));

ALTER TABLE assets
  ADD CONSTRAINT chk_assets_status
  CHECK (status IN ('active', 'maintenance', 'retired', 'disposed', 'lost'));

ALTER TABLE assets
  ADD CONSTRAINT chk_assets_condition
  CHECK (condition IN ('new', 'good', 'fair', 'poor'));

ALTER TABLE customs_documents
  ADD CONSTRAINT chk_customs_docs_type
  CHECK (document_type IN ('bill_of_lading', 'commercial_invoice', 'packing_list', 'certificate_of_origin', 'insurance_certificate', 'customs_declaration', 'import_permit', 'phytosanitary', 'conformity_certificate', 'other'));

ALTER TABLE customs_documents
  ADD CONSTRAINT chk_customs_docs_status
  CHECK (status IN ('pending', 'received', 'verified', 'rejected'));

ALTER TABLE vehicle_maintenance
  ADD CONSTRAINT chk_vehicle_maint_type
  CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency', 'inspection'));

ALTER TABLE vehicle_maintenance
  ADD CONSTRAINT chk_vehicle_maint_status
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE compliance_checklists
  ADD CONSTRAINT chk_compliance_cl_standard
  CHECK (standard IN ('ISO_9001', 'ISO_14001', 'OHSAS_18001', 'custom'));

ALTER TABLE compliance_checklists
  ADD CONSTRAINT chk_compliance_cl_category
  CHECK (category IN ('receiving', 'storage', 'dispatch', 'safety', 'environmental'));

ALTER TABLE compliance_audits
  ADD CONSTRAINT chk_compliance_audits_status
  CHECK (status IN ('draft', 'in_progress', 'completed', 'action_required'));

ALTER TABLE compliance_audit_responses
  ADD CONSTRAINT chk_compliance_response
  CHECK (response IN ('compliant', 'non_compliant', 'partial', 'not_applicable'));

ALTER TABLE digital_signatures
  ADD CONSTRAINT chk_digital_sig_purpose
  CHECK (purpose IN ('approval', 'delivery_confirmation', 'receipt', 'inspection', 'handover'));
