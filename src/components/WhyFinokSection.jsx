import { motion } from "framer-motion";
import { MessageSquare, Banknote, BarChart3, Wifi } from "lucide-react";

const usps = [
  { icon: MessageSquare, title: "Мова власника", desc: "Пояснюємо фінанси без канцелярщини — у гривнях, строках та результатах." },
  { icon: Banknote, title: "Фіксована ціна", desc: "Ніяких прихованих платежів. Прайс — на сайті, ціна — у договорі." },
  { icon: BarChart3, title: "Результат у цифрах", desc: "Не просто звіти, а зрозуміла картина: P&L, Cash Flow, KPI." },
  { icon: Wifi, title: "100% онлайн", desc: "Вся Україна. Працюємо дистанційно, без зайвих зустрічей." },
];

export default function WhyFinokSection() {
  return (
    <section className="py-20 lg:py-32 bg-card">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Переваги</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Чому ФінОк</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-md overflow-hidden">
          {usps.map((u, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-card p-8 lg:p-12"
            >
              <u.icon className="w-6 h-6 text-primary mb-5" />
              <h3 className="font-heading text-xl mb-2">{u.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{u.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}