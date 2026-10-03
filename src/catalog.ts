/** Pick lists shown on the Edit tab. Anything not listed can still be typed in. */

export const BIKE_BRANDS = [
  "Aventon",
  "Bianchi",
  "BMC",
  "Cannondale",
  "Cervélo",
  "Co-op Cycles",
  "Diamondback",
  "Electra",
  "Felt",
  "Fuji",
  "Giant",
  "GT",
  "Guardian",
  "Huffy",
  "Hyper",
  "Ibis",
  "Jamis",
  "Kent",
  "Kona",
  "Lectric",
  "Liv",
  "Marin",
  "Mongoose",
  "Orbea",
  "Ozark Trail",
  "Pinarello",
  "Pivot",
  "Priority",
  "Rad Power Bikes",
  "Raleigh",
  "Razor",
  "Retrospec",
  "Salsa",
  "Santa Cruz",
  "Schwinn",
  "Scott",
  "Sixthreezero",
  "Specialized",
  "Surly",
  "Trek",
  "Yeti",
] as const;

type Brand = (typeof BIKE_BRANDS)[number];

/** Current and recent model lines sold in the US, per brand. Trims and sizes are left to the typed-in "Other". */
export const BIKE_MODELS: Record<Brand, readonly string[]> = {
  Aventon: ["Abound", "Aventure", "Level", "Pace 350", "Pace 500", "Ramblas", "Sinch", "Soltera"],
  Bianchi: ["Arcadex", "Aria", "Impulso", "Infinito", "Methanol", "Oltre", "Specialissima", "Sprint", "Via Nirone 7"],
  BMC: ["Alpenchallenge", "Fourstroke", "Kaius", "Roadmachine", "Speedfox", "Teammachine", "Timemachine", "Twostroke", "URS"],
  Cannondale: ["Adventure", "Bad Boy", "CAAD Optimo", "CAAD13", "Cujo", "Habit", "Jekyll", "Moterra", "Quick", "Scalpel", "SuperSix EVO", "Synapse", "Tesoro", "Topstone", "Trail", "Treadwell"],
  "Cervélo": ["Áspero", "Caledonia", "P-Series", "P5", "R5", "Rouvida", "S5", "Soloist", "ZFS-5"],
  "Co-op Cycles": ["ADV", "ARD", "CTY", "CTY e", "DRT", "Generation", "REV"],
  Diamondback: ["Atroz", "Catch", "Clarity", "Haanjo", "Hook", "Insight", "Overdrive", "Recoil", "Release", "Response", "Sync'r"],
  Electra: ["Cruiser 1", "Cruiser 7D", "Cruiser Lux", "Loft 7D", "Townie 7D", "Townie Go!", "Townie Path"],
  Felt: ["AR", "Breed", "Broam", "Compulsion", "Decree", "FR", "IA", "Verza Speed", "VR"],
  Fuji: ["Absolute", "Crosstown", "Declaration", "Feather", "Jari", "Nevada", "Palisade", "Roubaix", "Sportif", "Transonic", "Traverse"],
  Giant: ["Anthem", "ATX", "Contend", "Cypress", "Defy", "Escape", "Explore E+", "Fastroad", "Fathom", "Propel", "Reign", "Revolt", "Roam", "Sedona", "Stance", "Talon", "TCR", "Trance"],
  GT: ["Aggressor", "Avalanche", "Force", "Fury", "Grade", "Laguna", "Mach One", "Palomar", "Pantera", "Performer", "Sensor", "Slammer", "Transeo", "Verb", "Zaskar"],
  Guardian: ["Balance bike", "Ethos 16", "Ethos 20", "Ethos 24", "Ethos 26", "Original 16", "Original 20"],
  Huffy: ["Cranbrook", "Hyde Park", "Incline", "Nel Lusso", "Rock Creek", "Rock It", "Sea Star", "So Sweet", "Stone Mountain"],
  Hyper: ["E-Ride", "Explorer", "Havoc", "Jet Fuel", "Shocker", "Spinner"],
  Ibis: ["Exie", "Hakka MX", "HD6", "Mojo", "Oso", "Ripley", "Ripmo"],
  Jamis: ["Allegro", "Citizen", "Coda", "Dragon", "Durango", "Faultline", "Hudson", "Renegade", "Sequel", "Trail X", "Ventura"],
  Kent: ["Bayside", "Flexor", "Northwoods", "Rockvale", "Springdale", "Thruster"],
  Kona: ["Big Honzo", "Coco", "Dew", "Dr. Dew", "Honzo", "Lanai", "Libre", "Mahuna", "Process", "Remote", "Rove", "Sutra", "Unit", "Ute", "Wozo"],
  Lectric: ["ONE", "XP 3.0", "XP Lite", "XP Trike", "XPeak", "XPress"],
  Liv: ["Alight", "Avail", "Devote", "Embolden", "Intrigue", "Langma", "Pique", "Rove", "Tempt", "Thrive"],
  Marin: ["Alpine Trail", "Bobcat Trail", "Bolinas Ridge", "DSX", "Fairfax", "Four Corners", "Gestalt", "Hawk Hill", "Headlands", "Larkspur", "Muirwoods", "Nicasio", "Pine Mountain", "Presidio", "Rift Zone", "San Quentin", "San Rafael", "Sausalito", "Stinson", "Wildcat Trail"],
  Mongoose: ["Dolomite", "Excursion", "Grit", "Impasse", "Ledge", "Legion", "Malus", "Rockadile", "Salvo", "Status", "Switchback", "Title", "Tyax"],
  Orbea: ["Alma", "Avant", "Carpe", "Diem", "Gain", "Kemen", "Laufey", "Occam", "Oiz", "Orca", "Rallon", "Rise", "Terra", "Vector", "Wild"],
  "Ozark Trail": ["G.1 Explorer", "Glide", "Ridge"],
  Pinarello: ["Dogma F", "F5", "F7", "F9", "Grevil", "Nytro", "X3"],
  Pivot: ["E-Vault", "Firebird", "Les", "Mach 4 SL", "Mach 5.5", "Mach 6", "Shuttle", "Switchblade", "Trail 429", "Vault"],
  Priority: ["600", "Classic Plus", "Continuum Onyx", "Current", "Embark", "Gotham"],
  "Rad Power Bikes": ["RadCity", "RadExpand", "RadMission", "RadRover", "RadRunner", "Radster", "RadWagon"],
  Raleigh: ["Cadent", "Circa", "Detour", "Merit", "Redux", "Retroglide", "Talus", "Tokul", "Venture", "Willard"],
  Razor: ["Agitator", "High Roller", "Kobra", "Nebula"],
  Retrospec: ["Amok", "Beaumont", "Chatham", "Cub", "Harper", "Judd", "Koda", "Speck", "Valen"],
  Salsa: ["Beargrease", "Blackthorn", "Cutthroat", "Fargo", "Horsethief", "Journeyer", "Journeyman", "Marrakesh", "Mukluk", "Stormchaser", "Timberjack", "Vaya", "Warbird"],
  "Santa Cruz": ["5010", "Blur", "Bronson", "Chameleon", "Heckler", "Hightower", "Megatower", "Nomad", "Stigmata", "Tallboy", "V10", "Vala"],
  Schwinn: ["Admiral", "Axum", "Bonafide", "Collegiate", "Discover", "Elm", "Huron", "Hurricane", "Koen", "Loop", "Mesa", "Sanctuary", "Sidewinder", "Suburban", "Taff", "Traxion", "Voyageur", "Wayfarer"],
  Scott: ["Addict", "Aspect", "Contessa", "Foil", "Genius", "Metrix", "Patron", "Ransom", "Scale", "Spark", "Speedster", "Strike", "Sub Cross", "Sub Tour"],
  Sixthreezero: ["Around the Block", "Body Balance", "EVRYjourney", "Pave n' Trail"],
  Specialized: ["Aethos", "Allez", "Ariel", "Chisel", "Crosstrail", "Crux", "Demo", "Diverge", "Enduro", "Epic", "Expedition", "Fuse", "Hardrock", "Hotrock", "Jett", "Kenevo", "Pitch", "Riprock", "Rockhopper", "Roll", "Roubaix", "Sirrus", "Status", "Stumpjumper", "Tarmac", "Turbo Como", "Turbo Levo", "Turbo Vado"],
  Surly: ["Big Dummy", "Big Easy", "Bridge Club", "Cross-Check", "Disc Trucker", "Ghost Grappler", "Grappler", "Karate Monkey", "Krampus", "Long Haul Trucker", "Lowside", "Midnight Special", "Moonlander", "Ogre", "Pack Rat", "Preamble", "Straggler", "Troll", "Wednesday"],
  Trek: ["520", "820", "Allant+", "Checkmate", "Checkpoint", "District", "Domane", "Dual Sport", "Émonda", "Fetch+", "Fuel EX", "FX", "Madone", "Marlin", "Powerfly", "Precaliber", "Procaliber", "Rail", "Remedy", "Roscoe", "Session", "Slash", "Supercaliber", "Top Fuel", "Verve", "Wahoo", "X-Caliber"],
  Yeti: ["160E", "ARC", "ASR", "SB120", "SB130", "SB135", "SB140", "SB150", "SB160", "SB165"],
};

export function modelsFor(brand: string): readonly string[] {
  return (BIKE_MODELS as Record<string, readonly string[]>)[brand] ?? [];
}

export const COMMON_SERVICES = [
  "Basic tune-up",
  "Full tune-up / overhaul",
  "Safety inspection",
  "Flat tire repair",
  "Tube replacement",
  "Tire replacement",
  "Brake adjustment",
  "Brake pad replacement",
  "Brake cable replacement",
  "Hydraulic brake bleed",
  "Gear / derailleur adjustment",
  "Shifter cable replacement",
  "Derailleur hanger alignment",
  "Chain clean & lube",
  "Chain replacement",
  "Cassette / freewheel replacement",
  "Wheel truing",
  "Spoke replacement",
  "Hub overhaul",
  "Bottom bracket service",
  "Headset adjustment",
  "Crank / pedal install",
  "Saddle & seatpost adjustment",
  "Grips / bar tape install",
  "Accessory install",
  "Bike assembly",
  "E-bike check",
  "Wash & degrease",
] as const;

export const COMMON_PARTS = [
  "Tire",
  "Tube",
  "Rim tape",
  "Valve core",
  "Spoke",
  "Front wheel",
  "Rear wheel",
  "Hub",
  "Brake pads",
  "Disc brake rotor",
  "Brake cable & housing",
  "Brake lever",
  "Brake caliper",
  "Shifter cable & housing",
  "Shifter",
  "Chain",
  "Cassette",
  "Freewheel",
  "Chainring",
  "Crankset",
  "Bottom bracket",
  "Rear derailleur",
  "Front derailleur",
  "Derailleur hanger",
  "Headset",
  "Stem",
  "Handlebar",
  "Seatpost",
  "Seatpost clamp",
] as const;

export const COMMON_ACCESSORIES = [
  "Helmet",
  "Front light",
  "Rear light",
  "Light set",
  "U-lock",
  "Cable lock",
  "Bell",
  "Water bottle",
  "Bottle cage",
  "Kickstand",
  "Fenders",
  "Rear rack",
  "Basket",
  "Pannier bag",
  "Saddle bag",
  "Phone mount",
  "Bike computer",
  "Mirror",
  "Reflectors",
  "Floor pump",
  "Mini pump",
  "CO2 inflator",
  "Patch kit",
  "Tire levers",
  "Multi-tool",
  "Grips",
  "Handlebar tape",
  "Saddle",
  "Seat cover",
  "Pedals",
  "Chain lube",
  "Tube sealant",
  "Child seat",
  "Gloves",
] as const;

/** Splits "Specialized Expedition" into a listed brand and the rest. */
export function splitBike(description: string, brands: readonly string[] = BIKE_BRANDS): { brand: string; model: string } {
  const lower = description.toLowerCase();
  const brand = [...brands]
    .sort((a, b) => b.length - a.length)
    .find((b) => lower === b.toLowerCase() || lower.startsWith(`${b.toLowerCase()} `));
  return brand
    ? { brand, model: description.slice(brand.length).trimStart() }
    : { brand: "", model: description };
}

/** Model part of a bike whose brand was typed in; the brand is kept separately, so nothing is guessed from the text. */
export function typedBikeModel(description: string, typedBrand: string): string {
  const brand = typedBrand.trim();
  if (!brand) return description;
  if (description === brand) return "";
  return description.startsWith(`${brand} `) ? description.slice(brand.length + 1) : description;
}

/** A picked brand with no model yet keeps a trailing space so the model can be typed straight after it. */
export function joinBike(brand: string, model: string): string {
  if (!brand) return model.trimStart();
  return `${brand} ${model.trimStart()}`;
}
