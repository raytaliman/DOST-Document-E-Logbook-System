import { useEffect, useState, useCallback } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { io } from 'socket.io-client';

// Components
const DropdownButton = ({ label, value, onClick, isOpen }) => (
  <div className="relative w-36">
    <button
      onClick={onClick}
      className={`h-10 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 ${
        isOpen ? 'rounded-t-xl border-b-0 shadow-lg' : 'rounded-xl'
      } shadow-2xs flex items-center justify-between px-4 font-bold text-sm cursor-pointer transition-all duration-200 w-full`}
    >
      <span className="truncate">{value}</span>
      <svg 
        className={`w-3.5 h-3.5 ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`}
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
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
          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
);

function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showAverageDaysModal, setShowAverageDaysModal] = useState(false);
  const [modalDocuments, setModalDocuments] = useState([]);
  const [modalTitle, setModalTitle] = useState('');
  const months = ['January', 'February', 'March', 'April', 'May', 'June','July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const API_URL = import.meta.env.VITE_API_URL;
  const isNotArchived = doc => doc.isarchive === false;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/documents`);
      const data = response.data;

      // Only include non-archived documents, but don't filter by month/year 
      const filtered = data.filter(doc => doc.isarchive === false);

      setDocuments(filtered);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, selectedMonth, selectedYear]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('documents_updated', fetchDocuments);

    return () => {
      socket.off('documents_updated', fetchDocuments);
      socket.disconnect();
    };
  }, [API_URL, fetchDocuments]);

  // Parse dateReleased from VARCHAR to Date object
  const parseDateReleased = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    try {
      // Parse the VARCHAR date string (format: "June 12, 2025 at 8:00 AM")
      const datePart = dateStr.split(' at ')[0]; // Remove the time portion
      const parsedDate = new Date(datePart);
      
      // Check if the date is valid
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return null;
    }
  };

  // Get today's outgoing document count
  const getTodayOutgoingCount = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      // Check if the document was received today (between today 00:00 and tomorrow 00:00)
      const receivedToday = docDate >= today && docDate < tomorrow;
      
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        (doc.route === 'ORD' || doc.route === 'Accounting_Unit') &&
        receivedToday
      );
    }).length;
  };

  // Get monthly outgoing document counts
  const getMonthlyOutgoingCount = () => {
    return documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    }).length;
  };

  // Get monthly incoming document counts
  const getMonthlyIncomingCount = () => {
    return documents.filter(doc => {
      const docDate = new Date(doc.datesent);
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      return (
        isNotArchived(doc) && 
        doc.documentdirection === 'incoming' &&
        doc.route !== 'ORD' && doc.route !== 'Accounting_Unit' &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    }).length;
  };

  // Get document types data for the line graph
  const getDocumentTypesData = () => {
    const typeCounts = {};
    const daysInMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();
    
    documents.forEach(doc => {
      if (!isNotArchived(doc)) return;
      
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return;
      
      if (!typeCounts[doc.documenttype]) {
        typeCounts[doc.documenttype] = Array(daysInMonth).fill(0);
      }
      
      const day = docDate.getDate() - 1;
      if (day >= 0 && day < daysInMonth && 
          docDate.getMonth() === months.indexOf(selectedMonth) &&
          docDate.getFullYear() === selectedYear) {
        typeCounts[doc.documenttype][day]++;
      }
    });
    
    return typeCounts;
  };

  const prepareChartData = () => {
    const documentTypeData = getDocumentTypesData();
    const daysInMonth = new Date(selectedYear, months.indexOf(selectedMonth) + 1, 0).getDate();

    const labels = [];
    const dataPoints = {};
    
    Object.keys(documentTypeData).forEach(type => {
      dataPoints[type] = [];
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, months.indexOf(selectedMonth), day);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        labels.push(`Day ${day}`);
        Object.keys(documentTypeData).forEach(type => {
          dataPoints[type].push(documentTypeData[type][day - 1] || 0);
        });
      }
    }

    const series = Object.keys(dataPoints).map(type => ({
      name: type,
      data: dataPoints[type]
    }));

    return {
      labels,
      series
    };
  };

  // Get average processing days for outgoing documents
  const getAverageProcessingDays = () => {
    const filteredDocs = documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      // Ensure calcnetworkdays is a valid number (not null, not NaN)
      const days = Number(doc.calcnetworkdays);
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' && 
        (doc.route === 'ORD' || doc.route === 'Accounting_Unit') &&
        doc.calcnetworkdays !== null &&
        !isNaN(days) &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    });

    if (filteredDocs.length === 0) return "0.00";
    const totalDays = filteredDocs.reduce((sum, doc) => (
      sum + Number(doc.calcnetworkdays)
    ), 0);
    return (totalDays / filteredDocs.length).toFixed(2);
  };

  const chartData = prepareChartData();

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    // Add event listener when component mounts
    window.addEventListener('keydown', handleKeyDown);

    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); 

  // Modal handlers
  const openTodayModal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const filteredDocs = documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      // Check if the document was received today (between today 00:00 and tomorrow 00:00)
      const receivedToday = docDate >= today && docDate < tomorrow;
      
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        (doc.route === 'ORD' || doc.route === 'Accounting_Unit') &&
        receivedToday
      );
    });
    
    setModalDocuments(filteredDocs);
    setModalTitle('Today\'s Outgoing Documents');
    setShowTodayModal(true);
  };

  const openMonthModal = () => {
    const filteredDocs = documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    });
    
    setModalDocuments(filteredDocs);
    setModalTitle(`Outgoing Documents - ${selectedMonth} ${selectedYear}`);
    setShowMonthModal(true);
  };

  const openIncomingModal = () => {
    const filteredDocs = documents.filter(doc => {
      const docDate = new Date(doc.datesent);
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      return (
        isNotArchived(doc) && 
        doc.documentdirection === 'incoming' &&
        doc.route !== 'ORD' && doc.route !== 'Accounting_Unit' &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    });
    
    setModalDocuments(filteredDocs);
    setModalTitle(`Incoming Documents - ${selectedMonth} ${selectedYear}`);
    setShowIncomingModal(true);
  };

  const openAverageDaysModal = () => {
    const filteredDocs = documents.filter(doc => {
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      
      // Exclude weekends (Saturday = 6, Sunday = 0)
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' && 
        (doc.route === 'ORD' || doc.route === 'Accounting_Unit') &&
        doc.calcnetworkdays !== null &&
        docDate.getMonth() === months.indexOf(selectedMonth) &&
        docDate.getFullYear() === selectedYear
      );
    });
    
    setModalDocuments(filteredDocs);
    setModalTitle(`Average Processing Days - ${selectedMonth} ${selectedYear}`);
    setShowAverageDaysModal(true);
  };

  const closeModal = () => {
    setShowTodayModal(false);
    setShowMonthModal(false);
    setShowIncomingModal(false);
    setShowAverageDaysModal(false);
    setModalDocuments([]);
    setModalTitle('');
  };

  const CHART_COLORS = [
    '#0b4c95', '#c2185b', '#0891b2', '#059669', '#7c3aed',
    '#ea580c', '#0369a1', '#be185d', '#15803d', '#6d28d9'
  ];

  const chartOptions = {
    chart: {
      height: '100%',
      type: 'area',
      zoom: { enabled: true },
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        style: { fontSize: '12px' }
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700,
        animateGradually: { enabled: true, delay: 80 }
      },
      fontFamily: '\'Plus Jakarta Sans\', sans-serif',
    },
    colors: CHART_COLORS,
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.02,
        stops: [0, 95, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: 'smooth',
      width: 2.5
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      padding: { top: 0, right: 8, bottom: 0, left: 4 }
    },
    markers: {
      size: 0,
      hover: { size: 6, sizeOffset: 3 }
    },
    xaxis: {
      categories: chartData.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: '#94a3b8',
          fontSize: '10px',
          fontWeight: 600
        },
        rotate: -30,
        rotateAlways: false
      },
      tooltip: { enabled: false }
    },
    yaxis: {
      min: 0,
      tickAmount: 4,
      labels: {
        style: {
          colors: '#94a3b8',
          fontSize: '11px',
          fontWeight: 600
        },
        formatter: (val) => (Number.isInteger(val) ? val : '')
      }
    },
    legend: { show: false },
    tooltip: {
      theme: 'light',
      style: { fontSize: '12px', fontFamily: '\'Plus Jakarta Sans\', sans-serif' },
      x: { show: true },
      y: {
        formatter: (val) => `${val} document${val !== 1 ? 's' : ''}`
      },
      marker: { show: true }
    }
  };

  return (
    <div className="flex flex-col w-full p-2 space-y-6">
      <div className="flex justify-end">
        <div className="flex gap-x-2">
          <div className="flex flex-col items-start relative">
            <DropdownButton 
              value={selectedMonth} 
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
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

          <div className="flex flex-col items-start relative">
            <DropdownButton 
              value={selectedYear} 
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              isOpen={showYearDropdown}
            />
            <DropdownMenu
              items={years}
              onSelect={(year) => {
                setSelectedYear(year);
                setShowYearDropdown(false);
              }}
              isOpen={showYearDropdown}
            />
          </div>
        </div>
      </div>

      {/* Small Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-gradient-to-br from-[#0b4c95] to-[#1460A2] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-sky-900/10 hover:shadow-xl hover:shadow-sky-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-sky-200 uppercase">Outgoing Today</p>
              <p className="text-3xl font-extrabold mt-2 tracking-tight">{getTodayOutgoingCount()}</p>
            </div>
            <button 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors cursor-pointer text-white border border-white/10"
              onClick={openTodayModal}
              title="View Documents"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-sky-200/80 font-bold z-10">Count of outgoing documents today</p>
        </div>

        {/* Card 2 */}
        <div className="bg-gradient-to-br from-[#c2185b] to-[#dc2f74] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-pink-900/10 hover:shadow-xl hover:shadow-pink-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-pink-200 uppercase">Outgoing Month</p>
              <p className="text-3xl font-extrabold mt-2 tracking-tight">{getMonthlyOutgoingCount()}</p>
            </div>
            <button 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors cursor-pointer text-white border border-white/10"
              onClick={openMonthModal}
              title="View Documents"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-pink-200/80 font-bold z-10">Total outgoing in selected month</p>
        </div>

        {/* Card 3 */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-emerald-900/10 hover:shadow-xl hover:shadow-emerald-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-emerald-200 uppercase">Incoming Month</p>
              <p className="text-3xl font-extrabold mt-2 tracking-tight">{getMonthlyIncomingCount()}</p>
            </div>
            <button 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors cursor-pointer text-white border border-white/10"
              onClick={openIncomingModal}
              title="View Documents"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-emerald-200/80 font-bold z-10">Total incoming in selected month</p>
        </div>

        {/* Card 4 */}
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-violet-900/10 hover:shadow-xl hover:shadow-violet-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-violet-200 uppercase">Avg Proc. Days</p>
              <p className="text-3xl font-extrabold mt-2 tracking-tight">{getAverageProcessingDays()}</p>
            </div>
            <button 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors cursor-pointer text-white border border-white/10"
              onClick={openAverageDaysModal}
              title="View Statistics"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-violet-200/80 font-bold z-10">Average network processing days</p>
        </div>
      </div>

      {/* Document Types Overview Card — Premium Area Chart */}
      <div className="card-premium p-6">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Document Types Overview</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">Daily volume breakdown by document category — {selectedMonth} {selectedYear}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-extrabold tracking-widest text-[#c2185b] bg-[#fce8f0] px-3.5 py-1.5 rounded-xl uppercase border border-[#c2185b]/10">
              {selectedMonth} {selectedYear}
            </span>
            {!loading && chartData.series.length > 0 && (
              <span className="text-[10px] font-extrabold tracking-widest text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-xl uppercase">
                {chartData.series.length} {chartData.series.length === 1 ? 'type' : 'types'}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="animate-pulse space-y-3 w-full">
              <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="h-5 bg-slate-100 rounded-lg w-24"></div>)}
              </div>
              <div className="h-64 bg-gradient-to-b from-slate-50 to-transparent rounded-2xl w-full"></div>
            </div>
          </div>
        ) : chartData.series.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-semibold">No document activity for {selectedMonth} {selectedYear}</p>
            <p className="text-xs mt-1">Try selecting a different month or year</p>
          </div>
        ) : (
          <>
            {/* Custom Legend — document type pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {chartData.series.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-100 bg-white shadow-2xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wide whitespace-nowrap">{s.name}</span>
                  <span
                    className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '18',
                      color: CHART_COLORS[i % CHART_COLORS.length]
                    }}
                  >
                    {s.data.reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="h-80">
              <Chart
                options={chartOptions}
                series={chartData.series}
                type="area"
                height="100%"
              />
            </div>

            {/* Bottom summary strip */}
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {chartData.series.slice(0, 4).map((s, i) => {
                const total = s.data.reduce((a, b) => a + b, 0);
                const peak = Math.max(...s.data);
                return (
                  <div
                    key={s.name}
                    className="rounded-xl p-3 border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">{s.name}</span>
                    </div>
                    <p className="text-lg font-extrabold text-slate-800">{total}</p>
                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Peak: {peak} / day</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Documents Modal */}
      {(showTodayModal || showMonthModal || showIncomingModal || showAverageDaysModal) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col relative border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">{modalTitle}</h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full uppercase">
                  Total: {modalDocuments.length}
                </span>
              </div>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-lg font-bold"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {modalDocuments.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-semibold">No documents found matching this filter</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {modalDocuments.map((doc, index) => (
                    <div key={index} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-2xs hover:border-slate-300 transition-colors">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">DTS No.</span>
                          <span className="text-sm font-extrabold text-slate-800">{doc.dtsno || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Type</span>
                          <span className="text-sm font-semibold text-slate-700">{doc.documenttype || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direction</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize bg-white border border-slate-200 text-slate-700">
                            {doc.documentdirection || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Sent</span>
                          <span className="text-sm font-medium text-slate-600">
                            {doc.datesent ? new Date(doc.datesent).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            }) : 'N/A'}
                          </span>
                        </div>
                        {/* Only show Date Released for outgoing documents */}
                        {doc.documentdirection === 'outgoing' && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Released</span>
                            <span className="text-sm font-medium text-slate-600">
                              {doc.datereleased ? parseDateReleased(doc.datereleased)?.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              }) || 'N/A' : 'N/A'}
                            </span>
                          </div>
                        )}
                        {/* Only show Processing Days for outgoing documents in average days modal */}
                        {showAverageDaysModal && doc.calcnetworkdays !== null && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Processing Days</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              doc.calcnetworkdays <= 0 || doc.calcnetworkdays > 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {doc.calcnetworkdays} days
                            </span>
                          </div>
                        )}
                      </div>
                      {doc.subject && (
                        <div className="mt-4 pt-4 border-t border-slate-200/60">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</span>
                          <p className="text-sm text-slate-700 leading-relaxed font-medium">{doc.subject}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;