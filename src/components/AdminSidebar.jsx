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
      className={`sticky top-0 h-screen shrink-0 border-r border-border/70 bg-background/95 backdrop-blur transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border/70 flex items-center justify-between bg-white/70">
          {!isCollapsed && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80 mb-1">Control room</p>
              <h2 className="font-heading text-lg leading-none">FinOK CRM</h2>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={isCollapsed ? "Розгорнути панель" : "Згорнути панель"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="px-4 pt-4 pb-2">
            <div className="rounded-xl border border-border/70 bg-white/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Робочі модулі</p>
              <p className="text-sm text-foreground/80 mt-1">Усе для консультацій, платежів, календаря й комунікації.</p>
            </div>
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = iconMap[tab.value] || LayoutDashboard;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-transparent text-foreground/70 hover:bg-white hover:border-border/80 hover:text-foreground"
                } ${isCollapsed ? "justify-center" : ""}`}
                title={isCollapsed ? tab.label : ""}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary-foreground/15" : "bg-muted/60"}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                </span>
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