import { User, Building2, Monitor, Heart, TrendingUp, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import { serviceCategories } from "../lib/servicesData";

const iconMap = { User, Building2, Monitor, Heart, TrendingUp, Briefcase };

export default function ForWhoSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Для кого</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Працюємо з тими, хто йде своїм шляхом</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceCategories.map((s, i) => {
            const Icon = iconMap[s.icon] || User;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="group p-6 border border-border rounded-md hover:border-primary/30 hover:bg-card transition-all duration-300"
              >
                <Icon className="w-5 h-5 text-primary mb-4" />
                <h3 className="font-heading text-lg mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}