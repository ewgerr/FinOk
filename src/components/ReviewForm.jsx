import { useState } from "react";
import { Star, Send, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-colors"
          aria-label={`${star} зірок`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= (hovered || value)
                ? "fill-primary text-primary"
                : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewForm({ onClose }) {
  const [form, setForm] = useState({ name: "", role: "", text: "", rating: 5 });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.text.trim()) {
      setError("Будь ласка, вкажіть ім'я та текст відгуку.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Помилка відправки");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8 px-6">
        <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="font-heading text-xl mb-2">Дякуємо за відгук!</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Ваш відгук отримано і буде опубліковано після перевірки.
        </p>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Закрити
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-xl">Залишити відгук</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Оцінка</Label>
        <StarRating value={form.rating} onChange={(v) => set("rating", v)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="review-name">Ім'я *</Label>
          <Input
            id="review-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ваше ім'я"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-role">Ваша роль (необов'язково)</Label>
          <Input
            id="review-role"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            placeholder="напр. ФОП, Директор ТОВ…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-text">Відгук *</Label>
        <Textarea
          id="review-text"
          value={form.text}
          onChange={(e) => set("text", e.target.value)}
          placeholder="Розкажіть про ваш досвід співпраці з ФінОк…"
          rows={4}
          required
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Надсилаємо…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="w-4 h-4" /> Надіслати відгук
          </span>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Відгук буде опубліковано після перевірки модератором
      </p>
    </form>
  );
}
