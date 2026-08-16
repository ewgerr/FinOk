import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/backendClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { serviceCategories } from "@/lib/servicesData";

const contactMethodLabels = {
  PHONE: "Дзвінок",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
};

export default function ConsultationForm({ preselectedCategory = "", preselectedServiceName = "", freeOnly = false, selectedServices = [] }) {
  // freeOnly = true → завжди FREE незалежно від props
  const isPaidFlow = !freeOnly && Boolean(preselectedCategory || preselectedServiceName);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredContactMethod: "PHONE",
    consultationType: isPaidFlow ? "PAID" : "FREE",
    selectedCategoryId: "",
    selectedService: null,
    selectedServices: selectedServices || [],
    preferredDate: "",
    selectedSlot: "",
    description: "",
    consent: false,
  });
  const [submittedData, setSubmittedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const normalizedCategory = useMemo(() => {
    if (!preselectedCategory) return null;
    return (
      serviceCategories.find(
        (cat) => cat.shortTitle === preselectedCategory || cat.id === preselectedCategory
      ) || null
    );
  }, [preselectedCategory]);

  const selectedCategory = useMemo(() => {
    if (!form.selectedCategoryId) return normalizedCategory;
    return serviceCategories.find((cat) => cat.id === form.selectedCategoryId) || normalizedCategory;
  }, [form.selectedCategoryId, normalizedCategory]);

  useEffect(() => {
    if (!isPaidFlow) return;  // covers freeOnly=true too

    const category = normalizedCategory || serviceCategories[0] || null;
    if (!category) return;

    const serviceByName = preselectedServiceName
      ? category.services.find((s) => s.name === preselectedServiceName)
      : null;

    setForm((prev) => ({
      ...prev,
      consultationType: "PAID",
      selectedCategoryId: category.id,
      selectedService: serviceByName || prev.selectedService,
    }));
  }, [isPaidFlow, normalizedCategory, preselectedServiceName]);
  
  useEffect(() => {
    if (selectedServices && selectedServices.length > 0) {
      setForm((prev) => ({
        ...prev,
        selectedServices: selectedServices,
        consultationType: "PAID",
      }));
    }
  }, [selectedServices]);

  const handleServiceSelect = (service) => {
    setForm((f) => ({
      ...f,
      selectedService: service,
      consultationType: "PAID",
    }));
  };

  const handleCategorySelect = (value) => {
    setForm((f) => ({
      ...f,
      selectedCategoryId: value,
      selectedService: null,
      selectedSlot: "",
      consultationType: "PAID",
    }));
  };

  const selectedDuration = useMemo(() => {
    if (!isPaidFlow) return 15;
    return Number(form.selectedService?.durationMinutes || selectedCategory?.services?.find((s) => s.name === preselectedServiceName)?.durationMinutes || 45);
  }, [isPaidFlow, form.selectedService, selectedCategory, preselectedServiceName]);

  const buildPreferredDateTime = () => form.selectedSlot || null;

  useEffect(() => {
    const loadSlots = async () => {
      if (!form.preferredDate || freeOnly) {
        setSlots([]);
        setForm((prev) => ({ ...prev, selectedSlot: "" }));
        return;
      }

      setSlotsLoading(true);
      setSlotsError("");
      try {
        const data = await apiClient.entities.Consultation.availableSlots({
          date: form.preferredDate,
          duration: selectedDuration,
        });
        setSlots(Array.isArray(data.slots) ? data.slots : []);
        setForm((prev) => ({
          ...prev,
          selectedSlot: data.slots?.[0]?.start || "",
        }));
      } catch (error) {
        console.error('Slots loading error:', error);
        setSlots([]);
        setSlotsError('Не вдалося завантажити доступні слоти. Перевірте підключення до сервера та спробуйте іншу дату.');
      } finally {
        setSlotsLoading(false);
      }
    };

    loadSlots();
  }, [form.preferredDate, selectedDuration]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const needDirectContact = form.preferredContactMethod === "PHONE" || form.preferredContactMethod === "TELEGRAM";
    const effectiveSelectedServices = Array.isArray(form.selectedServices) && form.selectedServices.length > 0
      ? form.selectedServices
      : (form.selectedService
        ? [{
            name: form.selectedService.name,
            price: form.selectedService.price,
            durationMinutes: form.selectedService.durationMinutes,
            catTitle: selectedCategory?.shortTitle || preselectedCategory || "",
          }]
        : []);

    if (!form.firstName || !form.email || !form.preferredDate || !form.selectedSlot || !form.consent || (needDirectContact && !form.phone)) {
      alert("Будь ласка, заповніть всі обов'язкові поля та погодьтеся з політикою конфіденційності.");
      return;
    }

    if (isPaidFlow && effectiveSelectedServices.length === 0) {
      alert("Будь ласка, оберіть послугу.");
      return;
    }

    const consultationType = isPaidFlow ? "PAID" : "FREE";
    const estimatedDuration = consultationType === "FREE" ? 15 : (effectiveSelectedServices[0]?.durationMinutes || 45);

    setLoading(true);
    try {
      const created = await apiClient.entities.Consultation.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        preferredContactMethod: form.preferredContactMethod,
        description: form.description,
        consultationType,
        serviceId: null,
        serviceName: consultationType === "PAID" && effectiveSelectedServices.length === 1 ? effectiveSelectedServices[0]?.name : null,
        serviceCategory: consultationType === "PAID" && effectiveSelectedServices.length === 1 ? effectiveSelectedServices[0]?.catTitle : null,
        servicePriceText: consultationType === "PAID" && effectiveSelectedServices.length === 1 ? effectiveSelectedServices[0]?.price : null,
        selectedServices: consultationType === "PAID" && effectiveSelectedServices.length > 0 ? JSON.stringify(effectiveSelectedServices) : null,
        isPaid: consultationType === "PAID",
        estimatedDuration,
        preferredDateTime: buildPreferredDateTime(),
      });
      setSubmittedData(created || { googleMeetLink: "https://meet.google.com/new" });
    } catch (error) {
      console.error("Consultation submission error:", error);
      alert(
        "Помилка при відправці заявки. Спробуйте ще раз або зв'яжіться з нами через Telegram."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submittedData) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="font-heading text-2xl mb-2">Дякуємо за заявку!</h3>
        <p className="text-muted-foreground">
          Ми зв'яжемося з вами найближчим часом.
        </p>
        <div className="mt-4 p-4 rounded-lg border border-border bg-card max-w-xl mx-auto text-left">
          <p className="text-sm font-medium mb-2">Формат комунікації: {contactMethodLabels[submittedData.preferredContactMethod] || "Email"}</p>
          <p className="text-sm text-muted-foreground">Деталі зустрічі менеджер надішле окремо у вибраному каналі.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">
      {/* Контактна інформація */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm text-foreground/70">
            Ім'я *
          </Label>
          <Input
            value={form.firstName}
            onChange={(e) =>
              setForm((f) => ({ ...f, firstName: e.target.value }))
            }
            required
            className="mt-1 bg-card border-border"
          />
        </div>
        <div>
          <Label className="text-sm text-foreground/70">
            Прізвище
          </Label>
          <Input
            value={form.lastName}
            onChange={(e) =>
              setForm((f) => ({ ...f, lastName: e.target.value }))
            }
            className="mt-1 bg-card border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm text-foreground/70">
            Email *
          </Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
            required
            className="mt-1 bg-card border-border"
          />
        </div>
        <div>
          <Label className="text-sm text-foreground/70">
            Зручний канал комунікації *
          </Label>
          <Select
            value={form.preferredContactMethod}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, preferredContactMethod: value }))
            }
          >
            <SelectTrigger className="mt-1 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PHONE">Дзвінок</SelectItem>
              <SelectItem value="TELEGRAM">Telegram</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-sm text-foreground/70">
          {form.preferredContactMethod === "PHONE"
            ? "Телефон *"
            : form.preferredContactMethod === "TELEGRAM"
              ? "Telegram (@username або номер) *"
              : "Телефон / Telegram (опціонально)"}
        </Label>
        <Input
          value={form.phone}
          onChange={(e) =>
            setForm((f) => ({ ...f, phone: e.target.value }))
          }
          required={form.preferredContactMethod !== "EMAIL"}
          className="mt-1 bg-card border-border"
          placeholder={form.preferredContactMethod === "TELEGRAM" ? "@username або +380..." : "+380 501 234 567"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm text-foreground/70">
            Зручна дата *
          </Label>
          <Input
            type="date"
            value={form.preferredDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, preferredDate: e.target.value }))
            }
            required
            className="mt-1 bg-card border-border"
          />
        </div>
        <div>
          <Label className="text-sm text-foreground/70">
            Зручний слот *
          </Label>
          <Select
            value={form.selectedSlot}
            onValueChange={(value) => setForm((f) => ({ ...f, selectedSlot: value }))}
            disabled={!form.preferredDate || slotsLoading}
          >
            <SelectTrigger className="mt-1 bg-card border-border">
              <SelectValue placeholder={slotsLoading ? "Завантаження слотів..." : "Оберіть час"} />
            </SelectTrigger>
            <SelectContent>
              {slots.map((slot) => (
                <SelectItem key={slot.start} value={slot.start}>
                  {new Date(slot.start).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {slotsError && <p className="mt-2 text-xs text-destructive">{slotsError}</p>}
          {!slotsError && form.preferredDate && !slotsLoading && slots.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">На цю дату вільних слотів немає.</p>
          )}
        </div>
      </div>

      {isPaidFlow && form.selectedServices && form.selectedServices.length > 0 && (
        <div className="p-4 rounded-md border border-primary/20 bg-primary/5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Обрані послуги</p>
          <div className="space-y-2">
            {form.selectedServices.map((s) => (
              <div key={s.key} className="flex items-start justify-between gap-3 pb-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-foreground/60">{s.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-primary whitespace-nowrap text-sm block">{s.price}</span>
                  <p className="text-xs text-muted-foreground mt-1">{s.durationMinutes} хв</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 rounded bg-muted/40 border border-border text-xs text-muted-foreground">
        Обраний слот буде збережено в системі та використаний для підтвердження запису.
      </div>

      {/* Опис запиту */}
      <div>
        <Label className="text-sm text-foreground/70">
          Коротко опишіть вашу ситуацію / запит
        </Label>
        <Input
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Напр. Потрібно зареєструвати ФОП..."
          className="mt-1 bg-card border-border"
        />
      </div>

      {/* Перевірка і відправка */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={form.consent}
          onCheckedChange={(v) =>
            setForm((f) => ({ ...f, consent: v }))
          }
          id="consent"
          className="mt-0.5"
        />
        <Label
          htmlFor="consent"
          className="text-xs text-foreground/60 leading-relaxed cursor-pointer"
        >
          Я погоджуюсь на обробку персональних даних відповідно до{" "}
          <a href="/privacy" className="underline hover:text-primary">
            Політики конфіденційності
          </a>
        </Label>
      </div>

      <button
        type="submit"
        disabled={loading || !form.consent}
        className="w-full py-3 bg-primary text-primary-foreground font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? "Відправляємо..." : "Записатися на консультацію"}
      </button>
    </form>
  );
}