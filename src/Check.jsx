import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  ShieldAlert,
  Image as ImageIcon,
  X,
  AlertCircle,
  Calendar,
  CreditCard,
  User,
  MapPin,
  Link as LinkIcon,
  DollarSign,
  Package,
  Phone,
  FileText,
  Upload,
  Loader2,
  Trash2,
} from 'lucide-react';

const DEFAULT_MAX_IMAGE_BYTES = 600000;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

const formatBytes = (bytesInput) => {
  const bytes = Number(bytesInput || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const normalizeReport = (reportInput) => {
  const report = reportInput && typeof reportInput === 'object' && !Array.isArray(reportInput)
    ? reportInput
    : {};
  const evidenceObject =
    report.evidenceImage && typeof report.evidenceImage === 'object' && !Array.isArray(report.evidenceImage)
      ? report.evidenceImage
      : null;
  const evidenceImage = String(
    evidenceObject?.dataUrl || report.evidenceImageUrl || report.evidenceImage || ''
  ).trim();

  return {
    id: String(report.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim(),
    sellerAlias: String(report.sellerAlias || '').trim(),
    firstName: String(report.firstName || '').trim(),
    lastName: String(report.lastName || '').trim(),
    citizenId: String(report.citizenId || '').trim(),
    phone: String(report.phone || '').trim(),
    bankAccount: String(report.bankAccount || '').trim(),
    bankName: String(report.bankName || '').trim(),
    product: String(report.product || '').trim(),
    amount: Math.max(0, Number(report.amount || 0) || 0),
    transferDate: String(report.transferDate || '').trim(),
    pageUrl: String(report.pageUrl || '').trim(),
    province: String(report.province || '').trim(),
    evidenceImage,
    evidenceImageName: String(evidenceObject?.name || '').trim(),
    evidenceImageSize: Number(evidenceObject?.size || 0) || 0,
    createdAt: String(report.createdAt || '').trim() || null,
  };
};

export default function CheckPage({
  onLoadReports,
  onCreateReport,
  maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
}) {
  const [reports, setReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewImageModal, setViewImageModal] = useState(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const evidenceInputRef = useRef(null);

  const [formData, setFormData] = useState({
    sellerAlias: '',
    firstName: '',
    lastName: '',
    citizenId: '',
    phone: '',
    bankAccount: '',
    bankName: '',
    product: '',
    amount: '',
    transferDate: '',
    pageUrl: '',
    province: '',
    evidenceImage: null,
  });

  const canUseCloudApi = typeof onLoadReports === 'function' && typeof onCreateReport === 'function';

  const filteredReports = useMemo(() => {
    const searchLower = String(searchQuery || '').trim().toLowerCase();
    if (!searchLower) return reports;
    return reports.filter((report) => {
      const firstName = String(report.firstName || '').toLowerCase();
      const lastName = String(report.lastName || '').toLowerCase();
      const sellerAlias = String(report.sellerAlias || '').toLowerCase();
      const citizenId = String(report.citizenId || '').toLowerCase();
      const bankAccount = String(report.bankAccount || '').toLowerCase();
      const phone = String(report.phone || '').toLowerCase();
      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        sellerAlias.includes(searchLower) ||
        citizenId.includes(searchLower) ||
        bankAccount.includes(searchLower) ||
        phone.includes(searchLower)
      );
    });
  }, [reports, searchQuery]);

  const resetForm = () => {
    setFormData({
      sellerAlias: '',
      firstName: '',
      lastName: '',
      citizenId: '',
      phone: '',
      bankAccount: '',
      bankName: '',
      product: '',
      amount: '',
      transferDate: '',
      pageUrl: '',
      province: '',
      evidenceImage: null,
    });
    if (evidenceInputRef.current) {
      evidenceInputRef.current.value = '';
    }
  };

  const loadReports = async () => {
    if (typeof onLoadReports !== 'function') return;
    setIsLoadingReports(true);
    setResult(null);
    try {
      const response = await Promise.resolve(onLoadReports());
      if (!response?.ok) {
        setReports([]);
        setResult({ ok: false, message: response?.message || 'Failed to load reports from Cloud.' });
        return;
      }
      const nextReports = (Array.isArray(response.reports) ? response.reports : []).map((report) =>
        normalizeReport(report)
      );
      setReports(nextReports);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [onLoadReports]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEvidenceFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      setResult({ ok: false, message: 'Only image files are allowed.' });
      event.target.value = '';
      return;
    }

    const size = Number(file.size || 0);
    if (size <= 0 || size > maxImageBytes) {
      setResult({
        ok: false,
        message: `Image size must be <= ${formatBytes(maxImageBytes)} (selected: ${formatBytes(size)}).`,
      });
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((prev) => ({
        ...prev,
        evidenceImage: {
          id: `evidence-${Date.now()}`,
          name: String(file.name || 'evidence-image').slice(0, 180),
          mimeType: String(file.type || 'image/*').toLowerCase(),
          size,
          dataUrl,
        },
      }));
      setResult(null);
    } catch {
      setResult({ ok: false, message: 'Failed to read image file. Please try again.' });
    } finally {
      event.target.value = '';
    }
  };

  const removeEvidenceImage = () => {
    setFormData((prev) => ({ ...prev, evidenceImage: null }));
    if (evidenceInputRef.current) {
      evidenceInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const amount = Number(formData.amount || 0);
    const payload = {
      sellerAlias: String(formData.sellerAlias || '').trim(),
      firstName: String(formData.firstName || '').trim(),
      lastName: String(formData.lastName || '').trim(),
      citizenId: String(formData.citizenId || '').trim(),
      phone: String(formData.phone || '').trim(),
      bankAccount: String(formData.bankAccount || '').trim(),
      bankName: String(formData.bankName || '').trim(),
      product: String(formData.product || '').trim(),
      amount: Number.isFinite(amount) ? amount : 0,
      transferDate: String(formData.transferDate || '').trim(),
      pageUrl: String(formData.pageUrl || '').trim(),
      province: String(formData.province || '').trim(),
      evidenceImage: formData.evidenceImage || null,
    };

    if (
      !payload.sellerAlias ||
      !payload.firstName ||
      !payload.lastName ||
      !payload.bankAccount ||
      !payload.bankName ||
      !payload.product ||
      !payload.transferDate ||
      payload.amount <= 0
    ) {
      setResult({
        ok: false,
        message:
          'Please fill required fields: alias, first name, last name, bank account, bank, product, amount, transfer date.',
      });
      return;
    }

    if (typeof onCreateReport !== 'function') {
      setResult({ ok: false, message: 'Cloud API is not configured for this page.' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await Promise.resolve(onCreateReport(payload));
      if (!response?.ok) {
        setResult({ ok: false, message: response?.message || 'Failed to save report.' });
        return;
      }
      const createdReport = normalizeReport(response.report || payload);
      setReports((prev) => [createdReport, ...prev]);
      setResult({ ok: true, message: response?.message || 'Report saved to Cloud Database.' });
      setIsModalOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert size={28} />
            <h1 className="text-xl font-bold tracking-tight">
              Scammer<span className="text-gray-800">DB Admin</span>
            </h1>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-3">
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name, account, citizen ID..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-colors"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Report</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        {!canUseCloudApi && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This page requires Cloud Auth API to save reports in Cloud Database.
          </p>
        )}

        {result?.message && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              result.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}
          >
            {result.message}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2 max-w-7xl mx-auto">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <User size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total reports</p>
              <p className="text-2xl font-bold">{reports.length}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total damage value</p>
              <p className="text-2xl font-bold">${reports.reduce((sum, report) => sum + report.amount, 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Search result</p>
              <p className="text-2xl font-bold">{filteredReports.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Seller info</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact / page</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Bank info</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Fraud detail</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Evidence</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingReports ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Loading reports...
                      </span>
                    </td>
                  </tr>
                ) : filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                            {String(report.firstName || '?').charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{report.firstName} {report.lastName}</div>
                            <div className="text-xs text-gray-500">ID: {report.citizenId || '-'}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {report.phone || '-'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{report.sellerAlias || '-'}</div>
                        <div className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <LinkIcon size={12} />
                          {report.pageUrl ? (report.pageUrl.length > 30 ? `${report.pageUrl.slice(0, 30)}...` : report.pageUrl) : '-'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1"><CreditCard size={14} className="text-gray-400" /> {report.bankAccount || '-'}</div>
                        <div className="text-xs text-gray-500 mt-1">{report.bankName || '-'}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center gap-1"><Package size={14} className="text-gray-400" /> {report.product || '-'}</div>
                        <div className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1">
                          <DollarSign size={12} /> Transfer {Number(report.amount || 0).toLocaleString()}
                          <span className="text-gray-400 font-normal ml-1 flex items-center gap-1">
                            <Calendar size={10} /> {report.transferDate || '-'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin size={10} /> {report.province || '-'}</div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {report.evidenceImage ? (
                          <button
                            onClick={() => setViewImageModal(report.evidenceImage)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg transition-colors inline-flex justify-center"
                            title="View evidence"
                          >
                            <ImageIcon size={20} />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">- No image -</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle size={40} className="text-gray-300 mb-2" />
                        <p className="text-lg font-medium text-gray-600">No data found</p>
                        <p className="text-sm text-gray-400 mt-1">No reports yet or your search does not match any entry.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setIsModalOpen(false)} />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center gap-2" id="modal-title">
                    <ShieldAlert className="text-red-500" size={20} /> Add fraud report
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form id="add-report-form" onSubmit={(event) => void handleSubmit(event)}>
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 bg-gray-50 py-1 px-3 rounded-md mb-3 border-l-2 border-red-500">1. Seller identity</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Seller alias / page name</label>
                        <input required type="text" name="sellerAlias" value={formData.sellerAlias} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
                        <input required type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
                        <input required type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Citizen ID</label>
                        <input type="text" name="citizenId" value={formData.citizenId} onChange={handleInputChange} maxLength="13" className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 bg-gray-50 py-1 px-3 rounded-md mb-3 border-l-2 border-blue-500">2. Receiver bank account</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bank account number</label>
                        <input required type="text" name="bankAccount" value={formData.bankAccount} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Bank name</label>
                        <input required type="text" name="bankName" value={formData.bankName} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 bg-gray-50 py-1 px-3 rounded-md mb-3 border-l-2 border-orange-500">3. Fraud detail</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Product purchased</label>
                        <input required type="text" name="product" value={formData.product} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount transferred</label>
                        <input required type="number" min="0" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transfer date</label>
                        <input required type="date" name="transferDate" value={formData.transferDate} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Fraud page URL</label>
                        <input type="text" name="pageUrl" value={formData.pageUrl} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Province</label>
                        <input type="text" name="province" value={formData.province} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Evidence image (slip/chat)</label>
                        <input
                          ref={evidenceInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handleEvidenceFileChange(event)}
                          className="hidden"
                          id="scam-report-evidence-upload"
                        />
                        <div className="rounded-lg border border-gray-300 bg-gray-50 p-3 space-y-3">
                          <button
                            type="button"
                            onClick={() => evidenceInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium"
                          >
                            <Upload size={16} /> Upload evidence image
                          </button>
                          <p className="text-xs text-gray-500">Image only, max size {formatBytes(maxImageBytes)}</p>

                          {formData.evidenceImage && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{formData.evidenceImage.name}</p>
                                  <p className="text-[11px] text-gray-500">{formatBytes(formData.evidenceImage.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={removeEvidenceImage}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                              <img
                                src={formData.evidenceImage.dataUrl}
                                alt="evidence preview"
                                className="w-full max-h-56 object-contain rounded border border-gray-200 bg-gray-50"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t">
                <button
                  type="submit"
                  form="add-report-form"
                  disabled={isSubmitting}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-red-300"
                >
                  {isSubmitting && <Loader2 size={15} className="animate-spin" />} Save report
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewImageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-90 p-4" onClick={() => setViewImageModal(null)}>
          <button
            className="absolute top-4 right-4 text-white bg-gray-800 bg-opacity-50 hover:bg-opacity-100 rounded-full p-2 transition-all"
            onClick={(event) => {
              event.stopPropagation();
              setViewImageModal(null);
            }}
          >
            <X size={24} />
          </button>
          <img
            src={viewImageModal}
            alt="evidence"
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
