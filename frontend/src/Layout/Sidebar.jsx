import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiFileText,
  FiCalendar,
  FiArchive,
  FiUsers,
  FiUser,
  FiLogOut,
  FiChevronRight,
  FiSettings,
  FiChevronLeft,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userType, setUserType] = useState('admin');
  const [collapsed, setCollapsed] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isHovering, setIsHovering] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const fetchAdminData = () => {
      try {
        const storedAdmin = localStorage.getItem('admin');

        if (!storedAdmin) {
          console.warn('No admin data found in localStorage');
          return;
        }

        const admin = JSON.parse(storedAdmin);

        if (!admin || typeof admin !== 'object') {
          throw new Error('Invalid admin data format');
        }

        setAdminName(admin.adminname || '');
        setAdminEmail(admin.adminemail || '');

        const docType = (
          admin.documentdirection ||
          admin.documentDirection ||
          admin.document_direction ||
          ''
        )
          .toString()
          .toLowerCase()
          .trim();
        const role = (
          admin.usertype ||
          admin.userType ||
          admin.user_type ||
          ''
        )
          .toString()
          .toLowerCase()
          .trim();

        if (role === 'superadmin') {
          setUnitName('ITSM');
          setUserType('superadmin');
        } else {
          switch (docType) {
            case 'all':
              setUnitName('ITSM');
              setUserType('admin');
              break;
            case 'incoming':
              setUnitName('Office of Regional Director (ORD)');
              setUserType('admin');
              break;
            case 'outgoing':
              setUnitName('Budget and Finance');
              setUserType('admin');
              break;
            default:
              setUnitName('General Administration');
              setUserType('admin');
          }
        }
      } catch (error) {
        console.error('Error parsing admin data:', error);
        setUserType('admin');
      }
    };

    fetchAdminData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin');
    navigate('/');
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <motion.div
      initial={{ width: 220 }}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: 'spring', damping: 20 }}
      className="h-screen text-white flex flex-col relative border-r border-white/5 shadow-2xl"
      style={{ background: 'var(--sidebar-gradient)' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Collapse/Expand button */}
      <motion.button
        onClick={toggleCollapse}
        whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
        whileTap={{ scale: 0.95 }}
        className="absolute right-2 top-2 p-1.5 rounded-xl hover:bg-white/5 z-10 cursor-pointer text-white/80 transition-colors"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {collapsed ? (
          <FiChevronRight className="h-5 w-5" stroke="currentColor" />
        ) : (
          <FiChevronLeft className="h-5 w-5" stroke="currentColor" />
        )}
      </motion.button>

      <div className="flex-1 overflow-y-auto scrollbar-hide mt-10">
        <nav className="px-2 py-4 space-y-1">
          {/* Common routes for both user types */}
          <SidebarLink
            to="/dashboard"
            label="Dashboard"
            icon={<FiGrid stroke="currentColor" />}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/alldocuments"
            label="Documents"
            icon={<FiFileText stroke="currentColor" />}
            collapsed={collapsed}
          />

          {userType.includes('admin') && (
            <SidebarLink
              to="/configuration"
              label="Configuration"
              icon={<FiSettings stroke="currentColor" />}
              collapsed={collapsed}
            />
          )}

          {/* Superadmin only route */}
          {userType === 'superadmin' && (
            <SidebarLink
              to="/manageadmin"
              label="Manage Users"
              icon={<FiUsers stroke="currentColor" />}
              collapsed={collapsed}
            />
          )}
        </nav>
      </div>

      {/* Bottom section - profile and logout */}
      <div
        className={`px-2 py-4 space-y-1 border-t border-white/10 sticky bottom-0 ${collapsed ? 'text-center' : ''}`}
        style={{ background: 'rgba(7, 52, 103, 0.95)' }}
      >
        {adminName && (
          <Link to="/profile">
            <motion.div
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
              whileTap={{ scale: 0.98 }}
              className={`px-3 py-2 bg-white/5 rounded-xl border border-white/5 mb-2 flex items-center gap-3 cursor-pointer hover:border-white/15 transition-all duration-200 ${
                collapsed ? 'justify-center p-2' : ''
              }`}
              title={collapsed ? 'Profile' : ''}
            >
              <div className="w-8 h-8 rounded-full bg-[#0b4c95] border border-white/20 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                {adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-white truncate m-0">{adminName}</p>
                  <p className="text-[9px] text-white/80 font-bold uppercase tracking-wider m-0">
                    {userType === 'superadmin' ? 'Super Admin' : 'Admin'}
                  </p>
                  <p className="text-[9px] text-white/50 truncate font-semibold m-0">{adminEmail || unitName}</p>
                </div>
              )}
            </motion.div>
          </Link>
        )}
        <motion.button
          onClick={handleLogout}
          whileHover={{
            scale: 1.02,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer w-full text-white/80 hover:text-white transition-colors ${
            collapsed ? 'justify-center' : 'text-left'
          }`}
        >
          <SidebarIcon icon={<FiLogOut stroke="currentColor" />} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 1 }}
              animate={{ opacity: collapsed ? 0 : 1 }}
              className="text-xs font-semibold tracking-wide"
            >
              Logout
            </motion.span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

function SidebarLink({ to, label, icon, collapsed }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-white/10 text-white border-l-4 border-[#0b4c95] font-bold shadow-inner'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? label : ''}
      >
        <SidebarIcon icon={icon} />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 1 }}
            animate={{ opacity: collapsed ? 0 : 1 }}
            className="text-xs font-semibold tracking-wide"
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    </Link>
  );
}

function SidebarIcon({ icon }) {
  return (
    <motion.div
      className="w-5 h-5 flex items-center justify-center"
      whileHover={{ scale: 1.1 }}
    >
      {icon}
    </motion.div>
  );
}

export default Sidebar;
