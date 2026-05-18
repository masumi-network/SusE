export type SpecialistSlug = "lexi" | "emil-conrad" | "diddy-p" | "food-co2-analyst";

export type Specialist = {
  slug: SpecialistSlug;
  name: string;
  focus: string;
  useWhen: string[];
  doNotUseWhen: string[];
  keywords: string[];
};

export const SPECIALISTS: Specialist[] = [
  {
    slug: "lexi",
    name: "Lexi",
    focus: "supply-chain sustainability analysis and sustainability risk identification",
    useWhen: [
      "supplier, vendor, sourcing, procurement, traceability, Scope 3, or due-diligence questions",
      "supply-chain sustainability risk identification",
      "material sourcing and supplier evidence gaps"
    ],
    doNotUseWhen: [
      "the request is only a food CO2 calculation",
      "the request is only green-claim wording/compliance",
      "the request is only Digital Product Passport field mapping"
    ],
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
    useWhen: [
      "green claims, greenwashing, advertising, labels, consumer-facing wording, or legal/compliance review",
      "EmpCo, UWG, substantiation, evidence, or market communication questions"
    ],
    doNotUseWhen: [
      "the request is only a numeric CO2 calculation with no claim or wording review",
      "the request is only supplier/procurement risk",
      "the request is only DPP schema/field planning"
    ],
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
    useWhen: [
      "Digital Product Passport, DPP, ESPR, battery passport, data carrier, or product-passport field questions",
      "DPP readiness, data model, or evidence mapping"
    ],
    doNotUseWhen: [
      "the request is only a CO2 calculation",
      "the request is only green-claim wording/compliance",
      "the request is only supplier/procurement risk without product-passport requirements"
    ],
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
    useWhen: [
      "CO2, CO2e, carbon-footprint, LCA, emission-factor, or footprint calculations for food, recipes, meals, beverages, or ingredients",
      "the user explicitly asks for the CO2 analyst/CO2 agent"
    ],
    doNotUseWhen: [
      "the request is only supplier/procurement risk with no footprint calculation",
      "the request is only legal claim wording/compliance with no footprint calculation",
      "the request is only Digital Product Passport planning"
    ],
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
  const normalized = normalizeForRouting(message);
  const scored = SPECIALISTS.map((specialist) => ({
    specialist,
    score: scoreSpecialist(specialist.slug, normalized)
  }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || priority(left.specialist.slug) - priority(right.specialist.slug));

  if (scored.length > 0) {
    return scored.map((entry) => entry.specialist);
  }

  if (isCo2CalculationIntent(normalized)) return [getSpecialist("food-co2-analyst")];
  if (isGenericSustainabilityIntent(normalized)) return [getSpecialist("lexi")];
  return [getSpecialist("lexi")];
}

function scoreSpecialist(slug: SpecialistSlug, message: string): number {
  switch (slug) {
    case "lexi":
      if (!isSupplyChainIntent(message)) return 0;
      return score(message, {
        strong: [/\b(supplier|suppliers|vendor|vendors|procurement|sourcing|supply chain|scope 3|traceability)\b/],
        positive: [/\b(due diligence|risk|risks|audit|factory|factories|raw materials?|materials?|certification|deforestation)\b/],
        negative: foodCo2NegativePatterns()
      });
    case "emil-conrad":
      if (!isClaimComplianceIntent(message)) return 0;
      return score(message, {
        strong: [/\b(claim|claims|greenwashing|compliance|legal|advertising|marketing|label|labels|uwg|empco|substantiation)\b/],
        positive: [/\b(wording|communication|consumer|carbon neutral|eco[- ]?friendly|100% sustainable|risk|risky)\b/],
        negative: [/^\s*(calculate|estimate|compute)\b/]
      });
    case "diddy-p":
      if (!isDppIntent(message)) return 0;
      return score(message, {
        strong: [/\b(dpp|digital product passport|product passport|battery passport|espr|data carrier)\b/],
        positive: [/\b(passport fields?|readiness|data model|qr code|evidence mapping)\b/],
        negative: foodCo2NegativePatterns()
      });
    case "food-co2-analyst":
      if (!isFoodCo2Intent(message) && !isExplicitCo2AgentIntent(message)) return 0;
      return score(message, {
        strong: [
          /\b(co2|co₂|co2e|carbon footprint|kg co2e|emission factor|emissions?|lca|life cycle assessment|footprint)\b/,
          /\b(food|recipe|ingredient|ingredients|meal|dish|menu|beverage|drink|pasta|dairy|meat|coffee|cocoa|restaurant)\b/
        ],
        positive: [/\b(calculate|estimate|compute|serving|portion|product footprint|per kg|per serving)\b/],
        negative: [/\b(supplier risk|procurement risk|dpp|digital product passport|product passport|legal wording)\b/]
      });
  }
}

function score(
  message: string,
  {
    strong,
    positive,
    negative
  }: {
    strong: RegExp[];
    positive: RegExp[];
    negative: RegExp[];
  }
): number {
  const strongScore = strong.filter((pattern) => pattern.test(message)).length * 3;
  const positiveScore = positive.filter((pattern) => pattern.test(message)).length;
  const negativeScore = negative.filter((pattern) => pattern.test(message)).length * 2;
  return Math.max(0, strongScore + positiveScore - negativeScore);
}

function isSupplyChainIntent(message: string): boolean {
  return /\b(supplier|suppliers|vendor|vendors|procurement|sourcing|supply chain|scope 3|traceability|due diligence)\b/.test(
    message
  );
}

function isClaimComplianceIntent(message: string): boolean {
  return /\b(claim|claims|greenwashing|compliance|legal|advertising|marketing|label|labels|uwg|empco|substantiation|wording|consumer|carbon neutral|eco[- ]?friendly|100% sustainable)\b/.test(
    message
  );
}

function isDppIntent(message: string): boolean {
  return /\b(dpp|digital product passport|product passport|battery passport|espr|data carrier|passport fields?)\b/.test(
    message
  );
}

function isFoodCo2Intent(message: string): boolean {
  return isFoodContext(message) && isCo2CalculationIntent(message);
}

function isFoodContext(message: string): boolean {
  return /\b(food|recipe|ingredient|ingredients|meal|dish|menu|beverage|drink|pasta|dairy|meat|coffee|cocoa|restaurant)\b/.test(
    message
  );
}

function isCo2CalculationIntent(message: string): boolean {
  return /\b(co2|co₂|co2e|carbon footprint|kg co2e|emission factor|emissions?|lca|life cycle assessment|footprint|calculate emissions?|estimate emissions?)\b/.test(
    message
  );
}

function isExplicitCo2AgentIntent(message: string): boolean {
  return /\b(co2 agent|co₂ agent|co2 analyst|co₂ analyst|carbon footprint analyst|emissions analyst)\b/.test(message);
}

function isGenericSustainabilityIntent(message: string): boolean {
  return /\b(sustainability|sustainable|climate|esg|csrd|environmental)\b/.test(message);
}

function foodCo2NegativePatterns(): RegExp[] {
  return [/\b(recipe|ingredient|ingredients|meal|dish|menu|beverage|pasta)\b.*\b(co2|co₂|co2e|carbon footprint|emission factor|footprint)\b/];
}

function getSpecialist(slug: SpecialistSlug): Specialist {
  const specialist = SPECIALISTS.find((candidate) => candidate.slug === slug);
  if (!specialist) throw new Error(`Missing specialist: ${slug}`);
  return specialist;
}

function priority(slug: SpecialistSlug): number {
  return ["food-co2-analyst", "emil-conrad", "diddy-p", "lexi"].indexOf(slug);
}

function normalizeForRouting(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}
