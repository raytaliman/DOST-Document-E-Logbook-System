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
  const [userStatsView, setUserStatsView] = useState('chart');
  const months = ['January', 'February', 'March', 'April', 'May', 'June','July', 'August', 'September', 'October', 'November', 'December'];
  const filterMonths = ['All', ...months];
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
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
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
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
        docDate.getFullYear() === selectedYear
      );
    }).length;
  };

  // Get document types data for the line graph
  const getDocumentTypesData = () => {
    const typeCounts = {};
    
    if (selectedMonth === 'All') {
      documents.forEach(doc => {
        if (!isNotArchived(doc)) return;
        
        let docDate = null;
        if (doc.documentdirection === 'incoming') {
          docDate = new Date(doc.datesent);
        } else {
          docDate = parseDateReleased(doc.datereleased);
        }
        if (!docDate || isNaN(docDate.getTime())) {
          if (doc.datesent) docDate = new Date(doc.datesent);
        }
        if (!docDate || isNaN(docDate.getTime())) return;
        
        if (docDate.getFullYear() === selectedYear) {
          if (!typeCounts[doc.documenttype]) {
            typeCounts[doc.documenttype] = Array(12).fill(0);
          }
          typeCounts[doc.documenttype][docDate.getMonth()]++;
        }
      });
    } else {
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
    }
    
    return typeCounts;
  };

  const prepareChartData = () => {
    const documentTypeData = getDocumentTypesData();
    
    if (selectedMonth === 'All') {
      const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const series = Object.keys(documentTypeData).map(type => ({
        name: type,
        data: documentTypeData[type]
      }));
      return { labels, series };
    }

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
      const dayOfWeek = docDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      const normalizedRoute = (doc.route || '').replace(/_/g, ' ').toLowerCase();
      const days = Number(doc.daysprocessed);
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        (normalizedRoute === 'ord' || normalizedRoute === 'accounting unit') &&
        doc.daysprocessed !== null &&
        !isNaN(days) &&
        days > 0 &&
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
        docDate.getFullYear() === selectedYear
      );
    });

    if (filteredDocs.length === 0) return "0.00";
    const totalDays = filteredDocs.reduce((sum, doc) => (
      sum + Number(doc.daysprocessed)
    ), 0);
    return (totalDays / filteredDocs.length).toFixed(2);
  };

  // Get average processing days per user for outgoing docs (ORD / Accounting Unit)
  const getAvgProcessingDaysPerUser = () => {
    const relevant = documents.filter(doc => {
      if (!isNotArchived(doc)) return false;
      if (doc.documentdirection !== 'outgoing') return false;
      const normalizedRoute = (doc.route || '').replace(/_/g, ' ').toLowerCase();
      if (normalizedRoute !== 'ord' && normalizedRoute !== 'accounting unit') return false;
      if (!doc.daysprocessed || Number(doc.daysprocessed) <= 0) return false;
      if (!doc.processedby || !doc.processedby.trim()) return false;
      const docDate = parseDateReleased(doc.datereleased);
      if (!docDate) return false;
      if (selectedMonth !== 'All' && docDate.getMonth() !== months.indexOf(selectedMonth)) return false;
      if (docDate.getFullYear() !== selectedYear) return false;
      return true;
    });

    const byUser = {};
    relevant.forEach(doc => {
      const name = doc.processedby.trim();
      if (!byUser[name]) byUser[name] = { total: 0, count: 0 };
      byUser[name].total += Number(doc.daysprocessed);
      byUser[name].count += 1;
    });

    return Object.entries(byUser)
      .map(([name, { total, count }]) => ({
        name,
        initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        avg: total / count,
        count,
      }))
      .sort((a, b) => a.avg - b.avg);
  };

  // Get user processing statistics for selected month and year
  const getUserProcessingStats = () => {
    const stats = {};
    let totalAll = 0;
    
    documents.forEach(doc => {
      let docDate = null;
      if (doc.documentdirection === 'incoming') {
        docDate = new Date(doc.datesent);
      } else {
        docDate = parseDateReleased(doc.datereleased);
      }

      if (!docDate || isNaN(docDate.getTime())) {
        if (doc.datesent) {
          docDate = new Date(doc.datesent);
        }
      }

      if (!docDate || isNaN(docDate.getTime())) return;

      const matchesMonth = selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth);
      const matchesYear = docDate.getFullYear() === selectedYear;

      if (matchesMonth && matchesYear) {
        const rawUser = doc.processedby || '';
        const user = rawUser.trim() || 'System / Unassigned';
        
        if (!stats[user]) {
          stats[user] = {
            name: user,
            incoming: 0,
            outgoing: 0,
            total: 0
          };
        }
        if (doc.documentdirection === 'incoming') {
          stats[user].incoming++;
        } else {
          stats[user].outgoing++;
        }
        stats[user].total++;
        totalAll++;
      }
    });

    return Object.values(stats)
      .sort((a, b) => b.total - a.total)
      .map(item => ({
        ...item,
        percentage: totalAll > 0 ? Math.round((item.total / totalAll) * 100) : 0,
        initials: item.name
          .split(' ')
          .map(n => n ? n[0] : '')
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'U'
      }));
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
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
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
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
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
      
      const normalizedRoute = (doc.route || '').replace(/_/g, ' ').toLowerCase();
      return (
        isNotArchived(doc) &&
        doc.documentdirection === 'outgoing' &&
        (normalizedRoute === 'ord' || normalizedRoute === 'accounting unit') &&
        doc.daysprocessed !== null &&
        (selectedMonth === 'All' || docDate.getMonth() === months.indexOf(selectedMonth)) &&
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
    '#0b4c95', // Primary DOST Blue
    '#1e40af', // Indigo Blue
    '#0284c7', // Sky Blue
    '#0d9488', // Teal
    '#2563eb', // Royal Blue
    '#0891b2', // Cyan
    '#4f46e5', // Violet-Blue
    '#1d4ed8', // Medium Blue
    '#0f766e', // Dark Teal
    '#0369a1'  // Slate Blue
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
              items={filterMonths}
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
        <div className="bg-gradient-to-br from-[#0b4c95] to-[#1d5fb0] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-sky-900/10 hover:shadow-xl hover:shadow-sky-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
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
        <div className="bg-gradient-to-br from-[#073467] to-[#0b4c95] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-blue-900/10 hover:shadow-xl hover:shadow-blue-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-sky-200 uppercase">Outgoing Month</p>
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
          <p className="text-[10px] text-sky-200/80 font-bold z-10">Total outgoing in selected month</p>
        </div>

        {/* Card 3 */}
        <div className="bg-gradient-to-br from-[#1e40af] to-[#3b82f6] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-blue-900/10 hover:shadow-xl hover:shadow-blue-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-blue-200 uppercase">Incoming Month</p>
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
          <p className="text-[10px] text-blue-200/80 font-bold z-10">Total incoming in selected month</p>
        </div>

        {/* Card 4 */}
        <div className="bg-gradient-to-br from-[#0369a1] to-[#0891b2] rounded-2xl p-5 text-white h-32 flex flex-col justify-between shadow-md shadow-cyan-900/10 hover:shadow-xl hover:shadow-cyan-900/20 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-[10px] font-extrabold tracking-widest text-cyan-200 uppercase">Avg. Processing Days</p>
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
          <p className="text-[10px] text-cyan-200/80 font-bold z-10">Average processing days (office-hours based)</p>
        </div>
      </div>

      {/* Document Types Overview — full-width row */}
      <div className="card-premium p-6 flex flex-col">
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
              <div className="flex-1 min-h-0">
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

      {/* Row 2: Processed by User + Avg Processing Days per User */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processed by User Card */}
        <div className="card-premium p-6 flex flex-col min-h-[480px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Processed by User</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">Documents handled — {selectedMonth} {selectedYear}</p>
            </div>
            
            {/* View Toggle Buttons */}
            {getUserProcessingStats().length > 0 && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-x-1 border border-slate-200/40">
                <button
                  onClick={() => setUserStatsView('chart')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                    userStatsView === 'chart'
                      ? 'bg-white text-[#0b4c95] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Chart View"
                >
                  Chart
                </button>
                <button
                  onClick={() => setUserStatsView('list')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                    userStatsView === 'list'
                      ? 'bg-white text-[#0b4c95] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="List View"
                >
                  List
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto mt-2 pr-1 space-y-4 scrollbar-thin flex flex-col justify-between">
            {getUserProcessingStats().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16 flex-1">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-sm font-semibold text-center">No processing activity</p>
                <p className="text-xs mt-1 text-center text-slate-400/80">For {selectedMonth} {selectedYear}</p>
              </div>
            ) : userStatsView === 'chart' ? (
              <div className="h-80 flex-1 min-h-[300px]">
                <Chart
                  options={{
                    chart: {
                      type: 'bar',
                      stacked: true,
                      toolbar: { show: false },
                      fontFamily: '\'Plus Jakarta Sans\', sans-serif',
                      animations: {
                        enabled: true,
                        easing: 'easeinout',
                        speed: 550
                      }
                    },
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        columnWidth: '55%',
                        borderRadius: 4,
                        borderRadiusApplication: 'end',
                      }
                    },
                    colors: ['#0b4c95', '#60a5fa'],
                    dataLabels: {
                      enabled: true,
                      formatter: (val) => val > 0 ? val : '',
                      style: {
                        fontSize: '9px',
                        fontWeight: '800',
                        colors: ['#fff']
                      }
                    },
                    xaxis: {
                      categories: getUserProcessingStats().map(u => u.name),
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      labels: {
                        style: {
                          colors: '#475569',
                          fontSize: '9px',
                          fontWeight: 700
                        },
                        rotate: -30,
                        rotateAlways: false
                      }
                    },
                    yaxis: {
                      labels: {
                        style: {
                          colors: '#94a3b8',
                          fontSize: '9px',
                          fontWeight: 600
                        },
                        formatter: (val) => Math.round(val)
                      }
                    },
                    legend: {
                      position: 'top',
                      horizontalAlign: 'center',
                      fontSize: '9px',
                      fontWeight: 700,
                      markers: { radius: 12 },
                      labels: { colors: '#64748b' }
                    },
                    grid: {
                      borderColor: '#f1f5f9',
                      strokeDashArray: 4,
                      padding: { top: -10, right: 10, bottom: 0, left: 10 }
                    },
                    tooltip: {
                      theme: 'light',
                      style: { fontSize: '11px', fontFamily: '\'Plus Jakarta Sans\', sans-serif' },
                      y: {
                        formatter: (val) => `${val} document${val !== 1 ? 's' : ''}`
                      }
                    }
                  }}
                  series={[
                    {
                      name: 'Incoming',
                      data: getUserProcessingStats().map(u => u.incoming)
                    },
                    {
                      name: 'Outgoing',
                      data: getUserProcessingStats().map(u => u.outgoing)
                    }
                  ]}
                  type="bar"
                  height="100%"
                />
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {getUserProcessingStats().map((user, idx) => {
                  const gradients = [
                    'from-[#0b4c95] to-blue-500',
                    'from-[#073467] to-[#0b4c95]',
                    'from-sky-600 to-cyan-500',
                    'from-indigo-600 to-blue-500',
                    'from-teal-600 to-emerald-500'
                  ];
                  const gradient = gradients[idx % gradients.length];
                  
                  return (
                    <div key={user.name} className="group flex flex-col p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-3">
                        {/* Initials Avatar */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-black shadow-md shadow-slate-200/50 uppercase`}>
                          {user.initials}
                        </div>
                        
                        {/* Name & Direction breakdowns */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate group-hover:text-slate-900 transition-colors uppercase tracking-wide">
                            {user.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="text-[#0b4c95] bg-[#e6f0fa] px-1 py-0.5 rounded-sm">{user.incoming} In</span>
                            <span>•</span>
                            <span className="text-sky-600 bg-sky-50 px-1 py-0.5 rounded-sm">{user.outgoing} Out</span>
                          </div>
                        </div>

                        {/* Counts */}
                        <div className="text-right">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 group-hover:bg-[#e6f0fa] group-hover:text-[#0b4c95] transition-colors">
                            {user.total}
                          </span>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{user.percentage}%</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`}
                          style={{ width: `${user.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Avg Processing Days per User Card */}
        <div className="card-premium p-6 flex flex-col min-h-[480px]">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Avg. Processing Days per User</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">Outgoing (ORD / Accounting Unit) — {selectedMonth} {selectedYear}</p>
            </div>
            <span className="text-[10px] font-extrabold tracking-widest text-[#0b4c95] bg-[#e6f0fa] px-3 py-1.5 rounded-xl uppercase border border-[#0b4c95]/10">
              {getAvgProcessingDaysPerUser().length} user{getAvgProcessingDaysPerUser().length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {getAvgProcessingDaysPerUser().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-center">No processing data</p>
                <p className="text-xs mt-1 text-center text-slate-400/80">For {selectedMonth} {selectedYear}</p>
              </div>
            ) : (() => {
              const allAvgs = getAvgProcessingDaysPerUser();
              const maxAvg = Math.max(...allAvgs.map(u => u.avg));
              const avatarGradients = [
                'from-emerald-500 to-teal-500',
                'from-[#0b4c95] to-blue-500',
                'from-sky-600 to-cyan-500',
                'from-amber-500 to-orange-400',
                'from-rose-500 to-pink-500',
              ];
              return allAvgs.map((user, idx) => {
                const isGood = user.avg <= 5;
                const barWidth = maxAvg > 0 ? (user.avg / maxAvg) * 100 : 0;
                const avatarGrad = avatarGradients[idx % avatarGradients.length];
                return (
                  <div key={user.name} className="group flex flex-col p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white text-xs font-black shadow-md shadow-slate-200/50 uppercase flex-shrink-0`}>
                        {user.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate group-hover:text-slate-900 uppercase tracking-wide">{user.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">{user.count} doc{user.count !== 1 ? 's' : ''} processed</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black ${
                          isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {user.avg.toFixed(1)} days
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${isGood ? 'from-emerald-400 to-teal-400' : 'from-rose-400 to-pink-400'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {getAvgProcessingDaysPerUser().length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Overall Average</span>
              <span className="text-sm font-extrabold text-[#0b4c95]">
                {(getAvgProcessingDaysPerUser().reduce((s, u) => s + u.avg, 0) / getAvgProcessingDaysPerUser().length).toFixed(2)} days
              </span>
            </div>
          )}
        </div>
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
                        {showAverageDaysModal && doc.daysprocessed !== null && Number(doc.daysprocessed) > 0 && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Processing Days</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              Number(doc.daysprocessed) <= 0 || Number(doc.daysprocessed) > 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {Number(doc.daysprocessed).toFixed(1)} days
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