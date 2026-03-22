import { describe, it, expect } from 'vitest';
import { SECTION_NAVIGATION } from './navigation';
import { UserRole } from '@nit-scs-v2/shared/types';

describe('SECTION_NAVIGATION', () => {
  const allRoles = Object.values(UserRole);

  it('has an entry for every UserRole (17 roles)', () => {
    expect(allRoles.length).toBe(17);
    for (const role of allRoles) {
      expect(SECTION_NAVIGATION[role], `Missing navigation for role: ${role}`).toBeDefined();
    }
  });

  it.each(allRoles)('role "%s" has at least 1 section with at least 1 navigable item', role => {
    const sections = SECTION_NAVIGATION[role];
    expect(sections.length).toBeGreaterThanOrEqual(1);
    // Check that at least one section has items (directly or via children sub-groups)
    const hasItems = sections.some(
      s =>
        (s.items && s.items.length > 0) || (s.children && s.children.some(c => c.items && c.items.length > 0)),
    );
    expect(hasItems, `Role ${role} has no navigation items in any section`).toBe(true);
  });

  it('no nav item has empty or undefined path', () => {
    for (const role of allRoles) {
      const sections = SECTION_NAVIGATION[role];
      for (const section of sections) {
        for (const item of section.items || []) {
          expect(item.path, `Empty path in ${role}/${section.section}/${item.label}`).toBeTruthy();
        }
        for (const child of section.children || []) {
          for (const item of child.items) {
            expect(
              item.path,
              `Empty path in ${role}/${section.section}/${child.label}/${item.label}`,
            ).toBeTruthy();
          }
        }
      }
    }
  });

  it('ADMIN has OVERVIEW, OPERATIONS, and INVENTORY sections', () => {
    const adminSections = SECTION_NAVIGATION[UserRole.ADMIN];
    const sectionNames = adminSections.map(s => s.section);
    expect(sectionNames).toContain('OVERVIEW');
    expect(sectionNames).toContain('OPERATIONS');
    expect(sectionNames).toContain('INVENTORY');
  });

  it('WAREHOUSE_STAFF has inventory-related nav items', () => {
    const staffSections = SECTION_NAVIGATION[UserRole.WAREHOUSE_STAFF];
    const sectionNames = staffSections.map(s => s.section);
    expect(sectionNames).toContain('INVENTORY');
    const inventorySection = staffSections.find(s => s.section === 'INVENTORY');
    expect(inventorySection!.items.length).toBeGreaterThanOrEqual(1);
  });

  it('QC_OFFICER has quality/inspection nav items', () => {
    const qcSections = SECTION_NAVIGATION[UserRole.QC_OFFICER];
    const allItems: string[] = [];
    for (const section of qcSections) {
      for (const item of section.items || []) {
        allItems.push(item.label);
      }
      for (const child of section.children || []) {
        for (const item of child.items) {
          allItems.push(item.label);
        }
      }
    }
    const hasInspection = allItems.some(label => label.toLowerCase().includes('inspection') || label.toLowerCase().includes('qci'));
    expect(hasInspection, 'QC_OFFICER should have inspection-related nav items').toBe(true);
  });
});
