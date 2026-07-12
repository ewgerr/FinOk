import { useMemo, useState } from "react";
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
import { Loader2, RefreshCw, Shield, Users, Bell, History, CalendarRange, Clock3, Star, MessageSquare, CheckCircle, Trash2, Briefcase, UserPlus, ClipboardList, BarChart3, TrendingUp, Newspaper, Copy, Mail, Send } from "lucide-react";

const statusOptions = ["", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const typeOptions = ["", "FREE", "PAID"];
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

const buildConfirmationDetails = (item) => [
  `Клієнт: ${item.firstName} ${item.lastName || ""}`.trim(),
  `Email: ${item.email}`,
  `Телефон/Telegram: ${item.phone || "—"}`,
  `Канал: ${contactMethodLabel[item.preferredContactMethod] || "—"}`,
  `Менеджер: ${item.assignedManager?.firstName || item.assignedManager?.email || "—"}`,
  `Підтвердив: ${item.confirmedBy?.firstName || item.confirmedBy?.email || "—"}`,
  `Підтверджено: ${formatDateTime(item.confirmedAt || item.updatedAt)}`,
  `Запис: ${formatDateTime(item.preferredDateTime)}`,
  `Послуга: ${item.serviceName || item.service?.name || "Безкоштовна консультація"}`,
  `Статус: ${item.status}`,
].join("\n");

const getTelegramHref = (item) => {
  const value = String(item.phone || "").trim();
  if (!value) return "";
  if (value.startsWith("@")) {
    return `https://t.me/${value.slice(1)}`;
  }
  return `https://t.me/share/url?text=${encodeURIComponent(buildConfirmationDetails(item))}`;
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

export default function Admin() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ consultationType: "", status: "", search: "" });
  const [workerForm, setWorkerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "MANAGER",
    password: "",
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
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

  const stats = statsQuery.data || {};
  const consultations = consultationsQuery.data || [];
  const consultationsFeed = consultationsFeedQuery.data || [];
  const notifications = notificationsQuery.data || [];
  const auditLogs = auditLogsQuery.data || [];
  const reviews = reviewsQuery.data || [];
  const workers = workersQuery.data || [];
  const tasks = tasksQuery.data || [];
  const blogPosts = blogPostsQuery.data || [];
  const analytics = stats.analytics || {};

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

  const bookingsVsVisits7d = analytics.bookingsVsVisits7d || [];
  const popularServices = analytics.popularServices || [];
  const consultationTypeShare = (analytics.consultationTypeShare || [
    { name: "FREE", value: stats.freeCount || 0 },
    { name: "PAID", value: stats.paidCount || 0 },
  ]).map((item, index) => ({
    ...item,
    fill: index % 2 === 0 ? "var(--color-free)" : "var(--color-paid)",
  }));

  const paidShare = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.paidCount / stats.total) * 100);
  }, [stats]);

  const selectedDateKey = selectedCalendarDate?.toISOString?.().slice(0, 10) || "";
  const calendarItems = useMemo(() => {
    return consultations
      .filter((item) => item.preferredDateTime && String(item.preferredDateTime).slice(0, 10) === selectedDateKey)
      .sort((a, b) => new Date(a.preferredDateTime) - new Date(b.preferredDateTime));
  }, [consultations, selectedDateKey]);

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

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Admin</p>
            <h1 className="font-heading text-4xl lg:text-5xl tracking-tight">Панель керування</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Консультації, статистика, черга повідомлень та аудиторський журнал.
            </p>
          </div>
          <Button variant="outline" onClick={refreshAll} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Оновити
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Усього записів" value={stats.total ?? "—"} icon={Users} subtitle={`Платні: ${stats.paidCount ?? 0} / Безкоштовні: ${stats.freeCount ?? 0}`} />
          <StatCard title="Платні заявки" value={stats.paidCount ?? "—"} icon={Shield} subtitle={`${paidShare}% від усіх заявок`} />
          <StatCard title="Нагальні / майбутні" value={stats.upcoming ?? "—"} icon={CalendarRange} subtitle="Записи з майбутньою датою" />
          <StatCard title="Статус PENDING" value={stats.statusCounts?.PENDING ?? 0} icon={Clock3} subtitle="Очікують підтвердження" />
        </div>

        <Tabs defaultValue="consultations" className="space-y-6">
          <TabsList className="flex w-full flex-wrap gap-2 overflow-x-auto rounded-lg p-2 h-auto">
            <TabsTrigger value="consultations">Консультації</TabsTrigger>
            <TabsTrigger value="completed">Завершені</TabsTrigger>
            <TabsTrigger value="confirmed">Підтверджені</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="calendar">Календар</TabsTrigger>
            <TabsTrigger value="blog">Блог</TabsTrigger>
            <TabsTrigger value="reviews">Відгуки</TabsTrigger>
            <TabsTrigger value="notifications">Повідомлення</TabsTrigger>
            <TabsTrigger value="audit">Аудит</TabsTrigger>
            <TabsTrigger value="filters">Фільтри</TabsTrigger>
          </TabsList>

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
                            <p className="font-medium">{item.serviceName || item.service?.name || "Безкоштовна консультація"}</p>
                            <p className="text-xs text-muted-foreground">{item.serviceCategory || item.service?.category || "—"}</p>
                            <p className="text-xs text-muted-foreground">{item.servicePriceText || item.service?.price || "Без ціни"}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
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
                  <div key={item.id} className="rounded-lg border border-border p-4 bg-muted/20">
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
                        <p className="text-sm text-muted-foreground">Послуга: {item.serviceName || item.service?.name || "Безкоштовна консультація"}</p>
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
              <CardContent className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                <div className="border rounded-lg p-2 w-fit">
                  <Calendar
                    mode="single"
                    selected={selectedCalendarDate}
                    onSelect={(day) => day && setSelectedCalendarDate(day)}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Записи на {selectedCalendarDate?.toLocaleDateString("uk-UA") || "—"}
                  </p>

                  {calendarItems.map((item) => (
                    <div key={item.id} className="p-4 rounded-lg border border-border">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {new Date(item.preferredDateTime).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {item.firstName} {item.lastName || ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.email} · {item.phone || "—"}</p>
                          <p className="text-xs text-muted-foreground">{item.serviceName || item.service?.name || "Безкоштовна консультація"}</p>
                        </div>
                        <div className="text-xs">
                          <Badge variant={statusTone[item.status] || "secondary"}>{item.status}</Badge>
                          <p className="text-muted-foreground mt-2">
                            {item.assignedManagerId
                              ? `Закріплено: ${item.assignedManager?.firstName || item.assignedManager?.email || "—"}`
                              : "На розподіленні / в обробці"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!calendarItems.length && (
                    <p className="text-sm text-muted-foreground">На обрану дату записів немає.</p>
                  )}
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

        {(statsQuery.isLoading || consultationsQuery.isLoading || notificationsQuery.isLoading || auditLogsQuery.isLoading || reviewsQuery.isLoading || workersQuery.isLoading || tasksQuery.isLoading || blogPostsQuery.isLoading) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Завантаження даних...
          </div>
        )}
      </div>
    </div>
  );
}