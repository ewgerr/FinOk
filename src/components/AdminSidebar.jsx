import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  CheckCircle,
  Users,
  Wallet,
  Inbox,
  Workflow,
  Bot,
  Briefcase,
  CalendarRange,
  FileText,
  Newspaper,
  MessageSquare,
  Bell,
  History,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  consultations: ClipboardList,
  completed: CheckCircle,
  confirmed: CheckCircle,
  pipeline: Users,
  clients: Users,
  payments: Wallet,
  inbox: Inbox,
  automations: Workflow,
  ai: Bot,
  crm: Briefcase,
  calendar: CalendarRange,
  documents: FileText,
  blog: Newspaper,
  reviews: MessageSquare,
  notifications: Bell,
  audit: History,
  filters: Filter,
};

export default function AdminSidebar({
  tabs,
  activeTab,
  setActiveTab,
  unreadNotificationsCount,
  isCollapsed,
  setIsCollapsed,
}) {
  return (
    <aside
      className={`relative bg-card border-r border-border transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!isCollapsed && <h2 className="font-heading text-lg">Навігація</h2>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-muted"
            aria-label={isCollapsed ? "Розгорнути панель" : "Згорнути панель"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = iconMap[tab.value] || LayoutDashboard;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                } ${isCollapsed ? "justify-center" : ""}`}
                title={isCollapsed ? tab.label : ""}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="flex-1 text-left">{tab.label}</span>}
                {tab.value === "notifications" && unreadNotificationsCount > 0 && (
                  <span
                    className={`min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full text-[11px] leading-none ${
                      isActive ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
                    }`}
                  >
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}