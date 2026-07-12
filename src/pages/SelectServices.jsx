import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Minus, Plus, ChevronDown, ArrowRight, ArrowLeft, X } from "lucide-react";
import { serviceCategories } from "../lib/servicesData";
import ConsultationForm from "../components/ConsultationForm";

// parse "від 1 500 ₴/міс" → 1500 (for total calc; "від" = starting price)
function parsePrice(str) {
  if (!str) return 0;
  const m = str.match(/([\d\s]+)\s*₴/);
  if (!m) return 0;
  return parseInt(m[1].replace(/\s/g, ""), 10);
}

export default function SelectServices() {
  const [selected, setSelected] = useState({}); // { serviceKey: qty }
  const [openCats, setOpenCats] = useState(() => Object.fromEntries(serviceCategories.map(c => [c.id, true])));
  const [step, setStep] = useState("select"); // select | form
  const [preselectedCategory, setPreselectedCategory] = useState("");
  const [preselectedServiceName, setPreselectedServiceName] = useState("");

  const flatServices = useMemo(() => serviceCategories.flatMap(c => c.services.map(s => ({ ...s, catId: c.id, catTitle: c.shortTitle, key: `${c.id}__${s.name}` }))), []);

  const selectedList = useMemo(() => flatServices.filter(s => selected[s.key] > 0), [flatServices, selected]);
  const totalCount = selectedList.reduce((sum, s) => sum + selected[s.key], 0);
  const totalPrice = selectedList.reduce((sum, s) => sum + parsePrice(s.price) * selected[s.key], 0);

  const toggle = (key) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = 1;
      return next;
    });
  };

  const changeQty = (key, delta) => {
    setSelected(prev => {
      const cur = prev[key] || 0;
      const nextVal = Math.max(0, cur + delta);
      const next = { ...prev };
      if (nextVal === 0) delete next[key]; else next[key] = nextVal;
      return next;
    });
  };

  const handleContinue = () => {
    if (totalCount === 0) return;
    // use first selected category as preselected in form
    const firstCat = serviceCategories.find(c => c.services.some(s => selected[`${c.id}__${s.name}`]));
    const firstService = selectedList[0] || null;
    setPreselectedCategory(firstCat?.shortTitle || "");
    setPreselectedServiceName(firstService?.name || "");
    setStep("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- STEP 2: form ----------
  if (step === "form") {
    return (
      <div className="pt-20 pb-32 min-h-screen">
        <div className="max-w-2xl mx-auto px-6">
          <button onClick={() => setStep("select")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Назад до вибору послуг
          </button>

          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Крок 2</p>
          <h1 className="font-heading text-3xl lg:text-4xl tracking-tight mb-3">Ваші контакти</h1>
          <p className="text-muted-foreground text-sm mb-10">Заповніть форму — ми зв'яжемося для підтвердження деталей.</p>

          {/* Selected summary */}
          <div className="border border-border rounded-md p-5 mb-10 bg-card">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Обрані послуги ({totalCount})</p>
            <div className="space-y-3">
              {selectedList.map(s => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.catTitle} × {selected[s.key]}</p>
                  </div>
                  <span className="text-primary whitespace-nowrap">{s.price}</span>
                </div>
              ))}
            </div>
            {totalPrice > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Орієнтовна вартість</span>
                <span className="font-heading text-xl text-primary">від {totalPrice.toLocaleString("uk-UA")} ₴</span>
              </div>
            )}
          </div>

          <ConsultationForm
            preselectedCategory={preselectedCategory}
            preselectedServiceName={preselectedServiceName}
          />
        </div>
      </div>
    );
  }

  // ---------- STEP 1: select ----------
  return (
    <div className="pt-20 pb-40 min-h-screen">
      <div className="max-w-2xl mx-auto px-6">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Назад
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">Крок 1</p>
        <h1 className="font-heading text-3xl lg:text-4xl tracking-tight mb-3">Оберіть послуги</h1>
        <p className="text-muted-foreground text-sm mb-10">Позначте послуги, які вас цікавлять. Можна обрати декілька.</p>

        {/* Categories */}
        <div className="space-y-3">
          {serviceCategories.map(cat => {
            const isOpen = openCats[cat.id];
            const catSelectedCount = cat.services.filter(s => selected[`${cat.id}__${s.name}`]).length;
            return (
              <div key={cat.id} className="border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setOpenCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-card transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-base">{cat.shortTitle}</span>
                    {catSelectedCount > 0 && (
                      <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{catSelectedCount}</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border border-t border-border">
                        {cat.services.map(s => {
                          const key = `${cat.id}__${s.name}`;
                          const qty = selected[key] || 0;
                          const isSelected = qty > 0;
                          return (
                            <div key={key} className={`px-5 py-4 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-card/50"}`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium leading-snug">{s.name}</h3>
                                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{s.description}</p>
                                  <p className="text-sm text-primary mt-2 font-heading">{s.price}</p>
                                </div>
                                <div className="shrink-0">
                                  {!isSelected ? (
                                    <button
                                      onClick={() => toggle(key)}
                                      className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                                      aria-label="Додати"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full p-1">
                                      <button onClick={() => changeQty(key, -1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors" aria-label="Менше">
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="text-sm font-medium w-6 text-center">{qty}</span>
                                      <button onClick={() => changeQty(key, 1)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors" aria-label="Більше">
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <AnimatePresence>
        {totalCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border"
          >
            <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Обрано: {totalCount} {totalCount === 1 ? "послуга" : "послуг"}</p>
                {totalPrice > 0 && (
                  <p className="font-heading text-lg text-primary">від {totalPrice.toLocaleString("uk-UA")} ₴</p>
                )}
              </div>
              <button
                onClick={handleContinue}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded hover:opacity-90 transition-opacity"
              >
                Продовжити <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}