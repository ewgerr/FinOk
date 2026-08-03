import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/backendClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Loader2, RefreshCw, Shield, Users, Bell, History, CalendarRange, Clock3, Star, MessageSquare, CheckCircle, XCircle, Trash2, Briefcase, UserPlus, ClipboardList, BarChart3, TrendingUp, Newspaper, Copy, Mail, Send, Wallet, UserRound, Search, ArrowUpRight, ArrowDownRight, DollarSign, UserCheck, Target, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";

const statusOptions = ["", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const typeOptions = ["", "FREE", "PAID"];
const confirmationOptions = ["", "CONFIRMED", "UNCONFIRMED"];
const taskStatusOptions = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
const taskPriorityOptions = ["LOW", "MEDIUM", "HIGH"];

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const statusTone = {
  PENDING: "secondary",
  CONFIRMED: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

const contactMethodLabel = {
  PHONE: "Дзвінок",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
};

const PIPELINE_KEYS = ["NEW", "PENDING", "CONFIRMED", "PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED", "LOST"];
const DEFAULT_PIPELINE_ORDER = {
  NEW: [],
  PENDING: [],
  CONFIRMED: [],
  PAID: [],
  IN_PROGRESS: [],
  COMPLETED: [],
  CANCELLED: [],
  LOST: [],
};

const serializePipelineOrderForApi = (order = DEFAULT_PIPELINE_ORDER) => ({
  NEW: order.NEW || [],
  ASSIGNED: order.PENDING || [],
  CLIENT: order.CONFIRMED || [],
  DONE: order.COMPLETED || [],
});

const hydratePipelineOrderFromApi = (order) => ({
  ...DEFAULT_PIPELINE_ORDER,
  NEW: Array.isArray(order?.NEW) ? order.NEW : [],
  PENDING: Array.isArray(order?.ASSIGNED) ? order.ASSIGNED : [],
  CONFIRMED: Array.isArray(order?.CLIENT) ? order.CLIENT : [],
  COMPLETED: Array.isArray(order?.DONE) ? order.DONE : [],
});

const formatMoney = (value, currency = "UAH") => `${Number(value || 0).toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ${currency}`;

const formatStageTime = (value) => {
  if (!value) return "—";
  const from = new Date(value);
  if (Number.isNaN(from.getTime())) return "—";
  const diffMs = Math.max(Date.now() - from.getTime(), 0);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}д ${hours}г`;
  if (hours > 0) return `${hours}г ${minutes}хв`;
  return `${minutes}хв`;
};

const sortBySavedOrder = (items, orderedIds = []) => {
  const indexMap = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aIndex = indexMap.has(a.id) ? indexMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bIndex = indexMap.has(b.id) ? indexMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
};

const stageLabel = (item) => {
  if (item.status === "COMPLETED") return "Завершено";
  if (item.status === "CONFIRMED") return "Клієнт";
  if (item.assignedManagerId) return "Призначена консультація";
  return "Нова";
};

const buildConfirmationDetails = (item) => [
  `Клієнт: ${item.firstName} ${item.lastName || ""}`.trim(),
  `Email: ${item.email}`,
  `Телефон/Telegram: ${item.phone || "—"}`,
  `Канал: ${contactMethodLabel[item.preferredContactMethod] || "—"}`,
  `Менеджер: ${item.assignedManager?.firstName || item.assignedManager?.email || "—"}`,
  `Підтвердив: ${item.confirmedBy?.firstName || item.confirmedBy?.email || "—"}`,
  `Підтверджено: ${formatDateTime(item.confirmedAt || item.updatedAt)}`,
  `Запис: ${formatDateTime(item.preferredDateTime)}`,
  `Послуга: ${renderServicesForDisplay(item)}`,
  `Статус: ${item.status}`,
].join("\n");

const renderServicesForDisplay = (item) => {
  if (item.selectedServices) {
    try {
      const services = JSON.parse(item.selectedServices);
      if (Array.isArray(services)) {
        return services.map(s => s.name).join(", ") || "Безкоштовна консультація";
      }
    } catch {}
  }
  return item.serviceName || item.service?.name || "Безкоштовна консультація";
};

const parseMoneyFromText = (value) => {
  if (!value) return 0;
  const match = String(value).match(/([\d\s]+)(?:[.,](\d{1,2}))?/);
  if (!match) return 0;
  const whole = Number((match[1] || "0").replace(/\s/g, ""));
  const cents = Number(match[2] || 0);
  if (!Number.isFinite(whole)) return 0;
  return whole + cents / 100;
};

const renderServicePriceForDisplay = (item) => {
  if (item.selectedServices) {
    try {
      const services = JSON.parse(item.selectedServices);
      if (Array.isArray(services) && services.length > 0) {
        const total = services.reduce((sum, s) => sum + parseMoneyFromText(s?.price), 0);
        if (total > 0) {
          return `Сумарно: від ${total.toLocaleString("uk-UA")} ₴`;
        }
      }
    } catch {}
  }

  return item.servicePriceText || item.service?.price || "Без ціни";
};

const getTelegramHref = (item) => {
  const value = String(item.phone || "").trim();
  if (!value) return "";
  if (value.startsWith("@")) {
    return `https://t.me/${value.slice(1)}`;
  }
  return `https://t.me/share/url?text=${encodeURIComponent(buildConfirmationDetails(item))}`;
};

const statusLabelMap = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const getInitials = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CL";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
};

const getConsultationServiceNames = (item) => {
  if (!item) return [];
  if (item.selectedServices) {
    try {
      const services = JSON.parse(item.selectedServices);
      if (Array.isArray(services)) {
        return services.map((s) => String(s?.name || "").trim()).filter(Boolean);
      }
    } catch {
      // noop
    }
  }
  const fallback = item.serviceName || item.service?.name;
  return fallback ? [String(fallback)] : [];
};

const inferClientTags = ({ consultations = [], totalRevenue = 0 }) => {
  const tags = new Set();
  const now = Date.now();
  const first = consultations[consultations.length - 1];

  if (consultations.length > 1) tags.add("Returning Client");
  else tags.add("New Client");

  if (totalRevenue >= 50000) tags.add("VIP");

  const allText = consultations
    .flatMap((item) => [
      ...(getConsultationServiceNames(item) || []),
      item.description || "",
    ])
    .join(" ")
    .toLowerCase();

  if (allText.includes("грант")) tags.add("Grant");
  if (allText.includes("облік") || allText.includes("бух")) tags.add("Accounting");
  if (allText.includes("фоп")) tags.add("FOP");
  if (allText.includes("тов") || allText.includes("llc")) tags.add("LLC");
  if (allText.includes("подат")) tags.add("Taxes");
  if (allText.includes("юрид") || allText.includes("legal")) tags.add("Legal");

  const latest = consultations[0];
  if (latest?.consultationType === "PAID" && latest?.status === "PENDING") tags.add("Priority");

  const firstCreated = first?.createdAt ? new Date(first.createdAt).getTime() : null;
  if (firstCreated && now - firstCreated <= 1000 * 60 * 60 * 24 * 30) {
    tags.add("New Client");
  }

  return Array.from(tags);
};

const clientTagClass = (tag) => {
  const palette = {
    VIP: "bg-amber-100 text-amber-800 border-amber-200",
    Grant: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Accounting: "bg-sky-100 text-sky-800 border-sky-200",
    FOP: "bg-indigo-100 text-indigo-800 border-indigo-200",
    LLC: "bg-violet-100 text-violet-800 border-violet-200",
    Taxes: "bg-rose-100 text-rose-800 border-rose-200",
    Legal: "bg-slate-100 text-slate-800 border-slate-200",
    Priority: "bg-red-100 text-red-800 border-red-200",
    "New Client": "bg-lime-100 text-lime-800 border-lime-200",
    "Returning Client": "bg-cyan-100 text-cyan-800 border-cyan-200",
  };
  return palette[tag] || "bg-muted text-foreground border-border";
};

function StatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-heading">{value}</p>
          {subtitle ? <p className="text-xs text-muted-foreground mt-2">{subtitle}</p> : null}
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function PremiumKpiCard({ title, value, icon: Icon, percentage, trend, todayValue, monthlyComparison }) {
  const trendUp = trend >= 0;
  const trendLabel = `${trendUp ? "+" : ""}${Number(trend || 0).toFixed(1)}%`;

  return (
    <Card className="border-border/70 bg-white/90 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-2">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {trendUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trendLabel}
          </div>
          <span className="text-muted-foreground">Частка: {percentage}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="rounded-lg border border-border/70 px-2 py-2 bg-muted/20">
            <p className="text-muted-foreground">Сьогодні</p>
            <p className="font-medium mt-1">{todayValue}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 bg-muted/20">
            <p className="text-muted-foreground">Місяць</p>
            <p className="font-medium mt-1">{monthlyComparison}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filters, setFilters] = useState({ consultationType: "", status: "", confirmationType: "", search: "" });
  const [workerForm, setWorkerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "MANAGER",
    password: "",
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState("DAY");
  const [calendarDrafts, setCalendarDrafts] = useState({});
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    managerId: "",
    consultationId: "",
    dueDate: "",
    priority: "MEDIUM",
    status: "TODO",
  });
  const [blogForm, setBlogForm] = useState({
    title: "",
    slug: "",
    category: "",
    tags: "",
    excerpt: "",
    content: "",
    status: "DRAFT",
    coverImage: "",
  });
  const [noteDrafts, setNoteDrafts] = useState({});
  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [pipelineManagerFilter, setPipelineManagerFilter] = useState("all");
  const [pipelineDateFrom, setPipelineDateFrom] = useState("");
  const [pipelineDateTo, setPipelineDateTo] = useState("");
  const [pipelineServiceFilter, setPipelineServiceFilter] = useState("all");
  const [pipelineOrder, setPipelineOrder] = useState(DEFAULT_PIPELINE_ORDER);
  const [isPipelineOrderInitialized, setIsPipelineOrderInitialized] = useState(false);

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiClient.admin.stats(),
  });

  const consultationsQuery = useQuery({
    queryKey: ["admin-consultations", filters],
    queryFn: () =>
      apiClient.admin.consultations.list({
        consultationType: filters.consultationType,
        status: filters.status,
        confirmationType: filters.confirmationType,
        search: filters.search,
      }),
  });

  const consultationsFeedQuery = useQuery({
    queryKey: ["admin-consultations-feed"],
    queryFn: () => apiClient.admin.consultations.list({}),
  });

  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => apiClient.admin.notifications(),
  });

  const workersQuery = useQuery({
    queryKey: ["admin-workers"],
    queryFn: () => apiClient.admin.workers.list(),
  });

  const tasksQuery = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: () => apiClient.admin.tasks.list(),
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => apiClient.admin.auditLogs(),
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => apiClient.admin.reviews.list(),
  });

  const blogPostsQuery = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => apiClient.admin.blog.list(),
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => apiClient.admin.payments.list(),
  });

  const paymentAnalyticsQuery = useQuery({
    queryKey: ["admin-payments-analytics"],
    queryFn: () => apiClient.admin.payments.analytics(),
  });

  const pipelinePreferencesQuery = useQuery({
    queryKey: ["admin-pipeline-preferences"],
    queryFn: () => apiClient.admin.pipeline.getPreferences(),
  });

  const reviewPatchMutation = useMutation({
    mutationFn: ({ id, isApproved }) => apiClient.admin.reviews.patch(id, { isApproved }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const reviewDeleteMutation = useMutation({
    mutationFn: (id) => apiClient.admin.reviews.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const createWorkerMutation = useMutation({
    mutationFn: (payload) => apiClient.admin.workers.create(payload),
    onSuccess: async () => {
      setWorkerForm({ firstName: "", lastName: "", email: "", phone: "", role: "MANAGER", password: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-workers"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      ]);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload) => apiClient.admin.tasks.create(payload),
    onSuccess: async () => {
      setTaskForm((prev) => ({ ...prev, title: "", description: "", consultationId: "", dueDate: "", priority: "MEDIUM", status: "TODO" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-workers"] }),
      ]);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.admin.tasks.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.admin.consultations.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-consultations-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
      ]);
    },
  });

  const createBlogPostMutation = useMutation({
    mutationFn: (payload) => apiClient.admin.blog.create(payload),
    onSuccess: async () => {
      setBlogForm({
        title: "",
        slug: "",
        category: "",
        tags: "",
        excerpt: "",
        content: "",
        status: "DRAFT",
        coverImage: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
    onError: (error) => {
      const details = typeof error?.body === "string" ? error.body : "";
      alert(`Не вдалося додати публікацію. ${details || "Перевірте поля форми."}`);
    },
  });

  const updateBlogPostMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.admin.blog.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
  });

  const removeBlogPostMutation = useMutation({
    mutationFn: (id) => apiClient.admin.blog.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (consultationId) => apiClient.admin.payments.markPaid(consultationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-payments-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-consultations-feed"] }),
      ]);
    },
    onError: (error) => {
      const details = typeof error?.body === "string" ? error.body : "";
      alert(`Не вдалося позначити оплату. ${details || "Спробуйте ще раз."}`);
    },
  });

  const savePipelinePreferencesMutation = useMutation({
    mutationFn: (order) => apiClient.admin.pipeline.savePreferences(order),
    onError: () => {
      alert("Не вдалося зберегти порядок воронки.");
    },
  });

  const stats = statsQuery.data || {};
  const consultations = consultationsQuery.data || [];
  const consultationsFeed = consultationsFeedQuery.data || [];
  const notifications = notificationsQuery.data || [];
  const auditLogs = auditLogsQuery.data || [];
  const reviews = reviewsQuery.data || [];
  const workers = workersQuery.data || [];
  const tasks = tasksQuery.data || [];
  const blogPosts = blogPostsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const paymentAnalytics = paymentAnalyticsQuery.data || { overall: { averageCheck: 0, totalPaid: 0, paidOrdersCount: 0, paidClientsCount: 0 }, perClient: [] };
  const analytics = stats.analytics || {};

  useEffect(() => {
    if (isPipelineOrderInitialized) return;
    const serverOrder = pipelinePreferencesQuery.data?.order;
    if (!serverOrder) return;
    setPipelineOrder(hydratePipelineOrderFromApi(serverOrder));
    setIsPipelineOrderInitialized(true);
  }, [pipelinePreferencesQuery.data, isPipelineOrderInitialized]);

  const confirmedConsultations = useMemo(
    () => consultationsFeed.filter((item) => item.status === "CONFIRMED"),
    [consultationsFeed]
  );

  const latestBookings = useMemo(() => {
    return [...consultationsFeed]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
  }, [consultationsFeed]);

  const completedConsultations = useMemo(() => {
    return [...consultationsFeed]
      .filter((item) => item.status === "COMPLETED")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }, [consultationsFeed]);

  const activeConsultations = useMemo(() => {
    return consultations.filter((item) => item.status !== "COMPLETED");
  }, [consultations]);

  const clientCards = useMemo(() => {
    const map = new Map();
    for (const item of consultationsFeed) {
      const key = (item.email || `${item.firstName}_${item.lastName || ""}`).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          email: item.email,
          fullName: `${item.firstName} ${item.lastName || ""}`.trim(),
          phone: item.phone || "—",
          preferredContactMethod: item.preferredContactMethod,
          consultations: [],
        });
      }
      map.get(key).consultations.push(item);
    }
    return Array.from(map.values())
      .map((card) => ({
        ...card,
        consultations: [...card.consultations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      }))
      .sort((a, b) => new Date(b.consultations[0]?.createdAt || 0) - new Date(a.consultations[0]?.createdAt || 0));
  }, [consultationsFeed]);

  const selectedClient = useMemo(() => {
    if (!clientCards.length) return null;
    return clientCards.find((c) => c.key === selectedClientKey) || clientCards[0];
  }, [clientCards, selectedClientKey]);

  const averageCheckByEmail = useMemo(() => {
    const map = new Map();
    for (const item of paymentAnalytics.perClient || []) {
      map.set(String(item.email || "").toLowerCase(), Number(item.averageCheck || 0));
    }
    return map;
  }, [paymentAnalytics.perClient]);

  const tasksByConsultationId = useMemo(() => {
    const map = new Map();
    for (const task of tasks || []) {
      if (!task?.consultationId) continue;
      if (!map.has(task.consultationId)) map.set(task.consultationId, []);
      map.get(task.consultationId).push(task);
    }
    return map;
  }, [tasks]);

  const selectedClientProfile = useMemo(() => {
    if (!selectedClient) return null;

    const consultations = selectedClient.consultations || [];
    const consultationIds = new Set(consultations.map((c) => c.id));
    const relatedPayments = (payments || []).filter((payment) => consultationIds.has(payment.consultationId));
    const relatedTasks = consultations.flatMap((c) => tasksByConsultationId.get(c.id) || []);
    const paidPayments = relatedPayments.filter((payment) => payment.paymentStatus === "PAID");
    const totalRevenue = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const latest = consultations[0] || null;
    const first = consultations[consultations.length - 1] || null;
    const lastActivityDate = latest?.updatedAt || latest?.createdAt || first?.createdAt || null;
    const openTasks = relatedTasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;

    const timeline = [];
    if (first) {
      timeline.push({
        id: `created-${first.id}`,
        date: first.createdAt,
        title: "Client created",
        description: `Перший запис: ${formatDateTime(first.createdAt)}`,
      });
    }

    consultations.forEach((c) => {
      timeline.push({
        id: `consultation-${c.id}`,
        date: c.preferredDateTime || c.createdAt,
        title: "Consultation",
        description: `${renderServicesForDisplay(c)} · ${statusLabelMap[c.status] || c.status}`,
      });

      if (c.assignedManagerId) {
        timeline.push({
          id: `assigned-${c.id}`,
          date: c.updatedAt || c.createdAt,
          title: "Manager assigned",
          description: c.assignedManager?.firstName || c.assignedManager?.email || "Manager assigned",
        });
      }

      if (c.status === "CONFIRMED") {
        timeline.push({
          id: `confirmed-${c.id}`,
          date: c.confirmedAt || c.updatedAt || c.createdAt,
          title: "Confirmed",
          description: "Консультацію підтверджено",
        });
      }

      if (c.status === "COMPLETED") {
        timeline.push({
          id: `completed-${c.id}`,
          date: c.updatedAt || c.createdAt,
          title: "Completed",
          description: "Консультацію завершено",
        });
      }
    });

    relatedPayments.forEach((payment) => {
      timeline.push({
        id: `payment-${payment.consultationId}`,
        date: payment.paidAt || payment.updatedAt || payment.createdAt || latest?.updatedAt || latest?.createdAt,
        title: payment.paymentStatus === "PAID" ? "Payment" : "Payment status",
        description: `${payment.paymentStatus} · ${formatMoney(payment.amount || 0, payment.currency || "UAH")}`,
      });
    });

    relatedTasks.forEach((task) => {
      timeline.push({
        id: `task-${task.id}`,
        date: task.updatedAt || task.createdAt,
        title: "Task updated",
        description: `${task.title} · ${task.status}`,
      });
    });

    timeline.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const clientScore = Math.min(
      100,
      30
      + consultations.length * 8
      + paidPayments.length * 15
      + (latest?.status === "COMPLETED" ? 10 : 0)
      + (latest?.assignedManagerId ? 10 : 0)
    );

    return {
      ...selectedClient,
      latest,
      first,
      relatedPayments,
      relatedTasks,
      timeline,
      totalRevenue,
      ltv: totalRevenue,
      clientScore,
      openTasks,
      lastActivityDate,
      tags: inferClientTags({ consultations, totalRevenue }),
      status: latest?.status || "PENDING",
      managerName: latest?.assignedManager?.firstName || latest?.assignedManager?.email || "—",
    };
  }, [selectedClient, payments, tasksByConsultationId]);

  const pipelineServiceOptions = useMemo(() => {
    const map = new Map();
    consultationsFeed
      .filter((item) => item.consultationType === "PAID")
      .forEach((item) => {
        if (item.serviceId) {
          const label = item.serviceName || item.service?.name || "Платна консультація";
          map.set(`id:${item.serviceId}`, label);
          return;
        }
        const name = item.serviceName || item.service?.name;
        if (name) {
          map.set(`name:${name}`, name);
        }
      });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "uk"));
  }, [consultationsFeed]);

  const pipelineConsultations = useMemo(() => {
    return consultationsFeed.filter((item) => {
      if (pipelineManagerFilter === "unassigned" && item.assignedManagerId) return false;
      if (pipelineManagerFilter !== "all" && pipelineManagerFilter !== "unassigned" && item.assignedManagerId !== pipelineManagerFilter) return false;

      if (pipelineServiceFilter === "free" && item.consultationType !== "FREE") return false;
      if (pipelineServiceFilter.startsWith("id:") && item.serviceId !== pipelineServiceFilter.slice(3)) return false;
      if (pipelineServiceFilter.startsWith("name:")) {
        const serviceName = item.serviceName || item.service?.name || "";
        if (serviceName !== pipelineServiceFilter.slice(5)) return false;
      }

      const rawDate = item.preferredDateTime || item.createdAt;
      if ((pipelineDateFrom || pipelineDateTo) && !rawDate) return false;

      if (pipelineDateFrom) {
        const from = new Date(`${pipelineDateFrom}T00:00:00`);
        if (new Date(rawDate) < from) return false;
      }
      if (pipelineDateTo) {
        const to = new Date(`${pipelineDateTo}T23:59:59.999`);
        if (new Date(rawDate) > to) return false;
      }

      return true;
    });
  }, [consultationsFeed, pipelineManagerFilter, pipelineServiceFilter, pipelineDateFrom, pipelineDateTo]);

  const getPipelineStageForItem = (item) => {
    const payment = payments.find((p) => p.consultationId === item.id);
    const hasPaid = payment?.paymentStatus === "PAID";
    const linkedTasks = tasksByConsultationId.get(item.id) || [];
    const hasInProgressTask = linkedTasks.some((task) => task.status === "IN_PROGRESS" || task.status === "TODO");
    const lowerDescription = String(item.description || "").toLowerCase();
    const hasLostSignal = lowerDescription.includes("lost") || lowerDescription.includes("втрачен") || lowerDescription.includes("відмов");

    if (item.status === "COMPLETED") return "COMPLETED";
    if (item.status === "CANCELLED") return hasLostSignal ? "LOST" : "CANCELLED";

    if (item.status === "CONFIRMED") {
      if (hasInProgressTask) return "IN_PROGRESS";
      if (hasPaid) return "PAID";
      return "CONFIRMED";
    }

    if (!item.assignedManagerId) return "NEW";
    return "PENDING";
  };

  const funnelColumns = useMemo(() => {
    const all = pipelineConsultations;
    const stageBuckets = Object.fromEntries(PIPELINE_KEYS.map((key) => [key, []]));

    all.forEach((item) => {
      const stage = getPipelineStageForItem(item);
      if (!stageBuckets[stage]) stageBuckets[stage] = [];
      stageBuckets[stage].push(item);
    });

    return Object.fromEntries(
      PIPELINE_KEYS.map((key) => [key, sortBySavedOrder(stageBuckets[key] || [], pipelineOrder[key] || [])])
    );
  }, [pipelineConsultations, pipelineOrder, payments, tasksByConsultationId]);

  const pipelineConversions = useMemo(() => {
    const newCount = funnelColumns.NEW.length;
    const pendingCount = funnelColumns.PENDING.length;
    const confirmedCount = funnelColumns.CONFIRMED.length;
    const paidCount = funnelColumns.PAID.length;
    const inProgressCount = funnelColumns.IN_PROGRESS.length;
    const doneCount = funnelColumns.COMPLETED.length;
    const cancelledCount = funnelColumns.CANCELLED.length;
    const lostCount = funnelColumns.LOST.length;

    const ratio = (next, prev) => (prev ? `${Math.round((next / prev) * 100)}%` : "0%");

    return {
      newCount,
      pendingCount,
      confirmedCount,
      paidCount,
      inProgressCount,
      doneCount,
      cancelledCount,
      lostCount,
      newToPending: ratio(pendingCount, newCount),
      pendingToConfirmed: ratio(confirmedCount + paidCount + inProgressCount, pendingCount),
      confirmedToPaid: ratio(paidCount, confirmedCount || 1),
      activeToDone: ratio(doneCount, confirmedCount + paidCount + inProgressCount),
    };
  }, [funnelColumns]);

  useEffect(() => {
    const allIds = new Set(consultationsFeed.map((item) => item.id));
    const nextOrder = Object.fromEntries(
      PIPELINE_KEYS.map((key) => [key, (pipelineOrder[key] || []).filter((id) => allIds.has(id))])
    );

    let changed = false;
    PIPELINE_KEYS.forEach((key) => {
      const ids = funnelColumns[key].map((item) => item.id);
      ids.forEach((id) => {
        if (!nextOrder[key].includes(id)) {
          nextOrder[key].push(id);
          changed = true;
        }
      });
    });

    if (!changed) {
      changed = PIPELINE_KEYS.some(
        (key) => (nextOrder[key] || []).length !== (pipelineOrder[key] || []).length
      );
    }

    if (changed) {
      setPipelineOrder(nextOrder);
      if (isPipelineOrderInitialized) {
        savePipelinePreferencesMutation.mutate(serializePipelineOrderForApi(nextOrder));
      }
    }
  }, [consultationsFeed, funnelColumns, pipelineOrder, isPipelineOrderInitialized]);

  const bookingsVsVisits7d = analytics.bookingsVsVisits7d || [];
  const popularServices = analytics.popularServices || [];
  const consultationTypeShare = (analytics.consultationTypeShare || [
    { name: "FREE", value: stats.freeCount || 0 },
    { name: "PAID", value: stats.paidCount || 0 },
  ]).map((item, index) => ({
    ...item,
    fill: index % 2 === 0 ? "var(--color-free)" : "var(--color-paid)",
  }));

  const dashboardKpis = useMemo(() => {
    const items = consultationsFeed || [];
    const total = items.length;
    const today = new Date();

    const atDate = (value) => {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const startToday = startOfDay(today);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const weekStart = new Date(startToday);
    weekStart.setDate(weekStart.getDate() - 6);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const inRange = (value, start, end) => value && value >= start && value < end;
    const pctDiff = (current, previous) => {
      if (!previous) return current ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    const percentOf = (part, whole) => `${whole ? Math.round((part / whole) * 100) : 0}%`;

    const parseConsultationAmount = (item) => {
      if (item?.selectedServices) {
        try {
          const services = JSON.parse(item.selectedServices);
          if (Array.isArray(services)) {
            return services.reduce((sum, service) => sum + parseMoneyFromText(service?.price), 0);
          }
        } catch {
          // ignore parse issues
        }
      }
      return parseMoneyFromText(item?.servicePriceText || item?.service?.price || "");
    };

    const paidItems = items.filter((item) => item.consultationType === "PAID");
    const pendingItems = items.filter((item) => item.status === "PENDING");
    const upcomingItems = items.filter((item) => {
      const d = atDate(item.preferredDateTime || item.scheduledAt);
      if (!d) return false;
      return d >= startToday && ["PENDING", "CONFIRMED"].includes(item.status);
    });

    const monthlyRevenue = items
      .filter((item) => inRange(atDate(item.createdAt), monthStart, nextMonthStart) && item.consultationType === "PAID")
      .reduce((sum, item) => sum + parseConsultationAmount(item), 0);

    const prevMonthlyRevenue = items
      .filter((item) => inRange(atDate(item.createdAt), prevMonthStart, monthStart) && item.consultationType === "PAID")
      .reduce((sum, item) => sum + parseConsultationAmount(item), 0);

    const weeklyRevenue = items
      .filter((item) => inRange(atDate(item.createdAt), weekStart, startTomorrow) && item.consultationType === "PAID")
      .reduce((sum, item) => sum + parseConsultationAmount(item), 0);

    const prevWeeklyRevenue = items
      .filter((item) => inRange(atDate(item.createdAt), prevWeekStart, weekStart) && item.consultationType === "PAID")
      .reduce((sum, item) => sum + parseConsultationAmount(item), 0);

    const currentMonthItems = items.filter((item) => inRange(atDate(item.createdAt), monthStart, nextMonthStart));
    const prevMonthItems = items.filter((item) => inRange(atDate(item.createdAt), prevMonthStart, monthStart));
    const currentMonthPaid = currentMonthItems.filter((item) => item.consultationType === "PAID").length;
    const prevMonthPaid = prevMonthItems.filter((item) => item.consultationType === "PAID").length;

    const conversionRate = total ? (paidItems.length / total) * 100 : 0;
    const prevConversionRate = prevMonthItems.length ? (prevMonthPaid / prevMonthItems.length) * 100 : 0;

    const averageCheck = Number(paymentAnalytics.overall?.averageCheck || 0);
    const prevAverageCheck = prevMonthPaid ? prevMonthlyRevenue / prevMonthPaid : 0;

    const recentWindowStart = new Date(startToday);
    recentWindowStart.setDate(recentWindowStart.getDate() - 29);
    const activeClients = new Set(
      items
        .filter((item) => inRange(atDate(item.createdAt), recentWindowStart, startTomorrow))
        .map((item) => String(item.email || `${item.firstName}_${item.lastName || ""}`).toLowerCase())
    ).size;

    const firstSeen = new Map();
    items.forEach((item) => {
      const key = String(item.email || `${item.firstName}_${item.lastName || ""}`).toLowerCase();
      const created = atDate(item.createdAt);
      if (!created) return;
      if (!firstSeen.has(key) || created < firstSeen.get(key)) {
        firstSeen.set(key, created);
      }
    });
    const newClients = Array.from(firstSeen.values()).filter((d) => inRange(d, monthStart, nextMonthStart)).length;
    const prevNewClients = Array.from(firstSeen.values()).filter((d) => inRange(d, prevMonthStart, monthStart)).length;

    const todayCount = items.filter((item) => inRange(atDate(item.createdAt), startToday, startTomorrow)).length;
    const todayPaid = paidItems.filter((item) => inRange(atDate(item.createdAt), startToday, startTomorrow)).length;
    const todayPending = pendingItems.filter((item) => inRange(atDate(item.createdAt), startToday, startTomorrow)).length;
    const todayUpcoming = upcomingItems.filter((item) => {
      const d = atDate(item.preferredDateTime || item.scheduledAt);
      return inRange(d, startToday, startTomorrow);
    }).length;

    return [
      { title: "Total consultations", value: total, icon: Users, percentage: percentOf(total, total), trend: pctDiff(currentMonthItems.length, prevMonthItems.length), todayValue: todayCount, monthlyComparison: `${currentMonthItems.length} / ${prevMonthItems.length}` },
      { title: "Paid consultations", value: paidItems.length, icon: Shield, percentage: percentOf(paidItems.length, total), trend: pctDiff(currentMonthPaid, prevMonthPaid), todayValue: todayPaid, monthlyComparison: `${currentMonthPaid} / ${prevMonthPaid}` },
      { title: "Pending consultations", value: pendingItems.length, icon: Clock3, percentage: percentOf(pendingItems.length, total), trend: pctDiff(currentMonthItems.filter((i) => i.status === "PENDING").length, prevMonthItems.filter((i) => i.status === "PENDING").length), todayValue: todayPending, monthlyComparison: `${currentMonthItems.filter((i) => i.status === "PENDING").length} / ${prevMonthItems.filter((i) => i.status === "PENDING").length}` },
      { title: "Upcoming consultations", value: upcomingItems.length, icon: CalendarRange, percentage: percentOf(upcomingItems.length, total), trend: pctDiff(currentMonthItems.filter((i) => ["PENDING", "CONFIRMED"].includes(i.status)).length, prevMonthItems.filter((i) => ["PENDING", "CONFIRMED"].includes(i.status)).length), todayValue: todayUpcoming, monthlyComparison: `${currentMonthItems.filter((i) => ["PENDING", "CONFIRMED"].includes(i.status)).length} / ${prevMonthItems.filter((i) => ["PENDING", "CONFIRMED"].includes(i.status)).length}` },
      { title: "Monthly revenue", value: formatMoney(monthlyRevenue), icon: DollarSign, percentage: percentOf(monthlyRevenue, Math.max(monthlyRevenue + prevMonthlyRevenue, 1)), trend: pctDiff(monthlyRevenue, prevMonthlyRevenue), todayValue: formatMoney(items.filter((i) => inRange(atDate(i.createdAt), startToday, startTomorrow) && i.consultationType === "PAID").reduce((sum, i) => sum + parseConsultationAmount(i), 0)), monthlyComparison: `${formatMoney(monthlyRevenue)} / ${formatMoney(prevMonthlyRevenue)}` },
      { title: "Weekly revenue", value: formatMoney(weeklyRevenue), icon: Wallet, percentage: percentOf(weeklyRevenue, Math.max(weeklyRevenue + prevWeeklyRevenue, 1)), trend: pctDiff(weeklyRevenue, prevWeeklyRevenue), todayValue: formatMoney(items.filter((i) => inRange(atDate(i.createdAt), startToday, startTomorrow) && i.consultationType === "PAID").reduce((sum, i) => sum + parseConsultationAmount(i), 0)), monthlyComparison: `${formatMoney(weeklyRevenue)} / ${formatMoney(prevWeeklyRevenue)}` },
      { title: "Conversion rate", value: `${conversionRate.toFixed(1)}%`, icon: Target, percentage: percentOf(paidItems.length, total), trend: pctDiff(conversionRate, prevConversionRate), todayValue: `${todayCount ? ((todayPaid / todayCount) * 100).toFixed(1) : 0}%`, monthlyComparison: `${conversionRate.toFixed(1)}% / ${prevConversionRate.toFixed(1)}%` },
      { title: "Average check", value: formatMoney(averageCheck), icon: TrendingUp, percentage: percentOf(averageCheck, Math.max(averageCheck + prevAverageCheck, 1)), trend: pctDiff(averageCheck, prevAverageCheck), todayValue: formatMoney(todayPaid ? items.filter((i) => inRange(atDate(i.createdAt), startToday, startTomorrow) && i.consultationType === "PAID").reduce((sum, i) => sum + parseConsultationAmount(i), 0) / todayPaid : 0), monthlyComparison: `${formatMoney(averageCheck)} / ${formatMoney(prevAverageCheck)}` },
      { title: "Active clients", value: activeClients, icon: UserCheck, percentage: percentOf(activeClients, Math.max(clientCards.length, 1)), trend: pctDiff(activeClients, Math.max(activeClients - 1, 0)), todayValue: new Set(items.filter((i) => inRange(atDate(i.createdAt), startToday, startTomorrow)).map((i) => String(i.email || `${i.firstName}_${i.lastName || ""}`).toLowerCase())).size, monthlyComparison: `${activeClients} / ${Math.max(activeClients - 1, 0)}` },
      { title: "New clients", value: newClients, icon: UserPlus, percentage: percentOf(newClients, Math.max(clientCards.length, 1)), trend: pctDiff(newClients, prevNewClients), todayValue: Array.from(firstSeen.values()).filter((d) => inRange(d, startToday, startTomorrow)).length, monthlyComparison: `${newClients} / ${prevNewClients}` },
    ];
  }, [consultationsFeed, paymentAnalytics.overall, clientCards.length]);

  const dashboardCharts = useMemo(() => {
    const items = consultationsFeed || [];
    const now = new Date();
    const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

    const parseConsultationAmount = (item) => {
      if (item?.selectedServices) {
        try {
          const services = JSON.parse(item.selectedServices);
          if (Array.isArray(services)) return services.reduce((sum, service) => sum + parseMoneyFromText(service?.price), 0);
        } catch {
          // noop
        }
      }
      return parseMoneyFromText(item?.servicePriceText || item?.service?.price || "");
    };

    const consultationsByDayMap = new Map();
    const revenueByDayMap = new Map();
    const clientActivityMap = new Map();

    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      consultationsByDayMap.set(key, 0);
      revenueByDayMap.set(key, 0);
      clientActivityMap.set(key, new Set());
    }

    items.forEach((item) => {
      const key = dayKey(item.createdAt);
      if (!consultationsByDayMap.has(key)) return;
      consultationsByDayMap.set(key, (consultationsByDayMap.get(key) || 0) + 1);
      if (item.consultationType === "PAID") {
        revenueByDayMap.set(key, (revenueByDayMap.get(key) || 0) + parseConsultationAmount(item));
      }
      clientActivityMap.get(key).add(String(item.email || `${item.firstName}_${item.lastName || ""}`).toLowerCase());
    });

    const consultationsByDay = Array.from(consultationsByDayMap.entries()).map(([day, value]) => ({ day: day.slice(5), value }));
    const revenueByDay = Array.from(revenueByDayMap.entries()).map(([day, value]) => ({ day: day.slice(5), value: Math.round(value) }));
    const clientActivity = Array.from(clientActivityMap.entries()).map(([day, set]) => ({ day: day.slice(5), active: set.size }));

    const managerPerformance = Object.values(
      items.reduce((acc, item) => {
        const key = item.assignedManager?.email || item.assignedManagerId || "unassigned";
        if (!acc[key]) {
          acc[key] = { name: item.assignedManager?.firstName || item.assignedManager?.email || "Без менеджера", total: 0, completed: 0 };
        }
        acc[key].total += 1;
        if (item.status === "COMPLETED") acc[key].completed += 1;
        return acc;
      }, {})
    ).slice(0, 8);

    const monthlyGrowthMap = new Map();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyGrowthMap.set(key, { month: key.slice(2), consultations: 0, revenue: 0 });
    }

    items.forEach((item) => {
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyGrowthMap.has(key)) return;
      const row = monthlyGrowthMap.get(key);
      row.consultations += 1;
      if (item.consultationType === "PAID") row.revenue += parseConsultationAmount(item);
    });

    const paymentStatus = Object.values(
      (payments || []).reduce((acc, item) => {
        const key = item.paymentStatus || "PENDING";
        if (!acc[key]) acc[key] = { name: key, value: 0 };
        acc[key].value += 1;
        return acc;
      }, {})
    );

    return {
      consultationsByDay,
      revenueByDay,
      clientActivity,
      managerPerformance,
      monthlyGrowth: Array.from(monthlyGrowthMap.values()),
      paymentStatus,
    };
  }, [consultationsFeed, payments]);

  const selectedDateKey = selectedCalendarDate?.toISOString?.().slice(0, 10) || "";

  const calendarEvents = useMemo(() => {
    return consultations
      .map((item) => {
        const startValue = item.scheduledAt || item.preferredDateTime;
        if (!startValue) return null;
        const start = new Date(startValue);
        if (Number.isNaN(start.getTime())) return null;
        const durationMinutes = Number(item.estimatedDuration || 45);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        return {
          ...item,
          start,
          end,
          dateKey: start.toISOString().slice(0, 10),
          durationMinutes,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
  }, [consultations]);

  const calendarItems = useMemo(() => {
    return calendarEvents.filter((item) => item.dateKey === selectedDateKey);
  }, [calendarEvents, selectedDateKey]);

  const weekDays = useMemo(() => {
    const selected = new Date(selectedCalendarDate);
    const day = selected.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [selectedCalendarDate]);

  const weekEventsMap = useMemo(() => {
    const map = new Map();
    weekDays.forEach((day) => map.set(day.toISOString().slice(0, 10), []));
    calendarEvents.forEach((event) => {
      if (map.has(event.dateKey)) {
        map.get(event.dateKey).push(event);
      }
    });
    return map;
  }, [weekDays, calendarEvents]);

  const monthGridDays = useMemo(() => {
    const selected = new Date(selectedCalendarDate);
    const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
    const firstDay = monthStart.getDay();
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(monthStart.getDate() - (firstDay === 0 ? 6 : firstDay - 1));

    const totalCells = 42;
    return Array.from({ length: totalCells }).map((_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        date,
        key,
        inCurrentMonth: date >= monthStart && date <= monthEnd,
        events: calendarEvents.filter((event) => event.dateKey === key),
      };
    });
  }, [selectedCalendarDate, calendarEvents]);

  const agendaItems = useMemo(() => {
    const start = new Date(selectedCalendarDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    return calendarEvents.filter((item) => item.start >= start && item.start < end);
  }, [calendarEvents, selectedCalendarDate]);

  const ensureCalendarDraft = (event) => {
    const existing = calendarDrafts[event.id];
    if (existing) return existing;

    const date = event.start.toISOString().slice(0, 10);
    const time = event.start.toTimeString().slice(0, 5);
    return {
      date,
      time,
      durationMinutes: event.durationMinutes || 45,
      recurringWeekly: false,
      recurringCount: 1,
    };
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-consultations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-consultations-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-consultations-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-workers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-payments-analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-pipeline-preferences"] }),
    ]);
  };

  const updateStatus = (id, status) => updateMutation.mutate({ id, payload: { status } });
  const confirmConsultation = (item) => {
    if (!item.assignedManagerId) return;
    updateMutation.mutate({ id: item.id, payload: { status: "CONFIRMED" } });
  };
  const assignManager = (consultationId, managerId) => {
    updateMutation.mutate({ id: consultationId, payload: { assignedManagerId: managerId || null } });
  };

  const copyConsultationDetails = async (item) => {
    try {
      await navigator.clipboard.writeText(buildConfirmationDetails(item));
    } catch {
      alert("Не вдалося скопіювати дані.");
    }
  };

  const saveInternalNote = (item) => {
    const value = Object.prototype.hasOwnProperty.call(noteDrafts, item.id)
      ? noteDrafts[item.id]
      : item.internalNotes;
    updateMutation.mutate({ id: item.id, payload: { internalNotes: value ?? null } });
  };

  const moveConsultationToStage = (item, stageKey) => {
    if (stageKey === "NEW") {
      updateMutation.mutate({ id: item.id, payload: { status: "PENDING", assignedManagerId: null } });
      return;
    }
    if (stageKey === "PENDING") {
      if (!item.assignedManagerId) {
        alert("Спочатку призначте менеджера у вкладці консультацій.");
        return;
      }
      updateMutation.mutate({ id: item.id, payload: { status: "PENDING" } });
      return;
    }
    if (stageKey === "CONFIRMED" || stageKey === "IN_PROGRESS") {
      if (!item.assignedManagerId) {
        alert("Не можна підтвердити без менеджера.");
        return;
      }
      updateMutation.mutate({ id: item.id, payload: { status: "CONFIRMED" } });
      return;
    }
    if (stageKey === "PAID") {
      if (!item.assignedManagerId) {
        alert("Не можна позначити оплату без менеджера.");
        return;
      }
      updateMutation.mutate({ id: item.id, payload: { status: "CONFIRMED" } });
      markPaidMutation.mutate(item.id);
      return;
    }
    if (stageKey === "COMPLETED") {
      updateMutation.mutate({ id: item.id, payload: { status: "COMPLETED" } });
      return;
    }
    if (stageKey === "CANCELLED" || stageKey === "LOST") {
      updateMutation.mutate({ id: item.id, payload: { status: "CANCELLED" } });
    }
  };

  const onPipelineDragEnd = (result) => {
    if (!result.destination) return;
    const sourceKey = result.source.droppableId;
    const destKey = result.destination.droppableId;
    if (!destKey) return;

    const sourceItems = [...(funnelColumns[sourceKey] || [])];
    if (!sourceItems.length) return;

    if (sourceKey === destKey) {
      const [movedItem] = sourceItems.splice(result.source.index, 1);
      if (!movedItem) return;
      sourceItems.splice(result.destination.index, 0, movedItem);
      const nextOrder = {
        ...pipelineOrder,
        [sourceKey]: sourceItems.map((entry) => entry.id),
      };
      setPipelineOrder(nextOrder);
      if (isPipelineOrderInitialized) {
        savePipelinePreferencesMutation.mutate(serializePipelineOrderForApi(nextOrder));
      }
      return;
    }

    const item = sourceItems[result.source.index];
    if (!item) return;

    const nextSourceItems = sourceItems.filter((_, index) => index !== result.source.index);
    const destinationItems = [...(funnelColumns[destKey] || [])];
    destinationItems.splice(result.destination.index, 0, item);

    const nextOrder = {
      ...pipelineOrder,
      [sourceKey]: nextSourceItems.map((entry) => entry.id),
      [destKey]: destinationItems.map((entry) => entry.id),
    };
    setPipelineOrder(nextOrder);
    if (isPipelineOrderInitialized) {
      savePipelinePreferencesMutation.mutate(serializePipelineOrderForApi(nextOrder));
    }

    moveConsultationToStage(item, destKey);
  };

  const stageTimerLabel = (item) => {
    const base = item.pipelineStageEnteredAt || item.confirmedAt || item.updatedAt || item.createdAt;
    return formatStageTime(base);
  };

  const goToToday = () => setSelectedCalendarDate(new Date());

  const shiftCalendar = (step) => {
    setSelectedCalendarDate((prev) => {
      const next = new Date(prev);
      if (calendarView === "MONTH") {
        next.setMonth(next.getMonth() + step);
      } else {
        next.setDate(next.getDate() + (calendarView === "WEEK" ? step * 7 : step));
      }
      return next;
    });
  };

  const upsertCalendarDraft = (event, patch) => {
    setCalendarDrafts((prev) => {
      const base = prev[event.id] || ensureCalendarDraft(event);
      return {
        ...prev,
        [event.id]: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const applyCalendarDraft = (event) => {
    const draft = calendarDrafts[event.id] || ensureCalendarDraft(event);
    const date = draft.date || event.start.toISOString().slice(0, 10);
    const time = draft.time || event.start.toTimeString().slice(0, 5);
    const scheduledAt = `${date}T${time}:00`;
    const estimatedDuration = Number(draft.durationMinutes || event.durationMinutes || 45);

    updateMutation.mutate({
      id: event.id,
      payload: {
        scheduledAt,
        estimatedDuration,
      },
    });
  };

  const onCalendarDragEnd = (result) => {
    if (!result.destination) return;
    const draggableId = result.draggableId || "";
    if (!draggableId.startsWith("cal-")) return;

    const consultationId = draggableId.replace("cal-", "");
    const event = calendarEvents.find((entry) => entry.id === consultationId);
    if (!event) return;

    const destinationDate = result.destination.droppableId;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(destinationDate)) return;

    const sourceTime = (calendarDrafts[event.id]?.time) || event.start.toTimeString().slice(0, 5);
    const nextScheduledAt = `${destinationDate}T${sourceTime}:00`;

    updateMutation.mutate({
      id: event.id,
      payload: {
        scheduledAt: nextScheduledAt,
        estimatedDuration: Number(calendarDrafts[event.id]?.durationMinutes || event.durationMinutes || 45),
      },
    });
  };

  const submitWorker = (e) => {
    e.preventDefault();
    createWorkerMutation.mutate({
      firstName: workerForm.firstName,
      lastName: workerForm.lastName || null,
      email: workerForm.email,
      phone: workerForm.phone || null,
      role: workerForm.role,
      password: workerForm.password || undefined,
    });
  };

  const submitTask = (e) => {
    e.preventDefault();
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description || null,
      managerId: taskForm.managerId,
      consultationId: taskForm.consultationId || null,
      dueDate: taskForm.dueDate || null,
      priority: taskForm.priority,
      status: taskForm.status,
    });
  };

  const exportClients = async () => {
    const blob = await apiClient.admin.exportClientsCsv();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const submitBlogPost = (e) => {
    e.preventDefault();
    if (String(blogForm.content || "").trim().length < 20) {
      alert("Текст публікації має містити щонайменше 20 символів.");
      return;
    }
    createBlogPostMutation.mutate({
      title: blogForm.title,
      slug: blogForm.slug || undefined,
      category: blogForm.category || null,
      tags: blogForm.tags
        ? blogForm.tags.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      excerpt: blogForm.excerpt || null,
      content: blogForm.content,
      status: blogForm.status,
      coverImage: blogForm.coverImage || null,
    });
  };

  useEffect(() => {
    const onHotkey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.getElementById("admin-global-search");
        input?.focus();
      }
    };

    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, []);

  return (
    <div className="pt-24 pb-16 bg-gradient-to-b from-white to-slate-50/70">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Admin</p>
            <h1 className="font-heading text-4xl lg:text-5xl tracking-tight">Premium CRM Console</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Консультації, воронка, аналітика, платежі, календар і контроль якості в єдиному робочому просторі.
            </p>
          </div>

          <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-2">
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="admin-global-search"
                placeholder="Пошук по CRM (Ctrl/Cmd + K)"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setActiveTab("consultations");
                  }
                }}
                className="pl-9 h-10 bg-white"
                aria-label="Глобальний пошук по CRM"
              />
            </div>
            <Button variant="outline" onClick={refreshAll} className="gap-2 h-10">
              <RefreshCw className="w-4 h-4" /> Оновити
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {dashboardKpis.map((metric) => (
            <PremiumKpiCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              percentage={metric.percentage}
              trend={metric.trend}
              todayValue={metric.todayValue}
              monthlyComparison={metric.monthlyComparison}
            />
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="sticky top-16 z-20 flex w-full flex-wrap gap-2 overflow-x-auto rounded-xl border border-border/80 bg-white/90 p-2 h-auto backdrop-blur">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="consultations">Консультації</TabsTrigger>
            <TabsTrigger value="completed">Завершені</TabsTrigger>
            <TabsTrigger value="confirmed">Підтверджені</TabsTrigger>
            <TabsTrigger value="pipeline">Воронка</TabsTrigger>
            <TabsTrigger value="clients">Клієнти</TabsTrigger>
            <TabsTrigger value="payments">Платежі</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="calendar">Календар</TabsTrigger>
            <TabsTrigger value="blog">Блог</TabsTrigger>
            <TabsTrigger value="reviews">Відгуки</TabsTrigger>
            <TabsTrigger value="notifications">Повідомлення</TabsTrigger>
            <TabsTrigger value="audit">Аудит</TabsTrigger>
            <TabsTrigger value="filters">Фільтри</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="shadow-sm border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Consultations by day</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      value: { label: "Consultations", color: "hsl(var(--chart-1))" },
                    }}
                  >
                    <LineChart data={dashboardCharts.consultationsByDay}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      value: { label: "Revenue", color: "hsl(var(--chart-2))" },
                    }}
                  >
                    <BarChart data={dashboardCharts.revenueByDay}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="shadow-sm border-border/80 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Monthly growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      consultations: { label: "Consultations", color: "hsl(var(--chart-3))" },
                      revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
                    }}
                  >
                    <LineChart data={dashboardCharts.monthlyGrowth}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line dataKey="consultations" stroke="var(--color-consultations)" strokeWidth={2} dot={false} />
                      <Line dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      value: { label: "Payments", color: "hsl(var(--chart-4))" },
                    }}
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={dashboardCharts.paymentStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                        {dashboardCharts.paymentStatus.map((_, index) => (
                          <Cell key={`pay-${index}`} fill={["#22c55e", "#f59e0b", "#ef4444", "#6366f1"][index % 4]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="shadow-sm border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Managers performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      total: { label: "Total", color: "hsl(var(--chart-2))" },
                      completed: { label: "Completed", color: "hsl(var(--chart-1))" },
                    }}
                  >
                    <BarChart data={dashboardCharts.managerPerformance}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={6} />
                      <Bar dataKey="completed" fill="var(--color-completed)" radius={6} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Client activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[280px] w-full"
                    config={{
                      active: { label: "Active clients", color: "hsl(var(--chart-5))" },
                    }}
                  >
                    <LineChart data={dashboardCharts.clientActivity}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="active" type="monotone" stroke="var(--color-active)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="consultations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Консультації</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-3">
                  <Input
                    placeholder="Пошук: ім'я, email, телефон, послуга"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="lg:max-w-sm"
                  />
                  <Select value={filters.consultationType} onValueChange={(value) => setFilters((prev) => ({ ...prev, consultationType: value }))}>
                    <SelectTrigger className="lg:max-w-48">
                      <SelectValue placeholder="Тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((value) => (
                        <SelectItem key={value || "all-type"} value={value}>
                          {value || "Усі типи"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger className="lg:max-w-56">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((value) => (
                        <SelectItem key={value || "all-status"} value={value}>
                          {value || "Усі статуси"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filters.confirmationType} onValueChange={(value) => setFilters((prev) => ({ ...prev, confirmationType: value }))}>
                    <SelectTrigger className="lg:max-w-56">
                      <SelectValue placeholder="Підтвердження" />
                    </SelectTrigger>
                    <SelectContent>
                      {confirmationOptions.map((value) => (
                        <SelectItem key={value || "all-confirm"} value={value}>
                          {value === "CONFIRMED"
                            ? "Підтверджені"
                            : value === "UNCONFIRMED"
                              ? "Не підтверджені"
                              : "Усі"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3 font-medium">Клієнт</th>
                        <th className="p-3 font-medium">Запис</th>
                        <th className="p-3 font-medium">Послуга</th>
                        <th className="p-3 font-medium">Статус</th>
                        <th className="p-3 font-medium">Керування</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeConsultations.map((item) => (
                        <tr key={item.id} className="border-t border-border align-top">
                          <td className="p-3 min-w-[220px]">
                            <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                            <p className="text-xs text-muted-foreground">{item.email}</p>
                            <p className="text-xs text-muted-foreground">{item.phone}</p>
                            <p className="text-xs text-muted-foreground">Канал: {contactMethodLabel[item.preferredContactMethod] || "—"}</p>
                          </td>
                          <td className="p-3 min-w-[180px]">
                            <p>{formatDateTime(item.preferredDateTime)}</p>
                            <p className="text-xs text-muted-foreground">{item.consultationType} · {item.estimatedDuration} хв</p>
                          </td>
                          <td className="p-3 min-w-[220px]">
                            <p className="font-medium">{renderServicesForDisplay(item)}</p>
                            <p className="text-xs text-muted-foreground">{item.serviceCategory || item.service?.category || "—"}</p>
                            <p className="text-xs text-muted-foreground">{renderServicePriceForDisplay(item)}</p>
                          </td>
                          <td className="p-3 min-w-[240px]">
                            {item.description && (
                              <div className="mb-3 p-2 rounded border border-border bg-muted/30">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Запис клієнта:</p>
                                <p className="text-xs line-clamp-3">{item.description}</p>
                              </div>
                            )}
                            <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
                            <p className="text-xs mt-2 font-medium text-primary/90">Етап: {stageLabel(item)}</p>
                            <p className="text-xs mt-2 text-muted-foreground">
                              {item.assignedManagerId ? "Закріплено" : "На розподіленні / в обробці"}
                            </p>
                            <div className="mt-2">
                              <Select
                                value={item.assignedManagerId || "unassigned"}
                                onValueChange={(value) => assignManager(item.id, value === "unassigned" ? null : value)}
                              >
                                <SelectTrigger className="h-8 text-xs w-[210px]">
                                  <SelectValue placeholder="Призначити менеджера" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Без менеджера</SelectItem>
                                  {workers.map((w) => (
                                    <SelectItem key={w.id} value={w.id}>
                                      {(w.firstName || w.email) + (w.lastName ? ` ${w.lastName}` : "")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="mt-3 space-y-2">
                              <Textarea
                                value={Object.prototype.hasOwnProperty.call(noteDrafts, item.id) ? noteDrafts[item.id] : (item.internalNotes || "")}
                                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Нотатки після консультації"
                                className="min-h-[72px] text-xs"
                              />
                              <Button size="sm" variant="outline" onClick={() => saveInternalNote(item)} disabled={updateMutation.isPending}>
                                Зберегти нотатку
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 min-w-[220px]">
                            <div className="flex flex-wrap gap-2">
                              {item.status !== "CONFIRMED" && item.status !== "COMPLETED" && (
                                <Button
                                  size="sm"
                                  className="bg-green-500 text-white hover:bg-green-600 shadow-[0_0_18px_rgba(34,197,94,0.45)]"
                                  onClick={() => confirmConsultation(item)}
                                  disabled={updateMutation.isPending || !item.assignedManagerId}
                                >
                                  Підтвердити
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "COMPLETED")} disabled={updateMutation.isPending}>Завершити</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!activeConsultations.length && (
                        <tr>
                          <td className="p-6 text-muted-foreground" colSpan={5}>
                            Немає консультацій за вибраними фільтрами.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Завершені клієнти</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedConsultations.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                        <p className="text-xs text-muted-foreground">{item.email} · {item.phone || "—"}</p>
                        <p className="text-xs text-muted-foreground">Запис: {formatDateTime(item.preferredDateTime)}</p>
                        <p className="text-xs text-muted-foreground">Менеджер: {item.assignedManager?.firstName || item.assignedManager?.email || "—"}</p>
                        <p className="text-xs text-muted-foreground">Підтвердив: {item.confirmedBy?.firstName || item.confirmedBy?.email || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">COMPLETED</Badge>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "PENDING")}>
                          Повернути в консультації
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Textarea
                        value={Object.prototype.hasOwnProperty.call(noteDrafts, item.id) ? noteDrafts[item.id] : (item.internalNotes || "")}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Нотатки після зустрічі"
                        className="min-h-[60px] text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={() => saveInternalNote(item)} disabled={updateMutation.isPending}>
                        Зберегти нотатку
                      </Button>
                    </div>
                  </div>
                ))}
                {!completedConsultations.length && <p className="text-sm text-muted-foreground">Поки немає завершених клієнтів.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confirmed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Підтверджені консультації</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {confirmedConsultations.map((item) => (
                  <div key={item.id} className="rounded-xl border border-green-200 bg-green-50/40 p-4 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">Клієнт: {item.firstName} {item.lastName || ""}</p>
                          <Badge variant="default">CONFIRMED</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Менеджер: {item.assignedManager?.firstName || item.assignedManager?.email || "—"}</p>
                        <p className="text-sm text-muted-foreground">Підтвердив: {item.confirmedBy?.firstName || item.confirmedBy?.email || "—"}</p>
                        <p className="text-sm text-muted-foreground">Підтверджено: {formatDateTime(item.confirmedAt || item.updatedAt)}</p>
                        <p className="text-sm text-muted-foreground">Запис: {formatDateTime(item.preferredDateTime)}</p>
                        <p className="text-sm text-muted-foreground">Канал: {contactMethodLabel[item.preferredContactMethod] || "—"}</p>
                        <p className="text-sm text-muted-foreground">Контакт: {item.phone || "—"}</p>
                        <p className="text-sm text-muted-foreground">Послуга: {renderServicesForDisplay(item)}</p>
                        {item.description && (
                          <div className="mt-3 p-2 rounded border border-border bg-background/50">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Запис клієнта:</p>
                            <p className="text-xs">{item.description}</p>
                          </div>
                        )}
                      </div>

                      <div className="min-w-[240px] space-y-2">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Клієнт / Менеджер</p>
                        <div className="rounded-lg border bg-background p-3 text-sm space-y-1">
                          <p><span className="text-muted-foreground">Клієнт:</span> {item.firstName} {item.lastName || ""}</p>
                          <p><span className="text-muted-foreground">Менеджер:</span> {item.assignedManager?.firstName || item.assignedManager?.email || "—"}</p>
                          <p><span className="text-muted-foreground">Канал:</span> {contactMethodLabel[item.preferredContactMethod] || "—"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => copyConsultationDetails(item)}>
                        <Copy className="w-4 h-4" /> Скопіювати
                      </Button>
                      {item.preferredContactMethod === "EMAIL" && (
                        <a href={`mailto:${item.email}`} className="inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm hover:bg-background">
                          <Mail className="w-4 h-4" /> Пошта
                        </a>
                      )}
                      {item.preferredContactMethod === "TELEGRAM" && (
                        <a href={getTelegramHref(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm hover:bg-background">
                          <Send className="w-4 h-4" /> Telegram
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {!confirmedConsultations.length && <p className="text-sm text-muted-foreground">Поки немає підтверджених консультацій.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Воронка заявок</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Перетягуйте картки між колонками для зміни етапу.</p>
                    <p className="text-xs text-muted-foreground mt-1">Порядок карток зберігається у базі для вашого акаунта.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Менеджер</p>
                      <Select value={pipelineManagerFilter} onValueChange={setPipelineManagerFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Усі менеджери" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Усі менеджери</SelectItem>
                          <SelectItem value="unassigned">Без менеджера</SelectItem>
                          {workers.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.firstName || worker.email} {worker.lastName || ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Послуга</p>
                      <Select value={pipelineServiceFilter} onValueChange={setPipelineServiceFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Усі послуги" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Усі послуги</SelectItem>
                          <SelectItem value="free">Лише безкоштовні</SelectItem>
                          {pipelineServiceOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Дата від</p>
                      <Input type="date" value={pipelineDateFrom} onChange={(e) => setPipelineDateFrom(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Дата до</p>
                      <Input type="date" value={pipelineDateTo} onChange={(e) => setPipelineDateTo(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">New → Pending</p>
                    <p className="text-2xl font-semibold mt-1">{pipelineConversions.newToPending}</p>
                    <p className="text-xs text-muted-foreground mt-1">{pipelineConversions.pendingCount} з {pipelineConversions.newCount || 0} заявок перейшли далі</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending → Confirmed</p>
                    <p className="text-2xl font-semibold mt-1">{pipelineConversions.pendingToConfirmed}</p>
                    <p className="text-xs text-muted-foreground mt-1">{pipelineConversions.confirmedCount + pipelineConversions.paidCount + pipelineConversions.inProgressCount} з {pipelineConversions.pendingCount || 0} дійшли до активного етапу</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Confirmed → Paid</p>
                    <p className="text-2xl font-semibold mt-1">{pipelineConversions.confirmedToPaid}</p>
                    <p className="text-xs text-muted-foreground mt-1">Оплачено: {pipelineConversions.paidCount}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Active → Completed</p>
                    <p className="text-2xl font-semibold mt-1">{pipelineConversions.activeToDone}</p>
                    <p className="text-xs text-muted-foreground mt-1">Completed: {pipelineConversions.doneCount} · Lost: {pipelineConversions.lostCount}</p>
                  </div>
                </div>

                <DragDropContext onDragEnd={onPipelineDragEnd}>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
                    {[
                      { key: "NEW", title: "Нова", items: funnelColumns.NEW },
                      { key: "PENDING", title: "Pending", items: funnelColumns.PENDING },
                      { key: "CONFIRMED", title: "Confirmed", items: funnelColumns.CONFIRMED },
                      { key: "PAID", title: "Paid", items: funnelColumns.PAID },
                      { key: "IN_PROGRESS", title: "In Progress", items: funnelColumns.IN_PROGRESS },
                      { key: "COMPLETED", title: "Completed", items: funnelColumns.COMPLETED },
                      { key: "CANCELLED", title: "Cancelled", items: funnelColumns.CANCELLED },
                      { key: "LOST", title: "Lost", items: funnelColumns.LOST },
                    ].map((column) => (
                      <Droppable droppableId={column.key} key={column.key}>
                        {(dropProvided, dropSnapshot) => (
                          <div
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className={`rounded-lg border p-3 space-y-2 min-h-[260px] transition-colors ${dropSnapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{column.title}</p>
                              <Badge variant="outline">{column.items.length}</Badge>
                            </div>

                            {column.items.map((item, index) => (
                              <Draggable key={item.id} draggableId={item.id} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={`rounded-md border bg-background p-2 text-xs space-y-1 ${dragSnapshot.isDragging ? "shadow-lg border-primary" : ""}`}
                                  >
                                    <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                                    <p className="text-muted-foreground">{item.email}</p>
                                    <p className="text-muted-foreground">{item.assignedManager?.firstName || item.assignedManager?.email || "Без менеджера"}</p>
                                    <p className="text-muted-foreground">{renderServicesForDisplay(item)}</p>
                                    <p className="text-muted-foreground">{renderServicePriceForDisplay(item)}</p>
                                    <p className="text-muted-foreground">В етапі: {stageTimerLabel(item)}</p>
                                    <div className="flex gap-1 flex-wrap pt-1">
                                      {item.status !== "CONFIRMED" && item.status !== "COMPLETED" && item.assignedManagerId && (
                                        <Button size="sm" className="h-7 px-2 bg-green-500 text-white hover:bg-green-600" onClick={() => confirmConsultation(item)}>
                                          Підтв.
                                        </Button>
                                      )}
                                      {column.key !== "PAID" && (
                                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => moveConsultationToStage(item, "PAID")}>
                                          Оплата
                                        </Button>
                                      )}
                                      {item.status !== "COMPLETED" && (
                                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => updateStatus(item.id, "COMPLETED")}>
                                          Заверш.
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {!column.items.length && (
                              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground bg-background/60">
                                Наразі в цій колонці немає заявок.
                              </div>
                            )}
                            {dropProvided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
                </DragDropContext>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserRound className="w-5 h-5" /> CRM Client 360</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Обрати клієнта</p>
                    <Select value={selectedClient?.key || ""} onValueChange={setSelectedClientKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Оберіть клієнта" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientCards.map((card) => (
                          <SelectItem key={card.key} value={card.key}>{card.fullName} · {card.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Fast filters</p>
                      <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setFilters((prev) => ({ ...prev, status: "PENDING" }))}>Pending clients</Button>
                      <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setFilters((prev) => ({ ...prev, consultationType: "PAID" }))}>Paid only</Button>
                      <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => setFilters({ consultationType: "", status: "", confirmationType: "", search: "" })}>Reset filters</Button>
                    </div>
                  </div>

                  {selectedClientProfile ? (
                    <div className="rounded-xl border border-border/80 bg-white p-4 shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                            {getInitials(selectedClientProfile.fullName)}
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{selectedClientProfile.fullName}</p>
                            <p className="text-xs text-muted-foreground">{selectedClientProfile.email} · {selectedClientProfile.phone}</p>
                          </div>
                        </div>
                        <Badge variant={statusTone[selectedClientProfile.status] || "secondary"}>{statusLabelMap[selectedClientProfile.status] || selectedClientProfile.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="rounded-lg border p-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground">Client score</p>
                          <p className="text-lg font-semibold mt-1">{selectedClientProfile.clientScore}</p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground">LTV</p>
                          <p className="text-lg font-semibold mt-1">{formatMoney(selectedClientProfile.ltv)}</p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground">Consultations</p>
                          <p className="text-lg font-semibold mt-1">{selectedClientProfile.consultations.length}</p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground">Open tasks</p>
                          <p className="text-lg font-semibold mt-1">{selectedClientProfile.openTasks}</p>
                        </div>
                        <div className="rounded-lg border p-3 bg-muted/20">
                          <p className="text-xs text-muted-foreground">Manager</p>
                          <p className="text-sm font-semibold mt-1">{selectedClientProfile.managerName}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-border p-3 space-y-1">
                          <p><span className="text-muted-foreground">Company:</span> —</p>
                          <p><span className="text-muted-foreground">Phone:</span> {selectedClientProfile.phone || "—"}</p>
                          <p><span className="text-muted-foreground">Email:</span> {selectedClientProfile.email || "—"}</p>
                          <p><span className="text-muted-foreground">Telegram:</span> {selectedClientProfile.phone || "—"}</p>
                          <p><span className="text-muted-foreground">Instagram:</span> —</p>
                          <p><span className="text-muted-foreground">Facebook:</span> —</p>
                          <p><span className="text-muted-foreground">Address:</span> —</p>
                        </div>
                        <div className="rounded-lg border border-border p-3 space-y-1">
                          <p><span className="text-muted-foreground">Responsible manager:</span> {selectedClientProfile.managerName}</p>
                          <p><span className="text-muted-foreground">Total revenue:</span> {formatMoney(selectedClientProfile.totalRevenue)}</p>
                          <p><span className="text-muted-foreground">Average check:</span> {formatMoney(averageCheckByEmail.get(String(selectedClientProfile.email || "").toLowerCase()) || 0)}</p>
                          <p><span className="text-muted-foreground">Last activity:</span> {formatDateTime(selectedClientProfile.lastActivityDate)}</p>
                          <p><span className="text-muted-foreground">Created date:</span> {formatDateTime(selectedClientProfile.first?.createdAt)}</p>
                          <p><span className="text-muted-foreground">Notes:</span> {selectedClientProfile.latest?.internalNotes || "—"}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedClientProfile.tags.map((tag) => (
                          <span key={tag} className={`text-xs border rounded-full px-2.5 py-1 ${clientTagClass(tag)}`}>{tag}</span>
                        ))}
                        {!selectedClientProfile.tags.length && <span className="text-xs text-muted-foreground">Немає тегів</span>}
                      </div>
                    </div>
                  ) : null}
                </div>

                {selectedClientProfile ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <Card className="xl:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-base">Timeline & history</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 max-h-[460px] overflow-y-auto">
                        {selectedClientProfile.timeline?.slice(0, 50).map((event) => (
                          <div key={event.id} className="relative pl-5 pb-3 border-l border-border ml-2">
                            <span className="absolute -left-[6px] top-1 w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
                            <p className="text-sm font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{formatDateTime(event.date)}</p>
                          </div>
                        ))}
                        {!selectedClientProfile.timeline?.length && <p className="text-sm text-muted-foreground">Історія відсутня.</p>}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Tasks & payments</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payments</p>
                          <div className="space-y-2 max-h-[180px] overflow-y-auto">
                            {selectedClientProfile.relatedPayments.map((payment) => (
                              <div key={payment.consultationId} className="rounded-md border p-2 text-xs">
                                <p className="font-medium">{payment.serviceName || "Послуга"}</p>
                                <p className="text-muted-foreground">{formatMoney(payment.amount || 0, payment.currency || "UAH")}</p>
                                <Badge variant={payment.paymentStatus === "PAID" ? "default" : "secondary"} className="mt-1">{payment.paymentStatus}</Badge>
                              </div>
                            ))}
                            {!selectedClientProfile.relatedPayments.length && <p className="text-xs text-muted-foreground">Платежів немає.</p>}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tasks</p>
                          <div className="space-y-2 max-h-[180px] overflow-y-auto">
                            {selectedClientProfile.relatedTasks.map((task) => (
                              <div key={task.id} className="rounded-md border p-2 text-xs">
                                <p className="font-medium">{task.title}</p>
                                <p className="text-muted-foreground">{task.priority} · {task.status}</p>
                              </div>
                            ))}
                            {!selectedClientProfile.relatedTasks.length && <p className="text-xs text-muted-foreground">Задач немає.</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {clientCards.map((card) => {
                  const latest = card.consultations[0];
                  return (
                    <div key={card.key} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{card.fullName}</p>
                          <p className="text-xs text-muted-foreground">{card.email} · {card.phone}</p>
                          <p className="text-xs text-muted-foreground">Канал: {contactMethodLabel[card.preferredContactMethod] || "—"}</p>
                          <p className="text-xs text-muted-foreground">Середній чек: {formatMoney(averageCheckByEmail.get(String(card.email || "").toLowerCase()) || 0)}</p>
                        </div>
                        <Badge variant="outline">Всього заявок: {card.consultations.length}</Badge>
                      </div>

                      <div className="rounded-md border p-3 bg-muted/20">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Остання заявка</p>
                        {latest ? (
                          <>
                            <p className="text-sm">{formatDateTime(latest.preferredDateTime)} · {latest.serviceName || latest.service?.name || "Безкоштовна консультація"}</p>
                            <p className="text-xs text-muted-foreground mt-1">Етап: {stageLabel(latest)} · Статус: {latest.status}</p>
                            <p className="text-xs text-muted-foreground mt-1">Менеджер: {latest.assignedManager?.firstName || latest.assignedManager?.email || "—"}</p>
                          </>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        {card.consultations.slice(0, 4).map((c) => (
                          <div key={c.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs border rounded-md p-2">
                            <span>{formatDateTime(c.createdAt)}</span>
                            <span>{c.serviceName || c.service?.name || "Безкоштовна консультація"}</span>
                            <Badge variant={statusTone[c.status] || "secondary"}>{c.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!clientCards.length && <p className="text-sm text-muted-foreground">Картки клієнтів поки порожні.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Середній чек (усі клієнти)</p>
                <p className="text-2xl font-semibold mt-1">{formatMoney(paymentAnalytics.overall?.averageCheck || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Оплачених платежів: {paymentAnalytics.overall?.paidOrdersCount || 0}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Оплачено загалом</p>
                <p className="text-2xl font-semibold mt-1">{formatMoney(paymentAnalytics.overall?.totalPaid || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Клієнтів з оплатою: {paymentAnalytics.overall?.paidClientsCount || 0}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Топ середній чек</p>
                <p className="text-sm mt-1 font-medium">{paymentAnalytics.perClient?.[0]?.clientName || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatMoney(paymentAnalytics.perClient?.[0]?.averageCheck || 0)}</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Облік платежів</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.consultationId} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{payment.clientName}</p>
                        <p className="text-xs text-muted-foreground">{payment.email}</p>
                        <p className="text-xs text-muted-foreground">{payment.serviceName}</p>
                        <p className="text-xs text-muted-foreground">Сума: {formatMoney(payment.amount, payment.currency || "UAH")}</p>
                        <p className="text-xs text-muted-foreground">Середній чек клієнта: {formatMoney(averageCheckByEmail.get(String(payment.email || "").toLowerCase()) || 0, payment.currency || "UAH")}</p>
                        <p className="text-xs text-muted-foreground">Менеджер: {payment.manager?.firstName || payment.manager?.email || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={payment.paymentStatus === "PAID" ? "default" : "secondary"}>{payment.paymentStatus}</Badge>
                        <Button
                          size="sm"
                          className="bg-green-500 text-white hover:bg-green-600"
                          disabled={payment.paymentStatus === "PAID" || markPaidMutation.isPending}
                          onClick={() => markPaidMutation.mutate(payment.consultationId)}
                        >
                          {payment.paymentStatus === "PAID" ? "Оплачено" : "Позначити як оплачено"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!payments.length && <p className="text-sm text-muted-foreground">Платежів поки немає.</p>}

                {!!paymentAnalytics.perClient?.length && (
                  <div className="rounded-lg border border-border mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="p-3 font-medium">Клієнт</th>
                          <th className="p-3 font-medium">Оплат</th>
                          <th className="p-3 font-medium">Сума</th>
                          <th className="p-3 font-medium">Середній чек</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentAnalytics.perClient.slice(0, 25).map((client) => (
                          <tr key={client.email} className="border-t border-border">
                            <td className="p-3">
                              <p className="font-medium">{client.clientName}</p>
                              <p className="text-xs text-muted-foreground">{client.email}</p>
                            </td>
                            <td className="p-3">{client.paidOrdersCount}</td>
                            <td className="p-3">{formatMoney(client.totalPaid)}</td>
                            <td className="p-3">{formatMoney(client.averageCheck)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crm" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="Клієнтів у базі" value={stats.totalClients ?? 0} icon={Users} subtitle="Унікальні клієнти за email" />
              <StatCard title="Працівники" value={stats.workersCount ?? workers.length} icon={Briefcase} subtitle="Менеджери / відповідальні" />
              <StatCard title="Не розподілено" value={stats.unassignedCount ?? 0} icon={UserPlus} subtitle="Клієнти без менеджера" />
              <StatCard title="Активні таски" value={stats.tasksOpen ?? 0} icon={ClipboardList} subtitle={`Всього: ${stats.tasksTotal ?? tasks.length}`} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Додати працівника</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button variant="outline" onClick={exportClients}>Експорт клієнтів в Excel (CSV)</Button>
                </div>

                <div className="mb-5 p-3 rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground">
                  Формування посилань приховано. До керування запрошеннями повернемося пізніше.
                </div>

                <form onSubmit={submitWorker} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <Input placeholder="Ім'я" value={workerForm.firstName} onChange={(e) => setWorkerForm((p) => ({ ...p, firstName: e.target.value }))} required />
                  <Input placeholder="Прізвище" value={workerForm.lastName} onChange={(e) => setWorkerForm((p) => ({ ...p, lastName: e.target.value }))} />
                  <Input type="email" placeholder="Email" value={workerForm.email} onChange={(e) => setWorkerForm((p) => ({ ...p, email: e.target.value }))} required />
                  <Input placeholder="Телефон" value={workerForm.phone} onChange={(e) => setWorkerForm((p) => ({ ...p, phone: e.target.value }))} />
                  <Select value={workerForm.role} onValueChange={(value) => setWorkerForm((p) => ({ ...p, role: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">MANAGER</SelectItem>
                      <SelectItem value="CLIENT">CLIENT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Пароль (опціонально)" value={workerForm.password} onChange={(e) => setWorkerForm((p) => ({ ...p, password: e.target.value }))} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <Button type="submit" disabled={createWorkerMutation.isPending}>
                      {createWorkerMutation.isPending ? 'Створення...' : 'Створити працівника'}
                    </Button>
                  </div>
                </form>

                <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-3 font-medium">Працівник</th>
                        <th className="p-3 font-medium">Роль</th>
                        <th className="p-3 font-medium">Клієнтів</th>
                        <th className="p-3 font-medium">Тасків</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((worker) => (
                        <tr key={worker.id} className="border-t border-border">
                          <td className="p-3">
                            <p className="font-medium">{worker.firstName || '—'} {worker.lastName || ''}</p>
                            <p className="text-xs text-muted-foreground">{worker.email}</p>
                          </td>
                          <td className="p-3"><Badge variant="outline">{worker.role}</Badge></td>
                          <td className="p-3">{worker._count?.assignedConsultations ?? 0}</td>
                          <td className="p-3">{worker._count?.assignedTasks ?? 0}</td>
                        </tr>
                      ))}
                      {!workers.length && (
                        <tr><td colSpan={4} className="p-4 text-muted-foreground">Працівників поки немає.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Таски</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={submitTask} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <Input placeholder="Назва таски" value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} required />
                  <Select value={taskForm.managerId} onValueChange={(value) => setTaskForm((p) => ({ ...p, managerId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Відповідальний" /></SelectTrigger>
                    <SelectContent>
                      {workers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>{worker.firstName || worker.email} {worker.lastName || ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} />
                  <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((p) => ({ ...p, priority: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {taskPriorityOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={taskForm.status} onValueChange={(value) => setTaskForm((p) => ({ ...p, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {taskStatusOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={taskForm.consultationId || "none"} onValueChange={(value) => setTaskForm((p) => ({ ...p, consultationId: value === 'none' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Клієнт (опціонально)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без прив'язки</SelectItem>
                      {consultations.slice(0, 150).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName || ''} · {c.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Textarea placeholder="Опис" value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 xl:col-span-3">
                    <Button type="submit" disabled={createTaskMutation.isPending || !taskForm.managerId}>
                      {createTaskMutation.isPending ? 'Створення...' : 'Створити таску'}
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className={`p-4 border rounded-lg ${task.status === "DONE" ? "border-green-300 bg-green-50/40" : "border-border"}`}>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                          <p className={`font-medium ${task.status === "DONE" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.description || 'Без опису'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Відповідальний: {task.manager?.firstName || task.manager?.email || '—'} · Дедлайн: {formatDateTime(task.dueDate)}
                          </p>
                          {task.consultation ? (
                            <p className="text-xs text-muted-foreground mt-1">Клієнт: {task.consultation.firstName} {task.consultation.lastName || ''} · {task.consultation.email}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={task.status === "DONE" ? "default" : "outline"}>{task.priority}</Badge>
                          <Button
                            size="sm"
                            className="bg-green-500 text-white hover:bg-green-600"
                            onClick={() => updateTaskMutation.mutate({ id: task.id, payload: { status: "DONE" } })}
                            disabled={task.status === "DONE" || updateTaskMutation.isPending}
                          >
                            {task.status === "DONE" ? "Виконано" : "Завершити таску"}
                          </Button>
                          <Select value={task.status} onValueChange={(value) => updateTaskMutation.mutate({ id: task.id, payload: { status: value } })}>
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {taskStatusOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!tasks.length && <p className="text-sm text-muted-foreground">Поки що тасків немає.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarRange className="w-5 h-5" /> Календар записів</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => shiftCalendar(-1)} aria-label="Попередній період">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => shiftCalendar(1)} aria-label="Наступний період">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={goToToday}>Сьогодні</Button>
                    <p className="text-sm text-muted-foreground ml-1">
                      {selectedCalendarDate?.toLocaleDateString("uk-UA", { dateStyle: "full" })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { key: "DAY", label: "Day" },
                      { key: "WEEK", label: "Week" },
                      { key: "MONTH", label: "Month" },
                      { key: "AGENDA", label: "Agenda" },
                    ].map((view) => (
                      <Button
                        key={view.key}
                        size="sm"
                        variant={calendarView === view.key ? "default" : "outline"}
                        onClick={() => setCalendarView(view.key)}
                      >
                        {view.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
                  <div className="rounded-xl border border-border p-2 bg-white w-fit">
                    <Calendar
                      mode="single"
                      selected={selectedCalendarDate}
                      onSelect={(day) => day && setSelectedCalendarDate(day)}
                    />
                    <p className="text-xs text-muted-foreground px-2 pb-2">Перетягуйте картки між днями у Week view.</p>
                  </div>

                  <div className="space-y-3">
                    {calendarView === "DAY" && (
                      <div className="space-y-3">
                        {calendarItems.map((item) => {
                          const draft = ensureCalendarDraft(item);
                          return (
                            <div key={item.id} className="p-4 rounded-xl border border-border bg-white shadow-sm space-y-3">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">
                                    {item.start.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                                    {" · "}
                                    {item.firstName} {item.lastName || ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{item.email} · {item.phone || "—"}</p>
                                  <p className="text-xs text-muted-foreground">{renderServicesForDisplay(item)}</p>
                                </div>
                                <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <Input
                                  type="date"
                                  value={draft.date}
                                  onChange={(e) => upsertCalendarDraft(item, { date: e.target.value })}
                                />
                                <Input
                                  type="time"
                                  value={draft.time}
                                  onChange={(e) => upsertCalendarDraft(item, { time: e.target.value })}
                                />
                                <Input
                                  type="number"
                                  min={15}
                                  max={240}
                                  step={15}
                                  value={draft.durationMinutes}
                                  onChange={(e) => upsertCalendarDraft(item, { durationMinutes: Number(e.target.value) || 45 })}
                                />
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => applyCalendarDraft(item)}
                                  disabled={updateMutation.isPending}
                                >
                                  {updateMutation.isPending ? "Збереження..." : "Зберегти"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!calendarItems.length && <p className="text-sm text-muted-foreground">На обрану дату записів немає.</p>}
                      </div>
                    )}

                    {calendarView === "WEEK" && (
                      <DragDropContext onDragEnd={onCalendarDragEnd}>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                          {weekDays.map((day) => {
                            const dateKey = day.toISOString().slice(0, 10);
                            const dayEvents = weekEventsMap.get(dateKey) || [];
                            return (
                              <Droppable key={dateKey} droppableId={dateKey}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`rounded-xl border min-h-[220px] p-2 ${snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCalendarDate(day)}
                                      className="w-full text-left mb-2"
                                    >
                                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                        {day.toLocaleDateString("uk-UA", { weekday: "short" })}
                                      </p>
                                      <p className="font-medium text-sm">{day.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}</p>
                                    </button>
                                    <div className="space-y-2">
                                      {dayEvents.map((event, index) => (
                                        <Draggable key={`cal-${event.id}`} draggableId={`cal-${event.id}`} index={index}>
                                          {(dragProvided, dragSnapshot) => (
                                            <div
                                              ref={dragProvided.innerRef}
                                              {...dragProvided.draggableProps}
                                              {...dragProvided.dragHandleProps}
                                              className={`rounded-md border bg-white p-2 text-xs ${dragSnapshot.isDragging ? "shadow-lg border-primary" : ""}`}
                                            >
                                              <p className="font-medium flex items-center gap-1"><GripVertical className="w-3 h-3" /> {event.firstName}</p>
                                              <p className="text-muted-foreground">{event.start.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</p>
                                              <p className="text-muted-foreground line-clamp-2">{renderServicesForDisplay(event)}</p>
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {!dayEvents.length && <div className="text-xs text-muted-foreground border border-dashed rounded-md p-2">Порожньо</div>}
                                    </div>
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            );
                          })}
                        </div>
                      </DragDropContext>
                    )}

                    {calendarView === "MONTH" && (
                      <div className="grid grid-cols-7 gap-2">
                        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((w) => (
                          <div key={w} className="text-xs text-muted-foreground font-medium text-center py-1">{w}</div>
                        ))}
                        {monthGridDays.map((cell) => (
                          <button
                            type="button"
                            key={cell.key}
                            onClick={() => {
                              setSelectedCalendarDate(cell.date);
                              setCalendarView("DAY");
                            }}
                            className={`min-h-[86px] rounded-lg border p-2 text-left transition-colors ${cell.inCurrentMonth ? "bg-white border-border hover:border-primary" : "bg-muted/30 border-border/60 text-muted-foreground"}`}
                          >
                            <p className="text-xs font-medium">{cell.date.getDate()}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{cell.events.length} запис(ів)</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {calendarView === "AGENDA" && (
                      <div className="space-y-3">
                        {agendaItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-border bg-white p-3">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                                <p className="text-xs text-muted-foreground">{formatDateTime(item.start)} · {item.durationMinutes} хв</p>
                                <p className="text-xs text-muted-foreground">{renderServicesForDisplay(item)}</p>
                              </div>
                              <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
                            </div>
                          </div>
                        ))}
                        {!agendaItems.length && <p className="text-sm text-muted-foreground">На найближчі 30 днів записів немає.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blog" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Newspaper className="w-5 h-5" /> Блог та новини</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={submitBlogPost} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Заголовок"
                    value={blogForm.title}
                    onChange={(e) => setBlogForm((p) => ({ ...p, title: e.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Slug (опційно)"
                    value={blogForm.slug}
                    onChange={(e) => setBlogForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                  <Input
                    placeholder="Категорія (напр. Новини)"
                    value={blogForm.category}
                    onChange={(e) => setBlogForm((p) => ({ ...p, category: e.target.value }))}
                  />
                  <Input
                    placeholder="Теги через кому"
                    value={blogForm.tags}
                    onChange={(e) => setBlogForm((p) => ({ ...p, tags: e.target.value }))}
                  />
                  <Input
                    placeholder="Обкладинка (URL, опційно)"
                    value={blogForm.coverImage}
                    onChange={(e) => setBlogForm((p) => ({ ...p, coverImage: e.target.value }))}
                  />
                  <Select value={blogForm.status} onValueChange={(value) => setBlogForm((p) => ({ ...p, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">DRAFT</SelectItem>
                      <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                      <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="md:col-span-2">
                    <Textarea
                      placeholder="Короткий опис (excerpt)"
                      value={blogForm.excerpt}
                      onChange={(e) => setBlogForm((p) => ({ ...p, excerpt: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Textarea
                      placeholder="Текст статті / новини"
                      value={blogForm.content}
                      onChange={(e) => setBlogForm((p) => ({ ...p, content: e.target.value }))}
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Мінімум 20 символів.</p>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={createBlogPostMutation.isPending}>
                      {createBlogPostMutation.isPending ? "Збереження..." : "Додати публікацію"}
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  {blogPosts.map((post) => (
                    <div key={post.id} className="p-4 rounded-lg border border-border space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{post.title}</p>
                          <p className="text-xs text-muted-foreground">/{post.slug}</p>
                          <p className="text-xs text-muted-foreground">{post.category || "Без категорії"} · {formatDateTime(post.publishedAt || post.createdAt)}</p>
                        </div>
                        <Badge variant={post.status === "PUBLISHED" ? "default" : post.status === "ARCHIVED" ? "outline" : "secondary"}>{post.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{post.excerpt || String(post.content || "").slice(0, 220)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateBlogPostMutation.mutate({ id: post.id, payload: { status: "PUBLISHED" } })}>
                          Опублікувати
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateBlogPostMutation.mutate({ id: post.id, payload: { status: "DRAFT" } })}>
                          У чернетки
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateBlogPostMutation.mutate({ id: post.id, payload: { status: "ARCHIVED" } })}>
                          В архів
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeBlogPostMutation.mutate(post.id)}>
                          Видалити
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!blogPosts.length && <p className="text-sm text-muted-foreground">Публікацій поки немає.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Відгуки ({reviews.filter(r => !r.isApproved).length} нових)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="p-4 rounded-lg border border-border space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{r.name}</span>
                          {r.role && <span className="text-xs text-muted-foreground">{r.role}</span>}
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground/20'}`} />
                            ))}
                          </div>
                          <Badge variant={r.isApproved ? 'default' : 'secondary'}>{r.isApproved ? 'Опубліковано' : 'На модерації'}</Badge>
                        </div>
                        <p className="text-sm text-foreground/80">{r.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(r.createdAt)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!r.isApproved && (
                          <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => reviewPatchMutation.mutate({ id: r.id, isApproved: true })}>
                            <CheckCircle className="w-4 h-4" /> Схвалити
                          </Button>
                        )}
                        {r.isApproved && (
                          <Button size="sm" variant="outline" className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => reviewPatchMutation.mutate({ id: r.id, isApproved: false })}>
                            <XCircle className="w-4 h-4" /> Сприховати
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                          onClick={() => reviewDeleteMutation.mutate(r.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!reviews.length && <p className="text-sm text-muted-foreground">Поки немає відгуків.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Нові клієнти та розподіл</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                  <StatCard title="Нових записів (сьогодні)" value={analytics.todayBookings ?? 0} icon={Users} subtitle="Нові клієнти за поточний день" />
                  <StatCard title="Не розподілено" value={stats.unassignedCount ?? 0} icon={UserPlus} subtitle="Клієнти без відповідального" />
                  <StatCard title="У черзі повідомлень" value={notifications.length} icon={Bell} subtitle="Системні нотифікації" />
                </div>

                <div className="space-y-3">
                  {latestBookings.map((item) => (
                    <div key={item.id} className="p-4 rounded-lg border border-border">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                          <p className="text-xs text-muted-foreground">{item.email} · {item.phone || "—"}</p>
                          <p className="text-xs text-muted-foreground mt-1">Запис: {formatDateTime(item.preferredDateTime)}</p>
                          <p className="text-xs text-muted-foreground">Створено: {formatDateTime(item.createdAt)}</p>
                          <p className="text-xs text-muted-foreground">Послуга: {item.serviceName || item.service?.name || "Безкоштовна консультація"}</p>
                          <p className="text-xs text-muted-foreground">Канал: {contactMethodLabel[item.preferredContactMethod] || "—"}</p>
                        </div>
                        <div className="text-xs space-y-2 min-w-[220px]">
                          <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
                          <p className="text-muted-foreground">
                            {item.assignedManagerId
                              ? `Розподілено: ${item.assignedManager?.firstName || item.assignedManager?.email || "—"}`
                              : "На розподіленні / в обробці"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!latestBookings.length && <p className="text-sm text-muted-foreground">Поки немає нових клієнтів.</p>}
                </div>

                <div className="pt-2">
                  <p className="text-sm font-medium mb-2">Системна черга повідомлень</p>
                  <div className="space-y-2">
                    {notifications.slice(0, 12).map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{item.type}</p>
                            <p className="text-xs text-muted-foreground">{item.channel} · {item.recipient || '—'}</p>
                          </div>
                          <Badge variant="outline">{item.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(item.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> CRM аналітика та аудит</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard title="Відвідувачі сьогодні" value={analytics.todayVisits ?? 0} icon={Users} subtitle="Унікальні візити на сайт" />
                  <StatCard title="Записи сьогодні" value={analytics.todayBookings ?? 0} icon={CalendarRange} subtitle="Залишили заявку" />
                  <StatCard title="Платні записи сьогодні" value={analytics.todayPaidBookings ?? 0} icon={Shield} subtitle="Ліди на платні послуги" />
                  <StatCard title="Конверсія за день" value={`${analytics.conversionRateToday ?? 0}%`} icon={TrendingUp} subtitle="Запис / візити" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard title="FREE ліди" value={analytics.freeLeads ?? 0} icon={Users} subtitle="Клієнти з безкоштовної консультації" />
                  <StatCard title="Стали платними" value={analytics.convertedToPaid ?? 0} icon={Wallet} subtitle="Конвертовані в платні послуги" />
                  <StatCard title="Конверсія FREE→PAID" value={`${analytics.freeToPaidConversion ?? 0}%`} icon={TrendingUp} subtitle="Ефективність консультацій" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-4 h-4" /> Візити та записи за 7 днів</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-[280px] w-full"
                        config={{
                          visits: { label: "Візити", color: "hsl(var(--chart-2))" },
                          bookings: { label: "Записи", color: "hsl(var(--chart-1))" },
                        }}
                      >
                        <LineChart data={bookingsVsVisits7d}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="day" tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line type="monotone" dataKey="visits" stroke="var(--color-visits)" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="bookings" stroke="var(--color-bookings)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Популярні послуги</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-[280px] w-full"
                        config={{
                          count: { label: "К-сть", color: "hsl(var(--chart-3))" },
                        }}
                      >
                        <BarChart data={popularServices} layout="vertical" margin={{ left: 16, right: 8 }}>
                          <CartesianGrid horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" hide />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill="var(--color-count)" radius={6} />
                        </BarChart>
                      </ChartContainer>
                      <div className="mt-3 space-y-1">
                        {popularServices.map((item) => (
                          <div key={item.name} className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.name}</span>
                            <span>{item.count}</span>
                          </div>
                        ))}
                        {!popularServices.length && <p className="text-sm text-muted-foreground">Ще немає даних для популярності послуг.</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Тип консультацій</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        className="h-[260px] w-full"
                        config={{
                          free: { label: "FREE", color: "hsl(var(--chart-4))" },
                          paid: { label: "PAID", color: "hsl(var(--chart-5))" },
                        }}
                      >
                        <PieChart>
                          <Pie data={consultationTypeShare} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                            {consultationTypeShare.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Останні події аудиту</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {auditLogs.slice(0, 20).map((item) => (
                        <div key={item.id} className="p-3 rounded-lg border border-border">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{item.action} · {item.entityType}</p>
                              <p className="text-xs text-muted-foreground">{item.actorUser?.email || 'system'} · {formatDateTime(item.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {!auditLogs.length && <p className="text-sm text-muted-foreground">Поки немає audit-логів.</p>}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="filters">
            <Card>
              <CardHeader>
                <CardTitle>Підказки для керування</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Використовуйте фільтри зверху в табі консультацій для пошуку по типу, статусу та тексту.</p>
                <p>• Після зміни статусу дані та нотифікації оновлюються автоматично.</p>
                <p>• Адмін-сторінка вже готова для подальшого підключення призначення менеджерів та внутрішніх нотаток.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {(statsQuery.isLoading || consultationsQuery.isLoading || notificationsQuery.isLoading || auditLogsQuery.isLoading || reviewsQuery.isLoading || workersQuery.isLoading || tasksQuery.isLoading || blogPostsQuery.isLoading || paymentsQuery.isLoading) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Завантаження даних...
          </div>
        )}
      </div>
    </div>
  );
}