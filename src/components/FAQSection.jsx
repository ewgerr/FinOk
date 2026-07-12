import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQSection({ items }) {
  if (!items?.length) return null;
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="font-heading text-3xl lg:text-4xl mb-10">Часті запитання</h2>
        <Accordion type="single" collapsible className="space-y-2">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-md px-5">
              <AccordionTrigger className="text-sm font-medium text-foreground/90 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}