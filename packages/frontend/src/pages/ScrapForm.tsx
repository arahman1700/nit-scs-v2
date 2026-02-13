import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Recycle, CheckCircle, Camera, X, Loader2, Upload, DollarSign, ThumbsUp, ThumbsDown } from 'lucide-react';
import { SCRAP_MATERIAL_TYPES } from '@nit-scs-v2/shared/constants';
import type { Project, Warehouse } from '@nit-scs-v2/shared/types';
import { ExportButton } from '@/components/ExportButton';
import {
  useCreateScrap,
  useScrap,
  useUpdateScrap,
  useApproveBySiteManager,
  useApproveByQc,
  useApproveByStorekeeper,
  useSscList,
  useAcceptBid,
  useRejectBid,
  useUpload,
} from '@/api/hooks';
import { useProjects, useWarehouses } from '@/api/hooks/useMasterData';
import { previewNextNumber } from '@/utils/autoNumber';
import { generateScrapPdf } from '@/utils/pdfExport';

interface ScrapDoc {
  id?: string;
  formNumber?: string;
  status?: string;
  siteManagerApproved?: boolean;
  qcApproved?: boolean;
  storekeeperApproved?: boolean;
  photos?: string[];
  [key: string]: unknown;
}

interface SscBid {
  id: string;
  bidderName?: string;
  amount?: number;
  status?: string;
  notes?: string;
}

export const ScrapForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [documentNumber, setDocumentNumber] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);

  const createMutation = useCreateScrap();
  const updateMutation = useUpdateScrap();
  const uploadMutation = useUpload();
  const siteManagerApproval = useApproveBySiteManager();
  const qcApproval = useApproveByQc();
  const storekeeperApproval = useApproveByStorekeeper();
  const acceptBid = useAcceptBid();
  const rejectBid = useRejectBid();

  // Fetch existing doc if editing
  const detailQuery = useScrap(id);
  const existingDoc = (detailQuery.data as { data?: ScrapDoc } | undefined)?.data;
  const docStatus = existingDoc?.status ?? '';

  // Fetch SSC bids when status is in_ssc
  const sscQuery = useSscList(
    docStatus === 'in_ssc' ? { filter: JSON.stringify({ scrapId: id }), pageSize: 50 } : undefined,
  );
  const sscBids = (sscQuery.data?.data ?? []) as SscBid[];

  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];

  const warehouseQuery = useWarehouses({ pageSize: 200 });
  const warehouses = (warehouseQuery.data?.data ?? []) as Warehouse[];

  const nextNumber = useMemo(() => previewNextNumber('scrap'), []);

  // Populate form from existing doc
  React.useEffect(() => {
    if (existingDoc && isEditMode) {
      const data: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(existingDoc)) {
        if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'photos') {
          data[key] = value as string | number | boolean | null;
        }
      }
      setFormData(data);
      if (existingDoc.photos && Array.isArray(existingDoc.photos)) {
        setPhotos(existingDoc.photos.map((url: string, i: number) => ({ url, name: `Photo ${i + 1}` })));
      }
    }
  }, [existingDoc, isEditMode]);

  const handlePhotoUpload = async (file: File) => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      setPhotos(prev => [...prev, { url: result.url, name: result.originalName }]);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, photos: photos.map(p => p.url) } as Record<string, unknown>;

    if (isEditMode && id) {
      updateMutation.mutate({ ...payload, id } as Record<string, unknown> & { id: string }, {
        onSuccess: () => {
          setDocumentNumber(existingDoc?.formNumber ?? id);
          setSubmitted(true);
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: res => {
          setDocumentNumber((res as unknown as { data?: { formNumber?: string } }).data?.formNumber ?? nextNumber);
          setSubmitted(true);
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          {isEditMode ? 'Scrap Report Updated' : 'Scrap Report Created'}
        </h2>
        <p className="text-gray-400 mb-6">Document #{documentNumber}</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSubmitted(false);
              setFormData({});
              setPhotos([]);
            }}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            {isEditMode ? 'Continue Editing' : 'Create Another'}
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
      <div className="flex items-center gap-3 mb-6">
        <Recycle className="w-8 h-8 text-nesma-secondary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Scrap Report Form</h1>
          <p className="text-gray-400 text-sm">
            Report scrap materials for disposal -- #{isEditMode ? id : nextNumber}
          </p>
        </div>
        {isEditMode && existingDoc && (
          <ExportButton
            onExportPdf={() => {
              const project = projects.find(p => p.id === formData.projectId);
              const warehouse = warehouses.find(w => w.id === formData.warehouseId);
              generateScrapPdf({
                documentNumber: existingDoc.formNumber ?? id ?? '',
                project: project?.name ?? String(formData.projectId ?? ''),
                warehouse: warehouse?.name ?? String(formData.warehouseId ?? ''),
                itemDescription: String(formData.description ?? ''),
                category: String(formData.materialType ?? ''),
                estimatedValue: formData.estimatedValue
                  ? `${Number(formData.estimatedValue).toLocaleString()} SAR`
                  : 'N/A',
                disposalMethod: String(formData.disposalMethod ?? 'Pending'),
                condition: String(formData.condition ?? ''),
                status: docStatus,
                notes: String(formData.description ?? ''),
              });
            }}
          />
        )}
      </div>

      {/* Multi-Approval Status Display */}
      {isEditMode && existingDoc && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Approval Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Site Manager */}
            <div
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                existingDoc.siteManagerApproved
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  existingDoc.siteManagerApproved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-500'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Site Manager</p>
                <p className={`text-xs ${existingDoc.siteManagerApproved ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {existingDoc.siteManagerApproved ? 'Approved' : 'Pending'}
                </p>
              </div>
              {!existingDoc.siteManagerApproved && (
                <button
                  type="button"
                  onClick={() => id && siteManagerApproval.mutate(id)}
                  disabled={siteManagerApproval.isPending}
                  className="ml-auto btn-primary px-3 py-1 rounded-lg text-xs"
                >
                  {siteManagerApproval.isPending ? 'Approving...' : 'Approve'}
                </button>
              )}
            </div>

            {/* QC */}
            <div
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                existingDoc.qcApproved ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  existingDoc.qcApproved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-500'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">QC Officer</p>
                <p className={`text-xs ${existingDoc.qcApproved ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {existingDoc.qcApproved ? 'Approved' : 'Pending'}
                </p>
              </div>
              {!existingDoc.qcApproved && (
                <button
                  type="button"
                  onClick={() => id && qcApproval.mutate(id)}
                  disabled={qcApproval.isPending}
                  className="ml-auto btn-primary px-3 py-1 rounded-lg text-xs"
                >
                  {qcApproval.isPending ? 'Approving...' : 'Approve'}
                </button>
              )}
            </div>

            {/* Storekeeper */}
            <div
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                existingDoc.storekeeperApproved
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  existingDoc.storekeeperApproved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-500'
                }`}
              >
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Storekeeper</p>
                <p className={`text-xs ${existingDoc.storekeeperApproved ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {existingDoc.storekeeperApproved ? 'Approved' : 'Pending'}
                </p>
              </div>
              {!existingDoc.storekeeperApproved && (
                <button
                  type="button"
                  onClick={() => id && storekeeperApproval.mutate(id)}
                  disabled={storekeeperApproval.isPending}
                  className="ml-auto btn-primary px-3 py-1 rounded-lg text-xs"
                >
                  {storekeeperApproval.isPending ? 'Approving...' : 'Approve'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrap Details */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Scrap Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Project</label>
            <select
              value={(formData.projectId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, projectId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Warehouse</label>
            <select
              value={(formData.warehouseId as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, warehouseId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select warehouse...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Material Type</label>
            <select
              value={(formData.materialType as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, materialType: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select material type...</option>
              {SCRAP_MATERIAL_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Quantity</label>
            <input
              type="number"
              value={(formData.qty as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, qty: Number(e.target.value) }))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Packaging</label>
            <input
              type="text"
              value={(formData.packaging as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, packaging: e.target.value }))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Condition</label>
            <select
              value={(formData.condition as string) ?? ''}
              onChange={e => setFormData(p => ({ ...p, condition: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select condition...</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Estimated Value</label>
            <input
              type="number"
              value={(formData.estimatedValue as number) ?? ''}
              onChange={e => setFormData(p => ({ ...p, estimatedValue: Number(e.target.value) }))}
              className="input-field w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Description</label>
          <textarea
            value={(formData.description as string) ?? ''}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
            className="input-field w-full"
            rows={3}
          />
        </div>
      </div>

      {/* Photo Upload Section */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5 text-nesma-secondary" />
          Photos
        </h2>
        <p className="text-gray-400 text-xs mb-4">Upload photos of scrap materials (minimum 3 recommended)</p>

        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group border border-white/10 rounded-xl overflow-hidden bg-white/5">
                <img src={photo.url} alt={photo.name} className="w-full h-28 object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 p-2 truncate">{photo.name}</p>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        <label
          className={`border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:bg-white/5 hover:border-nesma-secondary/50 transition-all cursor-pointer group ${
            uploadMutation.isPending ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={uploadMutation.isPending}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file);
              e.target.value = '';
            }}
          />
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
            {uploadMutation.isPending ? (
              <Loader2 className="text-nesma-secondary animate-spin w-5 h-5" />
            ) : (
              <Upload className="text-gray-400 group-hover:text-nesma-secondary transition-colors w-5 h-5" />
            )}
          </div>
          <span className="block text-sm text-gray-300 group-hover:text-white transition-colors">
            {uploadMutation.isPending ? 'Uploading...' : 'Click to add photo'}
          </span>
          <span className="text-xs text-gray-500 mt-1 block">JPG, PNG -- Max 10MB</span>
        </label>

        {photos.length > 0 && photos.length < 3 && (
          <p className="text-amber-400 text-xs mt-2">
            {3 - photos.length} more photo(s) recommended for complete documentation
          </p>
        )}
      </div>

      {/* SSC Bids Panel — shown when status is in_ssc */}
      {isEditMode && docStatus === 'in_ssc' && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-nesma-secondary" />
            SSC Bids
          </h2>
          {sscQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-nesma-secondary animate-spin" />
            </div>
          ) : sscBids.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No bids received yet</p>
          ) : (
            <div className="space-y-3">
              {sscBids.map(bid => (
                <div
                  key={bid.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    bid.status === 'accepted'
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : bid.status === 'rejected'
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{bid.bidderName ?? 'Unknown Bidder'}</p>
                    <p className="text-xs text-gray-400">{bid.notes ?? 'No notes'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-nesma-secondary">{bid.amount?.toLocaleString()} SAR</p>
                    {bid.status && bid.status !== 'pending' && (
                      <p className={`text-xs ${bid.status === 'accepted' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {bid.status}
                      </p>
                    )}
                  </div>
                  {(!bid.status || bid.status === 'pending') && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => acceptBid.mutate(bid.id)}
                        disabled={acceptBid.isPending}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        title="Accept bid"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectBid.mutate(bid.id)}
                        disabled={rejectBid.isPending}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Reject bid"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={isPending} className="btn-primary px-6 py-2 rounded-lg flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isPending ? 'Saving...' : isEditMode ? 'Update Scrap Report' : 'Create Scrap Report'}
        </button>
      </div>
    </form>
  );
};
