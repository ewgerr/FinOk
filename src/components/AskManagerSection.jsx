import { useState } from "react";
import { MessageSquareMore, ShieldCheck, SendHorizontal } from "lucide-react";
import { apiClient } from "@/api/backendClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const initialForm = {
  firstName: "",
  email: "",
  phone: "",
  telegram: "",
  message: "",
};

export default function AskManagerSection({ categoryTitle = "" }) {
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.firstName.trim() || !form.email.trim() || form.message.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Не вдалося надіслати",
        description: "Вкажіть ім'я, email і детально опишіть питання.",
      });
      return;
    }

    setLoading(true);
    try {
      await apiClient.support.askQuestion({
        firstName: form.firstName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        telegram: form.telegram.trim() || null,
        category: categoryTitle || null,
        sourcePage: typeof window !== "undefined" ? window.location.pathname : null,
        message: form.message.trim(),
      });

      setSubmitted(true);
      setForm(initialForm);
      toast({
        title: "Питання надіслано",
        description: "Менеджер отримав повідомлення в Telegram і відповість вам на email.",
      });
    } catch (error) {
      console.error("Question submit error:", error);
      toast({
        variant: "destructive",
        title: "Помилка надсилання",
        description: "Спробуйте ще раз трохи пізніше або напишіть нам у Telegram.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-6 md:p-8 lg:p-10 shadow-sm">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-4">
                <MessageSquareMore className="h-4 w-4" />
                Задати запитання менеджеру
              </div>
              <h2 className="font-heading text-3xl lg:text-4xl tracking-tight mb-4">
                Поставте запитання й отримайте відповідь від менеджера
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Ваше повідомлення одразу надходить у Telegram-групу команди. Менеджер зможе натиснути кнопку
                «Відповісти» та надіслати вам відповідь на email.
              </p>

              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <SendHorizontal className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p>Питання потрапляє менеджеру безпосередньо після відправки форми.</p>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p>Для відповіді достатньо вашого email. Телефон або Telegram можна залишити додатково.</p>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
                <h3 className="font-heading text-2xl mb-3">Дякуємо, ваше питання надіслано</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Менеджер уже отримав звернення в Telegram. Відповідь надійде на вказаний email, а якщо ви залишили
                  телефон або Telegram — з вами можуть зв’язатися й цим способом.
                </p>
                <Button className="mt-6" variant="outline" onClick={() => setSubmitted(false)}>
                  Поставити ще одне запитання
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-background/80 p-6 md:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Ім'я *</Label>
                    <Input
                      value={form.firstName}
                      onChange={handleChange("firstName")}
                      className="mt-2"
                      placeholder="Як до вас звертатися"
                    />
                  </div>
                  <div>
                    <Label>Email для відповіді *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={handleChange("email")}
                      className="mt-2"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Телефон</Label>
                    <Input
                      value={form.phone}
                      onChange={handleChange("phone")}
                      className="mt-2"
                      placeholder="+380 50 123 45 67"
                    />
                  </div>
                  <div>
                    <Label>Telegram</Label>
                    <Input
                      value={form.telegram}
                      onChange={handleChange("telegram")}
                      className="mt-2"
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div>
                  <Label>Ваше запитання *</Label>
                  <Textarea
                    value={form.message}
                    onChange={handleChange("message")}
                    className="mt-2 min-h-36"
                    placeholder="Коротко опишіть ситуацію, щоб менеджер міг швидше зорієнтуватися."
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Натискаючи кнопку, ви надсилаєте запит менеджеру FinOK для зворотного зв’язку.
                  </p>
                  <Button type="submit" disabled={loading} className="sm:min-w-52">
                    {loading ? "Надсилаємо..." : "Надіслати запитання"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}