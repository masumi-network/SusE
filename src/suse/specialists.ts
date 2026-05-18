export type SpecialistSlug = "lexi" | "emil-conrad" | "diddy-p" | "food-co2-analyst";

export type Specialist = {
  slug: SpecialistSlug;
  name: string;
  focus: string;
  keywords: string[];
};

export const SPECIALISTS: Specialist[] = [
  {
    slug: "lexi",
    name: "Lexi",
    focus: "supply-chain sustainability analysis and sustainability risk identification",
    keywords: [
      "supplier",
      "supply chain",
      "procurement",
      "sourcing",
      "traceability",
      "vendor",
      "risk",
      "scope 3",
      "materials"
    ]
  },
  {
    slug: "emil-conrad",
    name: "Emil-Conrad",
    focus: "legally compliant sustainability communication under EmpCo and UWG",
    keywords: [
      "claim",
      "greenwashing",
      "compliance",
      "legal",
      "advertising",
      "communication",
      "uwg",
      "empco",
      "label",
      "marketing"
    ]
  },
  {
    slug: "diddy-p",
    name: "Diddy P.",
    focus: "Digital Product Passport guidance",
    keywords: [
      "digital product passport",
      "dpp",
      "passport",
      "espr",
      "battery passport",
      "product passport",
      "data carrier"
    ]
  },
  {
    slug: "food-co2-analyst",
    name: "Food CO2 Analyst",
    focus: "food product CO2 footprint calculations",
    keywords: [
      "food",
      "recipe",
      "ingredient",
      "meal",
      "co2",
      "carbon footprint",
      "emission factor",
      "kg co2e",
      "beverage"
    ]
  }
];

export function selectSpecialistsForMessage(message: string): Specialist[] {
  const normalized = message.toLowerCase();
  const selected = SPECIALISTS.filter((specialist) =>
    specialist.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (selected.length > 0) return selected;

  if (/\bsustainab|carbon|emission|climate|esg|csrd|lca\b/i.test(message)) {
    return SPECIALISTS.filter((specialist) => specialist.slug === "lexi" || specialist.slug === "emil-conrad");
  }

  return [SPECIALISTS[0]!];
}

