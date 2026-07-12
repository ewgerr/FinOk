import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/backendClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Shield, Users, Bell, History, CalendarRange, Clock3, Star, MessageSquare, CheckCircle, XCircle, Trash2 } from "lucide-react";

const statusOptions = ["", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const typeOptions = ["", "FREE", "PAID"];

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

  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => apiClient.admin.notifications(),
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => apiClient.admin.auditLogs(),
  });

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => apiClient.admin.reviews.list(),
  });

  const reviewPatchMutation = useMutation({
    mutationFn: ({ id, isApproved }) => apiClient.admin.reviews.patch(id, { isApproved }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const reviewDeleteMutation = useMutation({
    mutationFn: (id) => apiClient.admin.reviews.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => apiClient.admin.consultations.update(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      ]);
    },
  });

  const stats = statsQuery.data || {};
  const consultations = consultationsQuery.data || [];
  const notifications = notificationsQuery.data || [];
  const auditLogs = auditLogsQuery.data || [];
  const reviews = reviewsQuery.data || [];

  const paidShare = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.paidCount / stats.total) * 100);
  }, [stats]);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-consultations"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
    ]);
  };

  const updateStatus = (id, status) => updateMutation.mutate({ id, payload: { status } });

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
          <TabsList className="grid w-full grid-cols-5 lg:w-[850px]">
            <TabsTrigger value="consultations">Консультації</TabsTrigger>
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
                      {consultations.map((item) => (
                        <tr key={item.id} className="border-t border-border align-top">
                          <td className="p-3 min-w-[220px]">
                            <p className="font-medium">{item.firstName} {item.lastName || ""}</p>
                            <p className="text-xs text-muted-foreground">{item.email}</p>
                            <p className="text-xs text-muted-foreground">{item.phone}</p>
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
                            <p className="text-xs text-muted-foreground mt-2">Менеджер: {item.assignedManager?.firstName || "—"}</p>
                          </td>
                          <td className="p-3 min-w-[220px]">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "CONFIRMED")} disabled={updateMutation.isPending}>Підтвердити</Button>
                              <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "COMPLETED")} disabled={updateMutation.isPending}>Завершити</Button>
                              <Button size="sm" variant="destructive" onClick={() => updateStatus(item.id, "CANCELLED")} disabled={updateMutation.isPending}>Скасувати</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!consultations.length && (
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
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Черга повідомлень</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.type}</p>
                        <p className="text-xs text-muted-foreground">{item.channel} · {item.recipient || '—'}</p>
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{formatDateTime(item.createdAt)}</p>
                  </div>
                ))}
                {!notifications.length && <p className="text-sm text-muted-foreground">Поки немає повідомлень.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Аудиторський журнал</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditLogs.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.action} · {item.entityType}</p>
                        <p className="text-xs text-muted-foreground">{item.actorUser?.email || 'system'} · {formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                    {item.metadata ? <p className="text-xs text-muted-foreground mt-2">Meta: {JSON.stringify(item.metadata)}</p> : null}
                  </div>
                ))}
                {!auditLogs.length && <p className="text-sm text-muted-foreground">Поки немає audit-логів.</p>}
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

        {(statsQuery.isLoading || consultationsQuery.isLoading || notificationsQuery.isLoading || auditLogsQuery.isLoading) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Завантаження даних...
          </div>
        )}
      </div>
    </div>
  );
}