import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function parseDateReleased(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  const [datePart, timePart] = dateStr.split(' at ');
  if (!timePart) return new Date(dateStr);
  const date = new Date(`${datePart} ${timePart}`);
  if (!isNaN(date.getTime())) return date;
  const dateOnly = new Date(datePart);
  return isNaN(dateOnly.getTime()) ? null : dateOnly;
}

function formatDateLabel(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getRawWeekdays(startDate, endDate) {
  if (!startDate || !endDate || endDate === '-') return 0;
  try {
    const start = parseDateReleased(startDate) || new Date(startDate);
    const end = parseDateReleased(endDate) || new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
    
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  } catch {
    return 0;
  }
}

function getDeductionBreakdown(startDate, endDate, holidaysList = [], includeFriday = true) {
  if (!startDate || !endDate || endDate === '-') {
    return { weekends: 0, holidays: [], fridays: [], total: 0 };
  }
  
  try {
    const start = parseDateReleased(startDate) || new Date(startDate);
    const end = parseDateReleased(endDate) || new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { weekends: 0, holidays: [], fridays: [], total: 0 };
    }
    
    let weekendsCount = 0;
    const fridaysApplied = [];
    const holidaysApplied = [];
    
    const current = new Date(start);
    const holidaySet = new Set(holidaysList.map(h => typeof h === 'string' ? h : h.holidaydate));
    
    while (current <= end) {
      const day = current.getDay();
      const dateStr = current.getFullYear() + '-' + 
                      String(current.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(current.getDate()).padStart(2, '0');
      
      if (day === 0 || day === 6) {
        weekendsCount++;
      } else if (day === 5 && !includeFriday) {
        fridaysApplied.push(dateStr);
      } else {
        const holidayMatch = holidaysList.find(h => (typeof h === 'string' ? h : h.holidaydate) === dateStr);
        if (holidayMatch) {
          holidaysApplied.push({
            date: dateStr,
            name: typeof holidayMatch === 'string' ? 'Holiday' : holidayMatch.holidayname
          });
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return {
      weekends: weekendsCount,
      fridays: fridaysApplied,
      holidays: holidaysApplied,
      total: weekendsCount + fridaysApplied.length + holidaysApplied.length
    };
  } catch (error) {
    console.error('Error calculating breakdown:', error);
    return { weekends: 0, holidays: [], fridays: [], total: 0 };
  }
}

function OverlayProcessingDays({
  isOpen,
  onClose,
  editingDoc,
  viewMode,
  editMode,
  calculateNetworkDays,
  holidaysList = [],
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

  const breakdown = getDeductionBreakdown(
    editingDoc?.dateSent,
    editingDoc?.dateReceive,
    holidaysList,
    editingDoc?.include_friday !== false
  );

  const rawWeekdays = getRawWeekdays(editingDoc?.dateSent, editingDoc?.dateReceive);
  const systemDeductions = (breakdown.fridays?.length || 0) + (breakdown.holidays?.length || 0);
  const deductedPreview = parseInt(formData.deducteddays, 10) || 0;

  const baseProcessed = editingDoc?.daysProcessed !== null && editingDoc?.daysProcessed !== undefined
    ? Number(editingDoc.daysProcessed) + (Number(editingDoc.deducteddays) || 0)
    : Math.max(0, rawWeekdays - systemDeductions);

  const netDays = Math.max(0, baseProcessed - deductedPreview);
  const totalDeducted = Math.max(0, rawWeekdays - netDays);
  const isExceeding = netDays <= 0 && deductedPreview > 0;
  
  const hourlyAdjustment = Math.max(0, (rawWeekdays - systemDeductions) - baseProcessed);

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
    } else {
      const calculatedNetDays = baseProcessed - deductedDays;
      if (calculatedNetDays < 0) {
        newErrors.deducteddays = 'Processing days cannot be negative.';
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
      const calculatedNetDays = Math.max(0, baseProcessed - deductedDays);
      const response = await fetch(
        `${API_URL}/api/documents/${editingDoc.documentid}/networkdays`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deducteddays: deductedDays,
            calcnetworkdays: calculatedNetDays,
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
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              Processing Days
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
                  {rawWeekdays}
                </p>
              </div>
              <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-sky-400 mb-1">
                  Deducted
                </p>
                <p className="text-xl font-extrabold text-sky-700">
                  {totalDeducted.toFixed(1).replace(/\.0$/, '')}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-1">
                  Net Days
                </p>
                <p className="text-xl font-extrabold text-blue-700">
                  {netDays.toFixed(1).replace(/\.0$/, '')}
                </p>
              </div>
            </div>

            {/* Auto-Calculated Deductions */}
            <div className="mt-4 p-4 bg-sky-50/25 border border-sky-100/60 rounded-2xl">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                System Calculated Deductions
              </h4>
              <div className="space-y-2 text-xs text-slate-600 font-semibold font-sans">
                <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-100 pb-1.5">
                  <span>Friday Inclusion Status</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${editingDoc?.include_friday !== false ? 'bg-blue-50 text-blue-800 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {editingDoc?.include_friday !== false ? 'Fridays Included' : 'Fridays Excluded (No Work)'}
                  </span>
                </div>

                {editingDoc?.include_friday === false && breakdown.fridays.length > 0 && (
                  <div className="flex flex-col py-0.5 border-b border-dashed border-slate-100 pb-1.5">
                    <div className="flex justify-between items-center">
                      <span>Fridays (No Work)</span>
                      <span className="font-bold text-slate-700">{breakdown.fridays.length} {breakdown.fridays.length === 1 ? 'day' : 'days'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {breakdown.fridays.map((f, idx) => (
                        <span key={idx} className="bg-slate-50 text-slate-600 border border-slate-100 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          {formatDateLabel(f)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col py-0.5 border-b border-dashed border-slate-100 pb-1.5">
                  <div className="flex justify-between items-start">
                    <span>Holidays Deducted</span>
                    <span className="font-bold text-slate-700">{breakdown.holidays.length} {breakdown.holidays.length === 1 ? 'day' : 'days'}</span>
                  </div>
                  {breakdown.holidays.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {breakdown.holidays.map((h, idx) => (
                        <span key={idx} className="bg-sky-50 text-sky-800 border border-sky-100 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          {formatDateLabel(h.date)} - {h.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {hourlyAdjustment > 0 && (
                  <div className="flex flex-col py-0.5">
                    <div className="flex justify-between items-center">
                      <span>Late Start / Hourly Adjustment</span>
                      <span className="font-bold text-slate-700">{hourlyAdjustment.toFixed(1).replace(/\.0$/, '')} {hourlyAdjustment === 1 ? 'day' : 'days'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-sans">
                      Adjusted for late afternoon submission or early morning release.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button className="modal-cancel-btn" onClick={() => onClose(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverlayProcessingDays;
