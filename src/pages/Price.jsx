import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serviceCategories, allServices } from "../lib/servicesData";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function Price() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleBook = (service) => {
    const params = new URLSearchParams({
      category: service.category,
      service: service.name,
    });
    navigate(`/zapis?${params.toString()}`);
  };

  const filtered = allServices.filter(s => {
    const matchCat = filter === "all" || s.category === filter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const categories = ["all", ...serviceCategories.map(c => c.shortTitle)];

  return (
    <div className="pt-24">
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Прайс-лист</p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-tight mb-4">Вартість послуг</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-12">
            Прозорі ціни без прихованих платежів. Вартість фіксується у договорі.
          </p>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пошук послуги..."
                className="pl-10 bg-card border-border"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`px-4 py-2 text-xs rounded border transition-colors ${
                    filter === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {c === "all" ? "Усі" : c}
                </button>
              ))}
            </div>
          </div>

          {/* Services table */}
          <div className="space-y-3">
            {filtered.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border border-border rounded-md hover:border-primary/20 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-sm font-medium">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-heading text-primary whitespace-nowrap">{s.price}</span>
                  <button
                    onClick={() => handleBook(s)}
                    className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-primary transition-colors"
                  >
                    Записатися <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Послуг за вашим запитом не знайдено</p>
          )}
        </div>
      </section>
    </div>
  );
}