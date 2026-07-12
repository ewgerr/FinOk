import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/backendClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import { serviceCategories } from "@/lib/servicesData";

export default function ConsultationForm({ preselectedCategory = "", preselectedServiceName = "" }) {
  const isPaidFlow = Boolean(preselectedCategory || preselectedServiceName);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    consultationType: isPaidFlow ? "PAID" : "FREE",
    selectedCategoryId: "",
    selectedService: null,
    preferredDate: "",
    selectedSlot: "",
    description: "",
    consent: false,
  });
  const [submitted, setSubmitted] = useState(false);
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
    if (!isPaidFlow) return;

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
      if (!form.preferredDate) {
        setSlots([]);
        setForm((prev) => ({ ...prev, selectedSlot: "" }));
        return;
      }

      setSlotsLoading(true);
      setSlotsError("");
      try {
        const response = await fetch(
          `/api/entities/Consultation/available-slots?date=${encodeURIComponent(form.preferredDate)}&duration=${selectedDuration}`
        );
        if (!response.ok) throw new Error(`Failed to load slots (${response.status})`);
        const data = await response.json();
        setSlots(Array.isArray(data.slots) ? data.slots : []);
        setForm((prev) => ({
          ...prev,
          selectedSlot: data.slots?.[0]?.start || "",
        }));
      } catch (error) {
        console.error('Slots loading error:', error);
        setSlots([]);
        setSlotsError('Не вдалося завантажити доступні слоти. Спробуйте іншу дату.');
      } finally {
        setSlotsLoading(false);
      }
    };

    loadSlots();
  }, [form.preferredDate, selectedDuration]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.email || !form.phone || !form.preferredDate || !form.selectedSlot || !form.consent) {
      alert("Будь ласка, заповніть всі обов'язкові поля та погодьтеся з政策конфіденційності");
      return;
    }

    if (isPaidFlow && !form.selectedService) {
      alert("Будь ласка, оберіть послугу.");
      return;
    }

    const consultationType = isPaidFlow ? "PAID" : "FREE";
    const estimatedDuration = consultationType === "FREE" ? 15 : selectedDuration;
    const selectedCategoryTitle = selectedCategory?.shortTitle || null;

    setLoading(true);
    try {
      await apiClient.entities.Consultation.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        description: form.description,
        consultationType,
        serviceId: null,
        serviceName: consultationType === "PAID" ? form.selectedService?.name : null,
        serviceCategory: consultationType === "PAID" ? selectedCategoryTitle : null,
        servicePriceText: consultationType === "PAID" ? form.selectedService?.price : null,
        isPaid: consultationType === "PAID",
        estimatedDuration,
        preferredDateTime: buildPreferredDateTime(),
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Consultation submission error:", error);
      alert(
        "Помилка при відправці заявки. Спробуйте ще раз або зв'яжіться з нами через Telegram."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="font-heading text-2xl mb-2">Дякуємо за заявку!</h3>
        <p className="text-muted-foreground">
          Ми зв'яжемося з вами найближчим часом.
        </p>
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
            Телефон або Telegram *
          </Label>
          <Input
            value={form.phone}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value }))
            }
            required
            className="mt-1 bg-card border-border"
            placeholder="+380 501 234 567"
          />
        </div>
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

      {isPaidFlow && (
        <>
          <div>
            <Label className="text-sm text-foreground/70 block mb-2">
              Напрямок *
            </Label>
            <Select value={form.selectedCategoryId || selectedCategory?.id || ""} onValueChange={handleCategorySelect}>
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Оберіть напрямок" />
              </SelectTrigger>
              <SelectContent>
                {serviceCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.shortTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm text-foreground/70 block mb-2">
              Послуга *
            </Label>
            <Select
              value={form.selectedService?.name || ""}
              onValueChange={(serviceName) => {
                const service = selectedCategory?.services.find((s) => s.name === serviceName) || null;
                if (service) handleServiceSelect(service);
              }}
            >
              <SelectTrigger className="bg-card border-border">
                <SelectValue placeholder="Оберіть послугу" />
              </SelectTrigger>
              <SelectContent>
                {(selectedCategory?.services || []).map((service) => (
                  <SelectItem key={service.name} value={service.name}>
                    {service.name} — {service.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.selectedService && (
              <div className="mt-3 p-3 rounded bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium">
                  Вибрана послуга: <span className="text-primary">{form.selectedService.name}</span>
                </p>
                <p className="text-xs text-foreground/60 mt-1">{form.selectedService.price}</p>
                <p className="text-xs text-foreground/60 mt-1">
                  Орієнтовна тривалість: {selectedDuration} хв
                </p>
              </div>
            )}
          </div>
        </>
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