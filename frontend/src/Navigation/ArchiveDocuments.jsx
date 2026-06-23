import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2'; 
import { io } from 'socket.io-client';
import moment from 'moment';
import { FiRotateCcw, FiTrash2, FiSearch, FiChevronDown } from 'react-icons/fi';
import '../index.css';

function ArchiveDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3600';
  const months = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const adminData = localStorage.getItem('admin');
  const adminDirection = adminData ? JSON.parse(adminData).documentdirection : null;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/documents/archived`);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const filteredDocuments = data.map(doc => ({
        documentid: doc.documentid,
        dtsNo: doc.dtsno,
        dateReceived: doc.datesent || '-',
        dateReleased: doc.datereleased || '-', 
        documentType: doc.documenttype || '-',
        documentDirection: doc.documentdirection ? doc.documentdirection.charAt(0).toUpperCase() + doc.documentdirection.slice(1) : '-',
        archiveDate: doc.archivedate || '-',
        archiveBy: doc.archivedby || '-'
      }));

      setDocuments(filteredDocuments);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load Documents',
        text: 'Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  }, [API_URL]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('documents_updated', fetchDocuments);

    return () => {
      socket.off('documents_updated', fetchDocuments);
      socket.disconnect();
    };
  }, [API_URL, fetchDocuments]);

  // Handle restore
  const handleRestore = async (docId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to restore this document?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, restore it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isarchive: false
        })
      });

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.documentid !== docId));
        Swal.fire({
          icon: 'success',
          title: 'Restored Successfully',
          text: 'Document has been restored.',
          timer: 1800,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist'
          }
        });
      } else {
        const error = await response.json();
        Swal.fire({
          icon: 'error',
          title: 'Failed to Restore',
          text: error.message || 'Failed to restore document. Please try again.',
          timer: 2500,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist'
          }
        });
      }
    } catch (error) {
      console.error('Error restoring document:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while restoring. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  // Handle delete action
  const handleDelete = async (docId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the document from the database. This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    
    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
  
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete document');
      }
  
      await response.json();
  
      setDocuments(documents.filter(doc => doc.documentid !== docId));
      Swal.fire({
        icon: 'success',
        title: 'Permanently Deleted',
        text: 'Document has been permanently deleted.',
        timer: 1800,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message.includes('<!DOCTYPE html>') 
          ? 'Server error occurred' 
          : error.message || 'An error occurred while deleting. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      doc.dtsNo?.toLowerCase().includes(search) ||
      doc.documentType?.toLowerCase().includes(search) ||
      doc.documentDirection?.toLowerCase().includes(search);

    const archiveDateStr = doc.archiveDate;
    let matchesMonth = true;
    let matchesYear = true;
    if (archiveDateStr && archiveDateStr !== '-') {
      const [month] = archiveDateStr.split(' ');
      const year = archiveDateStr.match(/\d{4}/)?.[0];
      matchesMonth = selectedMonth === 'All' || month === selectedMonth;
      matchesYear = selectedYear === 'All' || Number(year) === Number(selectedYear);
    }
    return matchesSearch && matchesMonth && matchesYear;
  });

  const formatDate = (dateString) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = moment(dateString);
      return date.isValid() ? date.format('MMMM D, YYYY [at] h:mm A') : '-';
    } catch (e) {
      return '-';
    }
  };

  // Redesigned Dropdowns
  const DropdownButton = ({ label, value, onClick, isOpen }) => (
    <div className="relative w-36">
      <button
        onClick={onClick}
        className={`h-10 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 ${
          isOpen ? 'rounded-t-xl border-b-0 shadow-lg' : 'rounded-xl'
        } shadow-2xs flex items-center justify-between px-4 font-bold text-xs cursor-pointer transition-all duration-200 w-full`}
      >
        <span className="truncate">{value}</span>
        <FiChevronDown className={`w-3.5 h-3.5 ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`} />
      </button>
    </div>
  );

  const DropdownMenu = ({ items, onSelect, isOpen, className }) => (
    isOpen && (
      <div
        className={`absolute top-[98%] left-0 z-30 w-full bg-white rounded-b-xl shadow-lg border border-slate-200/60 overflow-hidden py-1 divide-y divide-slate-100 ${className}`}
      >
        {items.map((item) => (
          <button
            key={item}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-6">
      {/* Header Panel with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Archive Documents</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Browse, review, and restore archived logbook transactions</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative w-72 h-10 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center px-3.5 focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10 transition-all duration-200">
            <FiSearch className="text-slate-400 w-4 h-4 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by DTS no., type, direction..."
              className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month Dropdown */}
          <div className="flex flex-col items-start relative">
            <DropdownButton 
              value={selectedMonth} 
              onClick={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowYearDropdown(false);
              }}
              isOpen={showMonthDropdown}
            />
            <DropdownMenu
              items={months}
              onSelect={(month) => {
                setSelectedMonth(month);
                setShowMonthDropdown(false);
              }}
              isOpen={showMonthDropdown}
            />
          </div>

          {/* Year Dropdown */}
          <div className="flex flex-col items-start relative">
            <DropdownButton 
              value={selectedYear} 
              onClick={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false);
              }}
              isOpen={showYearDropdown}
            />
            <DropdownMenu
              items={years.map(String)}
              onSelect={(year) => {
                setSelectedYear(Number(year));
                setShowYearDropdown(false);
              }}
              isOpen={showYearDropdown}
            />
          </div>
        </div>
      </div>

      {/* Documents Table Container */}
      <div className="table-container-premium shadow-2xs">
        <div className="overflow-x-auto">
          <table className="table-premium w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-[18%] text-center">
                  {adminDirection === 'incoming' ? 'Date Sent' : 'Date Received'}
                </th>
                <th className="w-[18%] text-center">Date Released</th>
                <th className="w-[12%] text-center">DTS No.</th>
                <th className="w-[12%] text-center">Direction</th>
                <th className="w-[15%]">Document Type</th>
                <th className="w-[15%] text-center">Archive Date</th>
                <th className="w-[12%]">Archived By</th>
                <th className="w-[10%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading archived documents...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                  const direction = doc.documentDirection.toLowerCase();
                  let directionBadgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                  if (direction === 'incoming') {
                    directionBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                  } else if (direction === 'outgoing') {
                    directionBadgeClass = "bg-pink-50 text-pink-700 border-pink-200/50";
                  }

                  const isDisabled = 
                    (adminDirection === 'incoming' && direction !== 'incoming') ||
                    (adminDirection === 'outgoing' && direction !== 'outgoing');

                  return (
                    <tr key={doc.documentid}>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {formatDate(doc.dateReceived)}
                      </td>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {doc.dateReleased !== '-' ? formatDate(doc.dateReleased) : '-'}
                      </td>
                      <td className="text-center font-extrabold text-slate-800 text-xs">
                        {doc.dtsNo}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${directionBadgeClass}`}>
                          {doc.documentDirection}
                        </span>
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[150px] truncate" title={doc.documentType}>
                        {doc.documentType}
                      </td>
                      <td className="text-center text-slate-500 font-semibold text-xs">
                        {doc.archiveDate}
                      </td>
                      <td className="font-medium text-slate-600 text-xs truncate max-w-[120px]">
                        {doc.archiveBy}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleRestore(doc.documentid)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                : 'text-sky-600 hover:bg-sky-50 border-sky-100'
                            }`}
                            title={isDisabled ? "Action restricted" : "Restore Document"}
                            disabled={isDisabled}
                          >
                            <FiRotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.documentid)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                              isDisabled
                                ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                : 'text-pink-600 hover:bg-pink-50 border-pink-100'
                            }`}
                            title={isDisabled ? "Action restricted" : "Delete Permanently"}
                            disabled={isDisabled}
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiSearch className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-semibold">No archived documents found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ArchiveDocuments;