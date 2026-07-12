import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, Star, PenLine } from "lucide-react";
import ReviewForm from "@/components/ReviewForm";

const fallbackTestimonials = [
  { id: "f1", name: "Олена К.", role: "ФОП, 2-а група", text: "ФінОк зареєстрував мій ФОП за 2 дні. Все пояснили простою мовою, без зайвого стресу.", rating: 5 },
  { id: "f2", name: "Андрій М.", role: "Директор ТОВ", text: "Нарешті бачу реальну картину бізнесу. Управлінський облік від ФінОк — це як окуляри для власника.", rating: 5 },
  { id: "f3", name: "Марія С.", role: "Отримувач гранту", text: "Допомогли підготувати бізнес-план для «Власної справи». Грант отримала з першої спроби!", rating: 5 },
];

function StarRow({ rating = 5 }) {
  return (
    <div className="flex gap-0.5 mb-4">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
        />
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Lazy-load from backend on first render
  useState(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  });

  const displayed = (reviews && reviews.length > 0) ? reviews : fallbackTestimonials;

  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Відгуки</p>
            <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Що кажуть клієнти</h2>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded text-sm text-foreground/70 hover:border-primary/40 hover:text-primary transition-colors shrink-0"
          >
            <PenLine className="w-4 h-4" />
            Залишити відгук
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displayed.map((t, i) => (
              <motion.div
                key={t.id || i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 lg:p-8 border border-border rounded-md"
              >
                <Quote className="w-5 h-5 text-primary/30 mb-3" />
                <StarRow rating={t.rating} />
                <p className="text-sm text-foreground/80 leading-relaxed mb-6">{t.text}</p>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Review form modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="w-full max-w-lg bg-background border border-border rounded-lg shadow-xl"
              >
                <ReviewForm onClose={() => setShowForm(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}