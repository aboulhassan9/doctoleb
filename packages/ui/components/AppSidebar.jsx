import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { filterNavigationItemsByEntitlements } from '@core/lib/featureVisibility';
import { useEntitlements } from '@core/hooks/features/useEntitlements';

/**
 * Sidebar configuration per role.
 * This is the ONLY place to add/remove/reorder nav items.
 */
const ROLE_CONFIG = {
  doctor: {
    brandIcon: null, // shows user initials instead
    brandLabel: null,
    brandSub: null,
    menuItems: [
      { icon: 'dashboard',      label: 'Dashboard',    path: '/doctor-dashboard'         },
      { icon: 'group',          label: 'Patients',     path: '/doctor-patients'          },
      { icon: 'calendar_today', label: 'Appointments', path: '/doctor-appointments'      },
      { icon: 'event_repeat',   label: 'Schedule',     path: '/doctor-schedule'          },
      { icon: 'badge',          label: 'Staff',        path: '/doctor-staff'             },
      { icon: 'forum',          label: 'Messages',     path: '/staff-messages'           },
      { icon: 'description',    label: 'Reports',      path: '/doctor-reports'           },
      { icon: 'outbound',       label: 'Referrals',    path: '/doctor-referrals'         },
      { icon: 'verified_user',  label: 'Certificates', path: '/doctor-certificates'      },
      { icon: 'science',        label: 'Catalogs',     path: '/doctor-clinical-catalogs' },
      { icon: 'article',        label: 'Templates',    path: '/templates'                },
      { icon: 'analytics',      label: 'Analytics',    path: '/reports'                  },
      { icon: 'receipt_long',    label: 'Claims',       path: '/doctor-claims'            },
      { icon: 'settings',       label: 'Settings',     path: '/doctor-tenant-settings'   },
    ],
    quickAction: { label: 'Open Schedule', icon: 'calendar_today', path: '/doctor-appointments' },
  },
  predoctor: {
    brandIcon: 'medical_services',
    brandLabel: null, // resolved from BrandContext
    brandSub: 'Pre-Doctor Module',
    menuItems: [
      { icon: 'dashboard',      label: 'Dashboard',     path: '/predoctor-dashboard'    },
      { icon: 'group',          label: 'Patients',      path: '/predoctor-patients'     },
      { icon: 'fact_check',     label: 'Pre-Check',     path: '/predoctor-new-check'    },
      { icon: 'calendar_today', label: 'Appointments',  path: '/predoctor-appointments' },
      { icon: 'schedule',       label: 'Schedule',      path: '/predoctor-schedule'     },
      { icon: 'forum',          label: 'Messages',      path: '/staff-messages'         },
      { icon: 'notifications',  label: 'Notifications', path: '/predoctor-notifications'},
    ],
    quickAction: null,
  },
  secretary: {
    brandIcon: 'medical_services',
    brandLabel: null, // resolved from BrandContext
    brandSub: 'Management System',
    menuItems: [
      { label: 'Dashboard',    icon: 'dashboard',       path: '/dashboard'                      },
      { label: 'Patients',     icon: 'person',          path: '/patients'                       },
      { label: 'Slot Mgmt',    icon: 'event_available', path: '/secretary-slots'                },
      { label: 'Book Appt',    icon: 'calendar_add_on', path: '/secretary-booking'              },
      { label: 'Appointments', icon: 'calendar_month',  path: '/appointments'                   },
      { label: 'Messages',     icon: 'forum',           path: '/staff-messages'                 },
      { label: 'Billing',      icon: 'payments',        path: '/billing'                        },
      { label: 'Insurance',    icon: 'shield',          path: '/secretary-insurance-providers'  },
      { label: 'Claim Forms', icon: 'receipt_long',    path: '/secretary-claim-templates'      },
      { label: 'Catalogs',     icon: 'category',        path: '/secretary-ops-catalogs'         },
    ],
    quickAction: null,
  },
};

/**
 * AppSidebar — Single sidebar for all roles.
 * Replaces DoctorSidebar, PreDoctorSidebar, and Sidebar.
 *
 * @param {{ role: 'doctor' | 'predoctor' | 'secretary' }} props
 */
function SidebarInner({ role, isMobile = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed, toggleSidebar, closeMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { displayName: brandName } = useBrand();
  const { entitlements } = useEntitlements({ audience: 'staff' });

  const config = ROLE_CONFIG[role] || ROLE_CONFIG.secretary;
  const visibleMenuItems = filterNavigationItemsByEntitlements(config.menuItems, entitlements);
  const resolvedBrandLabel = config.brandLabel || (config.brandIcon ? brandName : null);
  const resolvedBrandSub = config.brandSub || 'Clinic Operations';
  const expanded = isMobile || !isCollapsed;
  const isActive = (path) => {
    if (path === '/billing') return location.pathname.startsWith('/billing');
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNav = (path) => {
    navigate(path);
    if (isMobile) closeMobile();
  };

  const initials = user?.first_name
    ? `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
    : role === 'doctor' ? 'DR' : 'U';

  return (
    <aside className={`${isMobile ? 'w-72' : isCollapsed ? 'w-24' : 'w-72'} flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 relative group`}>
      {/* Collapse toggle */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary shadow-sm z-50 transition-all opacity-40 group-hover:opacity-100"
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>chevron_left</span>
        </button>
      )}

      {/* Brand / User header */}
      <div className={`p-6 flex items-center ${expanded ? 'gap-3' : 'justify-center'} h-[84px]`}>
        {config.brandIcon ? (
          <div className="bg-primary/10 p-2 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-primary text-3xl">{config.brandIcon}</span>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 shrink-0">
            {initials}
          </div>
        )}
        {expanded && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex-1 min-w-0">
            {resolvedBrandLabel ? (
              <>
                <h1 className="font-bold text-slate-900 leading-tight truncate">{resolvedBrandLabel}</h1>
                <p className="text-xs text-slate-500 truncate">{resolvedBrandSub}</p>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-slate-900 leading-none truncate block">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Doctor'}
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1 truncate block">
                  {user?.role || role}
                </span>
              </>
            )}
          </motion.div>
        )}
        {isMobile && (
          <button onClick={closeMobile} aria-label="Close menu" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {visibleMenuItems.map((item) => (
          <motion.button
            key={item.path}
            onClick={() => handleNav(item.path)}
            title={!expanded ? item.label : ''}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl transition-all font-medium text-sm ${
              isActive(item.path) ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0" style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : {}}>
              {item.icon}
            </span>
            {expanded && <span className="truncate">{item.label}</span>}
          </motion.button>
        ))}
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t border-slate-200 ${!expanded ? 'flex flex-col items-center gap-4' : ''}`}>
        {/* Quick action */}
        {config.quickAction && expanded && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleNav(config.quickAction.path)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mb-2"
          >
            <span className="material-symbols-outlined text-sm">{config.quickAction.icon}</span>
            {config.quickAction.label}
          </motion.button>
        )}
        {config.quickAction && !expanded && (
          <button
            onClick={() => handleNav(config.quickAction.path)}
            title={config.quickAction.label}
            className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined">{config.quickAction.icon}</span>
          </button>
        )}

        {/* User card (non-doctor roles) */}
        {config.brandIcon && (
          <div className={`flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 mb-3 bg-slate-50 rounded-xl`}>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {initials}
            </div>
            {expanded && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.role || role}</p>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={async () => { await logout(); navigate('/login'); }}
          title={!expanded ? 'Logout' : ''}
          className={`w-full flex items-center ${expanded ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl text-critical hover:bg-red-50 transition-colors font-medium text-sm`}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
          {expanded && <span className="truncate">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default function AppSidebar({ role = 'secretary' }) {
  const { mobileOpen, closeMobile } = useSidebar();
  return (
    <>
      <div className="hidden md:flex h-full shrink-0">
        <SidebarInner role={role} isMobile={false} />
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobile} className="fixed inset-0 bg-black/40 z-40 md:hidden" />
            <motion.div key="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25 }} className="fixed top-0 left-0 h-full z-50 md:hidden">
              <SidebarInner role={role} isMobile={true} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
