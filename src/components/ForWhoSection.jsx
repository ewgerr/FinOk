import { User, Building2, Monitor, Heart, TrendingUp, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

const segments = [
  { icon: TrendingUp, label: "Власники бізнесу", desc: "Управлінський облік, P&L, KPI" },
  { icon: User, label: "Фізичні особи", desc: "Реєстрація, супровід, зміни, закриття" },
  { icon: Building2, label: "Юридичні особи", desc: "Від реєстрації до ліквідації" },
  { icon: Monitor, label: "IT-фахівці", desc: "ФОП 3 групи, Дія Сіті, гіг-контракти" },
  { icon: Heart, label: "НПО", desc: "ГО, БФ, неприбутковий статус" },
  { icon: Briefcase, label: "Грантоотримувачі", desc: "«Власна справа» та інші програми" },
];

export default function ForWhoSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Для кого</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Працюємо з тими, хто будує</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group p-6 border border-border rounded-md hover:border-primary/30 hover:bg-card transition-all duration-300"
            >
              <s.icon className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-heading text-lg mb-1">{s.label}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}