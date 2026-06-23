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

function parseDeductions(remarksStr, deductedDaysVal) {
  if (!remarksStr || remarksStr === '-') return [];
  try {
    const parsed = JSON.parse(remarksStr);
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        id: item.id || `legacy-${Date.now()}-${Math.random()}`,
        days: parseFloat(item.days) || 0,
        remarks: item.remarks || ''
      }));
    }
  } catch (e) {
    // Treat as legacy string
  }
  const days = parseFloat(deductedDaysVal) || 0;
  if (days > 0 && remarksStr.trim()) {
    return [{ id: `legacy-${Date.now()}`, days, remarks: remarksStr.trim() }];
  }
  return [];
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
  const [deductions, setDeductions] = useState([]);
  const [newDeduction, setNewDeduction] = useState({ days: '', remarks: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({
    deducteddays: '',
    remarks: '',
    calculation: '',
  });
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3600';

  const breakdown = getDeductionBreakdown(
    editingDoc?.dateSent,
    editingDoc?.dateReceive,
    holidaysList,
    editingDoc?.include_friday !== false
  );

  const rawWeekdays = getRawWeekdays(editingDoc?.dateSent, editingDoc?.dateReceive);
  const systemDeductions = (breakdown.fridays?.length || 0) + (breakdown.holidays?.length || 0);

  const baseProcessed = editingDoc?.daysProcessed !== null && editingDoc?.daysProcessed !== undefined
    ? Number(editingDoc.daysProcessed) + (Number(editingDoc.deducteddays) || 0)
    : Math.max(0, rawWeekdays - systemDeductions);

  const deductedPreview = deductions.reduce((sum, item) => sum + item.days, 0);
  const netDays = Math.max(0, baseProcessed - deductedPreview);
  const totalDeducted = Math.max(0, rawWeekdays - netDays);
  
  const hourlyAdjustment = Math.max(0, (rawWeekdays - systemDeductions) - baseProcessed);

  useEffect(() => {
    if (editingDoc) {
      const parsed = parseDeductions(editingDoc.networkdaysremarks, editingDoc.deducteddays);
      setDeductions(parsed);
      setNewDeduction({ days: '', remarks: '' });
    } else {
      setDeductions([]);
      setNewDeduction({ days: '', remarks: '' });
    }
    setErrors({ deducteddays: '', remarks: '', calculation: '' });
  }, [editingDoc]);

  const handleAddDeduction = () => {
    const daysVal = parseFloat(newDeduction.days);
    const remarksVal = newDeduction.remarks.trim();
    if (isNaN(daysVal) || daysVal <= 0) {
      setErrors(prev => ({ ...prev, deducteddays: 'Must be a valid positive number' }));
      return;
    }
    if (!remarksVal) {
      setErrors(prev => ({ ...prev, remarks: 'Description is required' }));
      return;
    }
    
    // Check if adding this exceeds baseProcessed
    const currentSum = deductions.reduce((sum, item) => sum + item.days, 0);
    if (baseProcessed - (currentSum + daysVal) < 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Validation Error',
        text: 'Total manual deductions cannot exceed processed business days.',
        customClass: { popup: 'swal2-minimalist' }
      });
      return;
    }

    setDeductions(prev => [
      ...prev,
      {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        days: daysVal,
        remarks: remarksVal
      }
    ]);
    setNewDeduction({ days: '', remarks: '' });
    setErrors({ deducteddays: '', remarks: '', calculation: '' });
  };

  const handleSubmit = async () => {
    if (!editingDoc) return;
    
    // Auto-add if user typed something in both fields but forgot to click Add
    let finalDeductions = [...deductions];
    if (newDeduction.days.trim() || newDeduction.remarks.trim()) {
      const daysVal = parseFloat(newDeduction.days);
      const remarksVal = newDeduction.remarks.trim();
      if (isNaN(daysVal) || daysVal <= 0) {
        setErrors(prev => ({ ...prev, deducteddays: 'Must be a valid positive number' }));
        return;
      }
      if (!remarksVal) {
        setErrors(prev => ({ ...prev, remarks: 'Description is required' }));
        return;
      }
      const currentSum = finalDeductions.reduce((sum, item) => sum + item.days, 0);
      if (baseProcessed - (currentSum + daysVal) < 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Total manual deductions cannot exceed processed business days.',
          customClass: { popup: 'swal2-minimalist' }
        });
        return;
      }
      finalDeductions.push({
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        days: daysVal,
        remarks: remarksVal
      });
    }

    try {
      setIsSubmitting(true);
      const totalDeducted = finalDeductions.reduce((sum, d) => sum + d.days, 0);
      const calculatedNetDays = Math.max(0, baseProcessed - totalDeducted);
      
      const payloadRemarks = finalDeductions.length > 0 ? JSON.stringify(finalDeductions) : '';

      const response = await fetch(
        `${API_URL}/api/documents/${editingDoc.documentid}/networkdays`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deducteddays: totalDeducted,
            calcnetworkdays: calculatedNetDays,
            remarks: payloadRemarks,
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
        // If focusing inputs, let Enter key trigger the Add or Save action
        if (document.activeElement?.placeholder?.includes('e.g.')) {
          event.preventDefault();
          handleAddDeduction();
        } else {
          event.preventDefault();
          handleSubmit();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, isSubmitting, onClose, handleSubmit, deductions, newDeduction]);

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
          <div className="px-6 pt-5 pb-0 overflow-y-auto max-h-[calc(85vh-150px)]">
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
                    <span>Non-Office Days Deducted</span>
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

                {/* Additional Deductions (Read-Only) */}
                {viewMode && deductions.length > 0 && (
                  <div className="flex flex-col py-0.5 border-t border-dashed border-slate-100 pt-1.5 mt-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-slate-700">Manual / Additional Deductions</span>
                      <span className="font-bold text-slate-700">
                        {deductedPreview} {deductedPreview === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {deductions.map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between items-start text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500 font-medium">{item.remarks}</span>
                          <span className="font-extrabold text-slate-700 shrink-0 ml-2">{item.days} {item.days === 1 ? 'day' : 'days'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Deductions Form (only if editMode / !viewMode) */}
            {!viewMode && (
              <div className="py-4 border-t border-slate-100/80 space-y-4">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Manual / Additional Deductions
                </h4>
                
                {/* Current list of deductions */}
                {deductions.length > 0 && (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {deductions.map((item, idx) => (
                      <div key={item.id || idx} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{item.remarks}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{item.days} {item.days === 1 ? 'day' : 'days'} deduction</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDeductions(prev => prev.filter(d => d.id !== item.id));
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove deduction"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new deduction form */}
                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Add Deduction</p>
                  <div className="grid grid-cols-12 gap-3 items-start">
                    <div className="col-span-4 space-y-1">
                      <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
                        Days
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1"
                        className={`w-full h-9 px-3 bg-white border ${errors.deducteddays ? 'border-rose-300 focus:ring-rose-500/5' : 'border-slate-200 focus:border-[#0b4c95]'} rounded-xl text-xs font-bold text-slate-700 outline-none transition-all`}
                        value={newDeduction.days}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                            setNewDeduction(prev => ({ ...prev, days: val }));
                            if (errors.deducteddays) setErrors(prev => ({ ...prev, deducteddays: '' }));
                          }
                        }}
                      />
                      {errors.deducteddays && (
                        <p className="text-[8px] text-rose-500 font-semibold">{errors.deducteddays}</p>
                      )}
                    </div>
                    <div className="col-span-6 space-y-1">
                      <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
                        Description / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. WFH"
                        className={`w-full h-9 px-3 bg-white border ${errors.remarks ? 'border-rose-300 focus:ring-rose-500/5' : 'border-slate-200 focus:border-[#0b4c95]'} rounded-xl text-xs font-bold text-slate-700 outline-none transition-all`}
                        value={newDeduction.remarks}
                        onChange={(e) => {
                          setNewDeduction(prev => ({ ...prev, remarks: e.target.value }));
                          if (errors.remarks) setErrors(prev => ({ ...prev, remarks: '' }));
                        }}
                      />
                      {errors.remarks && (
                        <p className="text-[8px] text-rose-500 font-semibold">{errors.remarks}</p>
                      )}
                    </div>
                    <div className="col-span-2 pt-4">
                      <button
                        type="button"
                        onClick={handleAddDeduction}
                        className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-sm shadow-blue-500/10"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          {viewMode ? (
            <button className="modal-cancel-btn" onClick={() => onClose(false)}>
              Close
            </button>
          ) : (
            <>
              <button 
                className="modal-cancel-btn" 
                onClick={() => onClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="btn-dost-blue px-5 h-9 rounded-xl text-white font-bold text-xs shadow-md shadow-sky-900/10 flex items-center justify-center gap-1.5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayProcessingDays;
