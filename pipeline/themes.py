"""How published research is sorted into the 20 sustainability themes.

A paper counts as sustainability research when either:
  - its title or abstract uses one of the STRONG_TERMS ("climate change", "biodiversity", ...), or
  - it mentions a concrete sustainability topic (a CONTENT theme phrase) and also either says
    "sustainable"/"sustainability" or OpenAlex confidently tags it with an environmental UN goal.
It is then given every theme whose phrases appear in it. Values and Skills themes are only given
to papers that also match a Content theme, so a business paper that says "stakeholders" once
doesn't end up in the network.

Phrases are matched as whole words, case-insensitively. A trailing * matches any ending,
so "renewable*" matches "renewable" and "renewables". Edit these lists to tune the results.
"""

import re

# UN Sustainable Development Goals that mark a paper as sustainability research on their own,
# when OpenAlex is at least this confident in the tag
RELEVANCE_SDGS = {2, 6, 7, 11, 12, 13, 14, 15}
SDG_MIN_SCORE = 0.6

# Papers mostly about these (e.g. "tumor ecology") need a STRONG_TERM to count
OFF_TOPIC_CONTEXT = ["tumor*", "tumour*", "cancer*", "immune", "immuno*", "patient*", "clinical*", "neuron*",
                     "cosmolog*", "galax*"]

# Words that suggest sustainability but are too general on their own
WEAK_TERMS = ["sustainab*"]

# Any of these in the title or abstract marks a paper as sustainability research
STRONG_TERMS = [
    "climate change", "climate crisis", "global warming", "greenhouse gas*", "carbon emission*",
    "decarboni*", "renewable energ*", "net zero", "net-zero", "biodiversity", "ecosystem service*",
    "environmental justice", "climate justice", "energy justice", "circular economy", "life cycle assessment",
    "life-cycle assessment", "anthropocene", "climate adaptation", "climate resilience", "sea level rise",
    "sea-level rise", "clean energy", "carbon capture", "carbon sequestration", "plastic pollution",
    "microplastic*", "food security", "environmental sustainability", "sustainable development goals",
]

CONTENT_THEMES = ["International Governance", "Local and National Governance", "Biosphere", "Sustainable Food Systems",
                  "Economics", "Air and Climate Science", "Decarbonization", "Sustainable Design", "Waste"]

THEME_TERMS = {
    # Values
    "Human Thriving": ["well-being of communit*", "community well-being", "human flourishing", "belonging",
                       "social inclusion", "inclusive communit*"],
    "Ethics": ["environmental ethic*", "climate ethic*", "moral responsibility", "corporate social responsibility",
               "social responsibility", "responsible innovation", "social good", "stewardship"],
    "Justice": ["environmental justice", "climate justice", "energy justice", "social justice", "human rights",
                "environmental racism", "frontline communit*", "just transition", "marginalized communit*"],
    "Preservation for Future Generations": ["future generations", "intergenerational", "ecological well-being",
                                            "long-term sustainability", "legacy pollut*"],
    "Equity": ["equit*", "inequalit*", "poverty", "low-income", "gender equality", "women's rights",
               "energy burden", "energy poverty", "affordab*"],
    "Physical Well-being": ["public health", "health impact*", "heat-related", "extreme heat", "mental health",
                            "air pollution exposure", "respiratory", "asthma", "exposure to pollut*"],
    # Content
    "International Governance": ["sustainable development goals", "paris agreement", "united nations",
                                 "international cooperation", "treaty", "treaties", "multilateral", "ngo*",
                                 "global governance", "climate negotiation*", "cop2*"],
    "Local and National Governance": ["climate polic*", "energy polic*", "environmental polic*",
                                      "carbon tax*", "carbon pric*", "municipal*", "state polic*", "federal polic*",
                                      "environmental regulation*", "incentive*", "environmental governance", "climate governance"],
    "Biosphere": ["biodiversity", "ecosystem*", "ecolog*", "endangered species", "invasive species", "species richness", "species diversity", "habitat*", "coral*", "wetland*",
                  "forests", "forestry", "deforestation", "conservation", "marine", "ocean*", "fisher*", "wildlife",
                  "anthropocene", "coastal"],
    "Sustainable Food Systems": ["food system*", "food security", "agricultur*", "crops", "crop yield*", "farming", "urban farm*",
                                 "vertical farm*", "aquaponic*", "hydroponic*", "organic farm*", "food waste",
                                 "aquaculture"],
    "Economics": ["circular economy", "natural capital", "externalit*", "limits to growth", "esg",
                  "green financ*", "sustainable financ*", "climate financ*", "carbon market*",
                  "environmental econom*", "economic cost of climate", "green bond*"],
    "Air and Climate Science": ["climate change", "global warming", "greenhouse gas*", "ghg", "carbon dioxide",
                                "co2 emission*", "methane", "air quality", "air pollut*", "aerosol*",
                                "particulate matter", "pm2.5", "climate model*", "atmospher*", "warming"],
    "Decarbonization": ["renewable*", "solar energy", "solar cell*", "solar power", "solar pv", "photovoltaic*", "wind energy", "wind power", "wind turbine*",
                        "decarboni*", "zero-carbon", "net zero", "net-zero", "low-carbon", "carbon capture",
                        "carbon removal", "carbon sequestration", "electric vehicle*", "battery", "batteries", "hydrogen",
                        "fuel cell*", "energy storage", "clean energy", "energy transition", "electrification",
                        "sustainable transport*", "public transit"],
    "Sustainable Design": ["green building*", "sustainable design", "sustainable material*", "built environment",
                           "smart cit*", "urban design", "energy-efficient building*", "building energy",
                           "biobased material*", "sustainable manufactur*", "green chemistry", "leed"],
    "Waste": ["waste*", "plastic*", "microplastic*", "recycl*", "reuse", "biodegradab*", "landfill*",
              "right to repair", "wastewater"],
    # Skills
    "Systems Thinking": ["systems thinking", "system dynamics", "socio-technical system*", "socio-ecological",
                         "social-ecological", "complex system*", "coupled human", "nexus"],
    "Life-cycle Thinking": ["life cycle assessment", "life-cycle assessment", "lca", "life cycle cost*",
                            "life-cycle cost*", "whole-life cost*", "cradle-to-grave", "embodied carbon",
                            "carbon footprint"],
    "Future Thinking": ["scenario*", "forecast*", "climate projection*", "backcasting", "future climate",
                        "decarbonization pathway*", "long-term planning"],
    "Interpersonal Competency": ["stakeholder engagement", "stakeholder*", "community engagement",
                                 "participatory", "science communication", "climate communication",
                                 "public engagement", "co-production", "mediation"],
    "Strategic Thinking": ["action plan*", "climate action plan*", "adaptation plan*", "strategic plan*",
                           "roadmap*", "decision-making", "decision support"],
}


def _compile(terms):
    parts = []
    for term in terms:
        escaped = re.escape(term.lower())
        parts.append(escaped[:-2] + r"\w*" if term.endswith("*") else escaped)
    return re.compile(r"\b(?:" + "|".join(parts) + r")\b")


STRONG_PATTERN = _compile(STRONG_TERMS)
WEAK_PATTERN = _compile(WEAK_TERMS)
OFF_TOPIC_PATTERN = _compile(OFF_TOPIC_CONTEXT)
THEME_PATTERNS = {theme: _compile(terms) for theme, terms in THEME_TERMS.items()}


def sdg_number(sdg):
    return int(sdg["id"].rstrip("/").rsplit("/", 1)[-1])


def classify(text, sdgs):
    """Return the sorted list of themes for a paper, or [] if it isn't sustainability research."""
    # Common technical phrases that would otherwise trigger themes (e.g. "random forests" -> Biosphere)
    text = re.sub(r"random forests?|solar wind|gene regulation|dark energy", " ", text.lower())
    themes = {theme for theme, pattern in THEME_PATTERNS.items() if pattern.search(text)}
    content = themes & set(CONTENT_THEMES)
    confident_sdg = any(sdg_number(s) in RELEVANCE_SDGS and s.get("score", 0) >= SDG_MIN_SCORE for s in sdgs)

    strong = bool(STRONG_PATTERN.search(text))
    supported = bool(content) and (confident_sdg or bool(WEAK_PATTERN.search(text))) \
        and not OFF_TOPIC_PATTERN.search(text)
    if not (strong or supported) or not content:
        return []
    return sorted(themes)
