import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function OverlayProcessingDays({
  isOpen,
  onClose,
  editingDoc,
  viewMode,
  editMode,
  calculateNetworkDays,
}) {
  const popupRef = useRef(null);
  const [formData, setFormData] = useState({ deducteddays: '0', remarks: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    deducteddays: '',
    remarks: '',
    calculation: '',
  });
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (editingDoc) {
      setFormData({
        deducteddays:
          editingDoc.deducteddays !== null
            ? String(editingDoc.deducteddays)
            : '0',
        remarks:
          editingDoc.networkdaysremarks && editingDoc.networkdaysremarks !== '-'
            ? editingDoc.networkdaysremarks
            : '',
      });
    } else {
      setFormData({ deducteddays: '0', remarks: '' });
    }
    setErrors({ deducteddays: '', remarks: '', calculation: '' });
  }, [editingDoc]);

  const validateForm = () => {
    const newErrors = { deducteddays: '', remarks: '', calculation: '' };
    let isValid = true;
    const deductedDays = parseInt(formData.deducteddays, 10);
    if (formData.deducteddays.trim() === '') {
      newErrors.deducteddays = 'Deducted days is required';
      isValid = false;
    } else if (isNaN(deductedDays)) {
      newErrors.deducteddays = 'Must be a valid number';
      isValid = false;
    } else if (deductedDays < 0) {
      newErrors.deducteddays = 'Cannot be negative';
      isValid = false;
    } else if (editingDoc && typeof editingDoc.calcnetworkdays === 'number') {
      const processingDays = editingDoc.calcnetworkdays - deductedDays;
      if (processingDays < 0) {
        newErrors.deducteddays = 'Processing days cannot be negative.';
        isValid = false;
      } else if (processingDays === 0) {
        newErrors.deducteddays = 'Processing days cannot be zero.';
        isValid = false;
      }
    }
    if (!formData.remarks.trim()) {
      newErrors.remarks = 'Remarks are required';
      isValid = false;
    }
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!editingDoc) return;
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      const deductedDays = parseInt(formData.deducteddays, 10);
      const businessDays =
        typeof editingDoc.calcnetworkdays === 'number'
          ? editingDoc.calcnetworkdays
          : 0;
      const response = await fetch(
        `${API_URL}/api/documents/${editingDoc.documentid}/networkdays`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deducteddays: deductedDays,
            calcnetworkdays: businessDays - deductedDays,
            remarks: formData.remarks.trim(),
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save network days');
      }
      onClose(true);
      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Network days updated successfully.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        timer: 2500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      if (event.key === 'Enter' && !viewMode && !isSubmitting) {
        event.preventDefault();
        handleSubmit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, isSubmitting, onClose, handleSubmit]);

  const handleInputChange = (e) => {
    if (viewMode) return;
    const { name, value } = e.target;
    if (name === 'deducteddays') {
      if (value === '' || /^[0-9]*$/.test(value)) {
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors.deducteddays)
          setErrors((prev) => ({ ...prev, deducteddays: '' }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === 'remarks' && errors.remarks)
        setErrors((prev) => ({ ...prev, remarks: '' }));
    }
    if (errors.calculation) setErrors((prev) => ({ ...prev, calculation: '' }));
  };

  if (!isOpen) return null;

  const deductedPreview = parseInt(formData.deducteddays, 10) || 0;
  const originalDays = editingDoc?.calcnetworkdays ?? 0;
  const netDays = Math.max(0, originalDays - deductedPreview);
  const isExceeding = netDays <= 0 && deductedPreview > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/50 backdrop-blur-sm p-4 modal-backdrop">
      <div
        ref={popupRef}
        className="modal-panel w-full max-w-[550px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-bar blue px-6 py-5 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
              Processing Days
            </p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {viewMode
                ? 'View Network Days'
                : editMode
                  ? 'Adjust Processing Days'
                  : 'Network Days'}
            </h2>
            {editingDoc?.dtsNo && (
              <p className="text-[11px] text-white/60 font-medium mt-0.5">
                DTS No:{' '}
                <span className="text-white font-bold">
                  {editingDoc.dtsNo || editingDoc.dtsno}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mt-0.5 flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Stats preview */}
        {editingDoc && (
          <div className="px-6 pt-5 pb-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Business Days
                </p>
                <p className="text-xl font-extrabold text-slate-800">
                  {originalDays}
                </p>
              </div>
              <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-sky-400 mb-1">
                  Deducted
                </p>
                <p className="text-xl font-extrabold text-sky-700">
                  {deductedPreview}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 border text-center ${isExceeding ? 'bg-rose-50 border-rose-100' : netDays > 5 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}
              >
                <p
                  className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isExceeding ? 'text-rose-400' : netDays > 5 ? 'text-amber-500' : 'text-emerald-500'}`}
                >
                  Net Days
                </p>
                <p
                  className={`text-xl font-extrabold ${isExceeding ? 'text-rose-700' : netDays > 5 ? 'text-amber-700' : 'text-emerald-700'}`}
                >
                  {netDays}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {errors.calculation && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-xl p-3.5">
              <svg
                className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs font-semibold text-rose-700">
                {errors.calculation}
              </p>
            </div>
          )}
          <div className="modal-field">
            <label className="modal-label">
              Days to Deduct <span className="req">*</span>
            </label>
            <input
              type="text"
              name="deducteddays"
              value={formData.deducteddays}
              placeholder="e.g. 2"
              className={`modal-input ${errors.deducteddays ? 'error' : ''}`}
              onChange={handleInputChange}
              disabled={viewMode}
            />
            {errors.deducteddays && (
              <p className="modal-error-msg">{errors.deducteddays}</p>
            )}
          </div>
          <div className="modal-field">
            <label className="modal-label">
              Reason / Remarks <span className="req">*</span>
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              placeholder="Explain why days are being deducted..."
              className={`modal-textarea ${errors.remarks ? 'error' : ''}`}
              disabled={viewMode}
            />
            {errors.remarks && (
              <p className="modal-error-msg">{errors.remarks}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button className="modal-cancel-btn" onClick={() => onClose(false)}>
            {viewMode ? 'Close' : 'Cancel'}
          </button>
          {!viewMode && (
            <button
              className="modal-submit-btn text-white font-bold"
              style={{
                background: 'linear-gradient(135deg, #0b4c95 0%, #1460A2 100%)',
                boxShadow: '0 4px 12px rgba(11,76,149,0.25)',
              }}
              onClick={handleSubmit}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayProcessingDays;
