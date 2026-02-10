import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Truck, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Project } from '@nit-scs-v2/shared/types';
import { useCreateJobOrder, useCurrentUser } from '@/api/hooks';
import { useProjects } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';

type FormState = Record<string, string | number | boolean | null>;

export const JobOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const [form, setFormState] = useState<FormState>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);

  const createMutation = useCreateJobOrder();
  const meQuery = useCurrentUser();
  const currentUserName = meQuery.data?.data?.fullName ?? '';

  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];

  const nextNumber = useMemo(() => previewNextNumber('jo'), []);

  const setField = (key: string, value: string | number | boolean | null) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  const joType = (form.joType as string) ?? '';
  const totalAmount = useMemo(() => {
    return Number(form.materialPrice ?? 0) + Number(form.insuranceValue ?? 0);
  }, [form.materialPrice, form.insuranceValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...form, requester: currentUserName } as Record<string, unknown>, {
      onSuccess: res => {
        setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? nextNumber);
        setSubmitted(true);
      },
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Job Order Created</h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormState({});
            }}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Create Another
          </button>
          <button onClick={() => navigate(-1)} className="btn-primary px-4 py-2 rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-8 h-8 text-nesma-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-white">Job Order Form</h1>
          <p className="text-gray-400 text-sm">Create a new job order -- #{nextNumber}</p>
        </div>
      </div>

      {/* Request Information */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Request Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Request Date</label>
            <input
              type="date"
              value={(form.requestDate as string) ?? new Date().toISOString().split('T')[0]}
              onChange={e => setField('requestDate', e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Project</label>
            <select
              value={(form.project as string) ?? ''}
              onChange={e => setField('project', e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Requester</label>
            <input type="text" className="input-field w-full" value={currentUserName} readOnly />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Priority</label>
            <select
              value={(form.priority as string) ?? ''}
              onChange={e => setField('priority', e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select priority...</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Service Type */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Service Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Job Order Type</label>
            <select
              value={joType}
              onChange={e => setField('joType', e.target.value)}
              className="input-field w-full"
              required
            >
              <option value="">Select type...</option>
              <option value="Transport">Transport</option>
              <option value="Equipment">Equipment</option>
              <option value="Generator_Rental">Generator Rental</option>
              <option value="Generator_Maintenance">Generator Maintenance</option>
              <option value="Rental_Daily">Rental Daily</option>
              <option value="Rental_Monthly">Rental Monthly</option>
              <option value="Scrap">Scrap</option>
            </select>
          </div>
        </div>
      </div>

      {/* Driver & Vehicle Details */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-nesma-secondary" />
          Driver & Vehicle Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Driver Name</label>
            <input
              type="text"
              className="input-field w-full"
              value={(form.driverName as string) ?? ''}
              onChange={e => setField('driverName', e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nationality</label>
            <input
              type="text"
              className="input-field w-full"
              value={(form.driverNationality as string) ?? ''}
              onChange={e => setField('driverNationality', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">ID Number</label>
            <input
              type="text"
              className="input-field w-full"
              value={(form.driverIdNumber as string) ?? ''}
              onChange={e => setField('driverIdNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vehicle Brand</label>
            <input
              type="text"
              className="input-field w-full"
              value={(form.vehicleBrand as string) ?? ''}
              onChange={e => setField('vehicleBrand', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vehicle Year</label>
            <input
              type="number"
              className="input-field w-full"
              value={(form.vehicleYear as number) ?? ''}
              onChange={e => setField('vehicleYear', e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Plate Number</label>
            <input
              type="text"
              className="input-field w-full"
              value={(form.vehiclePlate as string) ?? ''}
              onChange={e => setField('vehiclePlate', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Pickup Location (Google Maps)</label>
            <input
              type="url"
              className="input-field w-full"
              value={(form.googleMapsPickup as string) ?? ''}
              onChange={e => setField('googleMapsPickup', e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Delivery Location (Google Maps)</label>
            <input
              type="url"
              className="input-field w-full"
              value={(form.googleMapsDelivery as string) ?? ''}
              onChange={e => setField('googleMapsDelivery', e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>
      </div>

      {/* Insurance & Budget — show when joType is equipment or totalAmount > 0 */}
      {(joType === 'Equipment' || totalAmount > 0) && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Insurance & Budget</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Insurance Value (SAR)</label>
              <input
                type="number"
                className="input-field w-full"
                value={(form.insuranceValue as number) ?? ''}
                onChange={e => setField('insuranceValue', e.target.value ? Number(e.target.value) : null)}
              />
              {Number(form.insuranceValue ?? 0) > 7_000_000 && (
                <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Insurance required: value exceeds 7M SAR
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">CN Number</label>
              <input
                type="text"
                className="input-field w-full"
                value={(form.cnNumber as string) ?? ''}
                onChange={e => setField('cnNumber', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Shift Start Time</label>
              <input
                type="datetime-local"
                className="input-field w-full"
                value={(form.shiftStartTime as string) ?? ''}
                onChange={e => setField('shiftStartTime', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {createMutation.isPending ? 'Creating...' : 'Create Job Order'}
        </button>
      </div>
    </form>
  );
};
