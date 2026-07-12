import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import FAQSection from "./FAQSection";
import ConsultationSection from "./ConsultationSection";

export default function ServicePageTemplate({ category }) {
  return (
    <div className="pt-24">
      {/* Header */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4">Послуги</p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-tight mb-4">{category.title}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">{category.description}</p>
        </div>
      </section>

      {/* Hairline */}
      <div className="max-w-7xl mx-auto px-6"><div className="border-t border-border" /></div>

      {/* Services list */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="space-y-4">
            {category.services.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group border border-border rounded-md p-6 lg:p-8 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-heading text-xl mb-2">{s.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-lg font-heading text-primary whitespace-nowrap">{s.price}</span>
                    <Link
                      to="/select-services"
                      className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-primary transition-colors"
                    >
                      Записатися <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <FAQSection items={category.faq} />
      <ConsultationSection preselectedCategory={category.shortTitle} />
    </div>
  );
}