import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  { name: "Олена К.", role: "ФОП, 2-а група", text: "ФінОк зареєстрував мій ФОП за 2 дні. Все пояснили простою мовою, без зайвого стресу." },
  { name: "Андрій М.", role: "Директор ТОВ", text: "Нарешті бачу реальну картину бізнесу. Управлінський облік від ФінОк — це як окуляри для власника." },
  { name: "Марія С.", role: "Отримувач гранту", text: "Допомогли підготувати бізнес-план для «Власної справи». Грант отримала з першої спроби!" },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Відгуки</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Що кажуть клієнти</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 lg:p-8 border border-border rounded-md"
            >
              <Quote className="w-5 h-5 text-primary/30 mb-4" />
              <p className="text-sm text-foreground/80 leading-relaxed mb-6">{t.text}</p>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}