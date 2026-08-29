import { Link } from "react-router-dom";
import { serviceCategories } from "../lib/servicesData";
import { User, Building2, Monitor, Heart, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const iconMap = { User, Building2, Monitor, Heart, TrendingUp };

export default function ServicesOverview() {
  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Послуги</p>
          <h2 className="font-heading text-3xl lg:text-5xl tracking-tight">Повний спектр фінансового супроводу</h2>
        </div>
        <div className="space-y-4">
          {serviceCategories.map((cat, i) => {
            const Icon = iconMap[cat.icon] || User;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={cat.slug}
                  className="group flex items-center justify-between p-6 border border-border rounded-md hover:border-primary/30 hover:bg-card transition-all duration-300"
                >
                  <div className="flex items-center gap-5">
                    <Icon className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <h3 className="font-heading text-lg">{cat.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">{cat.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}