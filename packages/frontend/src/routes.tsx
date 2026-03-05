import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@nit-scs-v2/shared/types';
import { ROLE_REDIRECT, NotFoundPage } from '@/domains/routeUtils';
import { adminRoutes } from '@/domains/admin/routes';
import { warehouseRoutes } from '@/domains/warehouse/routes';
import { transportRoutes } from '@/domains/transport/routes';
import { managerRoutes } from '@/domains/manager/routes';
import { qcRoutes } from '@/domains/qc/routes';
import { logisticsRoutes } from '@/domains/logistics/routes';
import { engineerRoutes } from '@/domains/engineer/routes';
import { sharedRoutes } from '@/domains/shared/routes';

export const AppRouteDefinitions: React.FC<{ currentRole: UserRole }> = ({ currentRole }) => (
  <Routes>
    <Route path="/" element={<Navigate to={ROLE_REDIRECT[currentRole] || '/warehouse'} />} />

    {adminRoutes(currentRole)}
    {warehouseRoutes(currentRole)}
    {transportRoutes(currentRole)}
    {managerRoutes(currentRole)}
    {qcRoutes(currentRole)}
    {logisticsRoutes(currentRole)}
    {engineerRoutes(currentRole)}
    {sharedRoutes(currentRole)}

    {/* 404 Catch-all — must be last */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
