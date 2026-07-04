export type Tier = 'high' | 'mid' | 'budget';

export interface Area {
  name: string;
  city: string;
  tier: Tier;
  note: string;
  country: string;
  lga?: string;
}

export const AREAS: Area[] = [

  // ════════════════════════════════════════════════
  // NIGERIA — LAGOS STATE (20 LGAs)
  // ════════════════════════════════════════════════

  // ── Eti-Osa LGA (Ikoyi · V/Island · Lekki · VGC · Ajah corridor) ──
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Ikoyi',              note: 'Wealthiest district · ₦800k–₦3M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Victoria Island',    note: 'Corporate & luxury · ₦600k–₦2M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Banana Island',      note: 'Ultra-premium gated island · ₦1M+' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Lekki Phase 1',      note: 'Growing premium belt · ₦400k–₦1.5M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'VGC (Victoria Garden City)', note: 'Gated estate · ₦400k–₦1.2M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Oniru Estate',       note: 'Premium waterfront · ₦500k–₦1.5M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'high',   name: 'Chevron',            note: 'Corporate & gated · ₦350k–₦1M' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'mid',    name: 'Ajah',               note: 'Fast-growing · ₦150k–₦400k' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'mid',    name: 'Sangotedo',          note: 'New estates · ₦150k–₦400k' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'mid',    name: 'Badore',             note: 'Lekki corridor · ₦150k–₦350k' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'mid',    name: 'Jakande Estate',     note: 'Lekki estate · ₦120k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Eti-Osa LGA',      tier: 'mid',    name: 'Ikate',              note: 'Lekki mid-belt · ₦150k–₦380k' },

  // ── Ibeju-Lekki LGA (Lekki Phase 2 · Awoyaya · Free Trade Zone corridor) ──
  { country: 'NG', city: 'Lagos', lga: 'Ibeju-Lekki LGA',  tier: 'mid',    name: 'Lekki Phase 2',      note: 'Developing market · ₦200k–₦500k' },
  { country: 'NG', city: 'Lagos', lga: 'Ibeju-Lekki LGA',  tier: 'mid',    name: 'Awoyaya',            note: 'Growing suburb · ₦150k–₦400k' },
  { country: 'NG', city: 'Lagos', lga: 'Ibeju-Lekki LGA',  tier: 'mid',    name: 'Abraham Adesanya',   note: 'New estates · ₦150k–₦380k' },
  { country: 'NG', city: 'Lagos', lga: 'Ibeju-Lekki LGA',  tier: 'budget', name: 'Bogije',             note: 'Outskirts growth · ₦60k–₦180k' },

  // ── Ikeja LGA (State capital · GRA · Allen · Maryland) ──
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'high',   name: 'Ikeja GRA',          note: 'State capital elite · ₦300k–₦800k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'high',   name: 'Omole Phase 1',      note: 'Educated professionals · ₦300k–₦800k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'high',   name: 'Omole Phase 2',      note: 'Premium estate · ₦300k–₦800k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Allen Avenue',       note: 'Commercial strip · ₦200k–₦500k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Maryland',           note: 'Commercial hub · ₦150k–₦400k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Alausa / Secretariat', note: 'Government belt · ₦150k–₦380k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Oregun',             note: 'Industrial & SME · ₦120k–₦320k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Opebi',              note: 'Growing commercial · ₦150k–₦380k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'mid',    name: 'Ilupeju',            note: 'Industrial & SME · ₦120k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikeja LGA',         tier: 'budget', name: 'Ikeja Central',      note: 'Busy market · ₦80k–₦200k' },

  // ── Kosofe LGA (Ketu · Ojota · Anthony · Ogudu · Mile 12) ──
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'high',   name: 'Magodo',             note: 'Educated middle class · ₦200k–₦500k' },
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'mid',    name: 'Ketu',               note: 'Transport hub · ₦100k–₦280k' },
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'mid',    name: 'Ojota',              note: 'Active commerce · ₦100k–₦270k' },
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'mid',    name: 'Anthony Village',    note: 'Commercial strip · ₦120k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'mid',    name: 'Ogudu',              note: 'Residential-commercial · ₦120k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Kosofe LGA',        tier: 'budget', name: 'Mile 12',            note: 'Fresh produce hub · ₦40k–₦120k' },

  // ── Shomolu LGA (Gbagada · Bariga) ──
  { country: 'NG', city: 'Lagos', lga: 'Shomolu LGA',       tier: 'mid',    name: 'Gbagada',            note: 'Residential-commercial · ₦150k–₦380k' },
  { country: 'NG', city: 'Lagos', lga: 'Shomolu LGA',       tier: 'budget', name: 'Bariga',             note: 'Waterfront market · ₦40k–₦120k' },

  // ── Ifako-Ijaiye LGA (Ogba · Ojodu Berger) ──
  { country: 'NG', city: 'Lagos', lga: 'Ifako-Ijaiye LGA',  tier: 'mid',    name: 'Ogba',               note: 'Growing commercial · ₦120k–₦320k' },
  { country: 'NG', city: 'Lagos', lga: 'Ifako-Ijaiye LGA',  tier: 'mid',    name: 'Ojodu Berger',       note: 'Satellite town · ₦100k–₦270k' },
  { country: 'NG', city: 'Lagos', lga: 'Ifako-Ijaiye LGA',  tier: 'budget', name: 'Ifako',              note: 'Dense residential · ₦50k–₦150k' },

  // ── Surulere LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Surulere LGA',      tier: 'mid',    name: 'Surulere',           note: 'Dense market · ₦100k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Surulere LGA',      tier: 'mid',    name: 'Aguda',              note: 'Established SMEs · ₦100k–₦280k' },
  { country: 'NG', city: 'Lagos', lga: 'Surulere LGA',      tier: 'budget', name: 'Ojuelegba',          note: 'Busy transport junction · ₦50k–₦150k' },

  // ── Lagos Mainland LGA (Yaba · Ebute-Metta · Oyingbo) ──
  { country: 'NG', city: 'Lagos', lga: 'Lagos Mainland LGA', tier: 'mid',   name: 'Yaba',               note: 'Tech hub & students · ₦100k–₦300k' },
  { country: 'NG', city: 'Lagos', lga: 'Lagos Mainland LGA', tier: 'mid',   name: 'Ebute-Metta',        note: 'Rail & commerce · ₦80k–₦230k' },
  { country: 'NG', city: 'Lagos', lga: 'Lagos Mainland LGA', tier: 'budget', name: 'Oyingbo',           note: 'Market town · ₦40k–₦120k' },

  // ── Lagos Island LGA (CMS · Marina · Balogun) ──
  { country: 'NG', city: 'Lagos', lga: 'Lagos Island LGA',  tier: 'mid',    name: 'CMS / Marina',       note: 'Old business district · ₦100k–₦280k' },
  { country: 'NG', city: 'Lagos', lga: 'Lagos Island LGA',  tier: 'budget', name: 'Idumota / Balogun',  note: 'High volume trading · ₦30k–₦100k' },
  { country: 'NG', city: 'Lagos', lga: 'Lagos Island LGA',  tier: 'budget', name: 'Isale Eko',          note: 'Old Lagos core · ₦30k–₦100k' },

  // ── Apapa LGA (Port district) ──
  { country: 'NG', city: 'Lagos', lga: 'Apapa LGA',         tier: 'mid',    name: 'Apapa',              note: 'Port & import trade · ₦150k–₦400k' },
  { country: 'NG', city: 'Lagos', lga: 'Apapa LGA',         tier: 'mid',    name: 'Ijora',              note: 'Industrial waterfront · ₦120k–₦320k' },

  // ── Amuwo-Odofin LGA (Festac · Satellite Town) ──
  { country: 'NG', city: 'Lagos', lga: 'Amuwo-Odofin LGA',  tier: 'mid',    name: 'Festac Town',        note: 'Civil servants & SMEs · ₦100k–₦280k' },
  { country: 'NG', city: 'Lagos', lga: 'Amuwo-Odofin LGA',  tier: 'mid',    name: 'Amuwo-Odofin',       note: 'Growing commercial · ₦100k–₦280k' },
  { country: 'NG', city: 'Lagos', lga: 'Amuwo-Odofin LGA',  tier: 'budget', name: 'Satellite Town',     note: 'Military estate suburb · ₦60k–₦160k' },

  // ── Oshodi-Isolo LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Oshodi-Isolo LGA',  tier: 'mid',    name: 'Isolo',              note: 'Light industrial SMEs · ₦80k–₦220k' },
  { country: 'NG', city: 'Lagos', lga: 'Oshodi-Isolo LGA',  tier: 'budget', name: 'Oshodi',             note: 'Trade hub · ₦50k–₦130k' },
  { country: 'NG', city: 'Lagos', lga: 'Oshodi-Isolo LGA',  tier: 'budget', name: 'Ejigbo',             note: 'Dense residential · ₦40k–₦120k' },

  // ── Alimosho LGA (Lagos' most populous) ──
  { country: 'NG', city: 'Lagos', lga: 'Alimosho LGA',      tier: 'budget', name: 'Ikotun',             note: 'High volume · ₦40k–₦120k' },
  { country: 'NG', city: 'Lagos', lga: 'Alimosho LGA',      tier: 'budget', name: 'Egbeda',             note: 'Dense market · ₦40k–₦120k' },
  { country: 'NG', city: 'Lagos', lga: 'Alimosho LGA',      tier: 'budget', name: 'Ipaja',              note: 'Price-sensitive · ₦40k–₦120k' },
  { country: 'NG', city: 'Lagos', lga: 'Alimosho LGA',      tier: 'budget', name: 'Ayobo',              note: 'Outskirts community · ₦30k–₦100k' },
  { country: 'NG', city: 'Lagos', lga: 'Alimosho LGA',      tier: 'budget', name: 'Idimu',              note: 'Budget market · ₦30k–₦100k' },

  // ── Mushin LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Mushin LGA',        tier: 'budget', name: 'Mushin',             note: 'Budget market · ₦30k–₦100k' },

  // ── Agege LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Agege LGA',         tier: 'budget', name: 'Agege',              note: 'Price-sensitive · ₦30k–₦100k' },
  { country: 'NG', city: 'Lagos', lga: 'Agege LGA',         tier: 'budget', name: 'Abule-Egba',         note: 'Fast-growing outskirts · ₦30k–₦100k' },

  // ── Ojo LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Ojo LGA',           tier: 'mid',    name: 'Alaba International Market', note: 'Electronics & goods hub · ₦80k–₦250k' },
  { country: 'NG', city: 'Lagos', lga: 'Ojo LGA',           tier: 'budget', name: 'Ojo',                note: 'Military suburb · ₦40k–₦120k' },

  // ── Ikorodu LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Ikorodu LGA',       tier: 'budget', name: 'Ikorodu',            note: 'Large market · ₦50k–₦150k' },
  { country: 'NG', city: 'Lagos', lga: 'Ikorodu LGA',       tier: 'budget', name: 'Ijede',              note: 'Ikorodu suburb · ₦40k–₦110k' },

  // ── Ajeromi-Ifelodun LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Ajeromi-Ifelodun LGA', tier: 'budget', name: 'Ajegunle',        note: 'Dense urban · ₦30k–₦90k' },

  // ── Epe LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Epe LGA',           tier: 'budget', name: 'Epe',                note: 'Outskirts growth · ₦40k–₦120k' },

  // ── Badagry LGA ──
  { country: 'NG', city: 'Lagos', lga: 'Badagry LGA',       tier: 'budget', name: 'Badagry',            note: 'Border town · ₦30k–₦100k' },

  // ════════════════════════════════════════════════
  // NIGERIA — FCT ABUJA (6 Area Councils)
  // ════════════════════════════════════════════════

  // ── Abuja Municipal Area Council (AMAC) ──
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Maitama',            note: 'Ministers & executives · ₦800k–₦3M' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Asokoro',            note: 'Government elite · ₦600k–₦2M' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Wuse 2',             note: 'Corporate hub · ₦400k–₦1.2M' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Jabi',               note: 'Premium retail & office · ₦400k–₦1M' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Utako',              note: 'Business district · ₦350k–₦900k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'high',   name: 'Life Camp',          note: 'Professional estates · ₦300k–₦800k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Garki',              note: 'Established business · ₦200k–₦500k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Wuse 1',             note: 'Commerce & embassies · ₦200k–₦500k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Gwarinpa',           note: 'Largest estate · ₦150k–₦400k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Gudu',               note: 'Commercial growth · ₦120k–₦320k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Galadimawa',         note: 'Emerging estates · ₦120k–₦300k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Karu',               note: 'Dense SME market · ₦100k–₦300k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'mid',    name: 'Lugbe',              note: 'Airport corridor · ₦100k–₦280k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'budget', name: 'Nyanya',             note: 'High-density suburb · ₦50k–₦150k' },
  { country: 'NG', city: 'Abuja', lga: 'AMAC',              tier: 'budget', name: 'Lokogoma',           note: 'Budget estates · ₦50k–₦150k' },

  // ── Bwari Area Council ──
  { country: 'NG', city: 'Abuja', lga: 'Bwari Area Council', tier: 'mid',   name: 'Kubwa',              note: 'Satellite town · ₦100k–₦250k' },
  { country: 'NG', city: 'Abuja', lga: 'Bwari Area Council', tier: 'budget', name: 'Mpape',             note: 'Outskirts community · ₦40k–₦120k' },

  // ── Gwagwalada Area Council ──
  { country: 'NG', city: 'Abuja', lga: 'Gwagwalada Area Council', tier: 'budget', name: 'Gwagwalada',   note: 'Satellite township · ₦40k–₦120k' },

  // ── Kuje Area Council ──
  { country: 'NG', city: 'Abuja', lga: 'Kuje Area Council', tier: 'budget', name: 'Kuje',              note: 'Rural township · ₦30k–₦100k' },

  // ════════════════════════════════════════════════
  // NIGERIA — RIVERS STATE (Port Harcourt)
  // ════════════════════════════════════════════════

  // ── Port Harcourt LGA (City centre & GRA) ──
  { country: 'NG', city: 'Port Harcourt', lga: 'Port Harcourt LGA',  tier: 'high',   name: 'GRA Phase 1',       note: 'Oil money elite · ₦500k–₦1.5M' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Port Harcourt LGA',  tier: 'high',   name: 'GRA Phase 2',       note: 'Corporate & affluent · ₦400k–₦1.2M' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Port Harcourt LGA',  tier: 'high',   name: 'Peter Odili Road',  note: 'Business strip · ₦300k–₦800k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Port Harcourt LGA',  tier: 'budget', name: 'Mile 1 Market',     note: 'Trade area · ₦50k–₦150k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Port Harcourt LGA',  tier: 'budget', name: 'Diobu',             note: 'Dense market · ₦40k–₦130k' },

  // ── Obio-Akpor LGA (Rumuola · Trans Amadi · Rumuokoro suburbs) ──
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'mid',    name: 'Trans Amadi',       note: 'Industrial/SME · ₦150k–₦400k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'mid',    name: 'Rumuola',           note: 'Commercial district · ₦150k–₦380k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'mid',    name: 'Rumuokoro',         note: 'Dense market · ₦100k–₦280k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'mid',    name: 'Woji',              note: 'Developing suburb · ₦120k–₦300k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'mid',    name: 'Elelenwo',          note: 'Upscale suburb · ₦150k–₦400k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'budget', name: 'Rumuigbo',          note: 'High volume market · ₦50k–₦150k' },
  { country: 'NG', city: 'Port Harcourt', lga: 'Obio-Akpor LGA',     tier: 'budget', name: 'Ozuoba',            note: 'Dense suburb · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ENUGU STATE
  // ════════════════════════════════════════════════

  // ── Enugu North LGA ──
  { country: 'NG', city: 'Enugu', lga: 'Enugu North LGA',   tier: 'high',   name: 'GRA, Enugu',         note: 'Premium clients · ₦300k–₦800k' },
  { country: 'NG', city: 'Enugu', lga: 'Enugu North LGA',   tier: 'mid',    name: 'Independence Layout', note: 'Established businesses · ₦150k–₦350k' },
  { country: 'NG', city: 'Enugu', lga: 'Enugu North LGA',   tier: 'mid',    name: 'Ogui Road',          note: 'Commercial belt · ₦100k–₦280k' },

  // ── Enugu South LGA ──
  { country: 'NG', city: 'Enugu', lga: 'Enugu South LGA',   tier: 'mid',    name: 'New Haven',          note: 'Professional class · ₦150k–₦350k' },
  { country: 'NG', city: 'Enugu', lga: 'Enugu South LGA',   tier: 'mid',    name: 'Trans-Ekulu',        note: 'Growing estate · ₦120k–₦300k' },
  { country: 'NG', city: 'Enugu', lga: 'Enugu South LGA',   tier: 'mid',    name: 'Coal Camp',          note: 'Historic commercial · ₦80k–₦240k' },

  // ── Enugu East LGA ──
  { country: 'NG', city: 'Enugu', lga: 'Enugu East LGA',    tier: 'budget', name: 'Abakpa Nike',        note: 'Dense urban · ₦50k–₦150k' },
  { country: 'NG', city: 'Enugu', lga: 'Enugu East LGA',    tier: 'budget', name: 'Agbani Road',        note: 'Outskirts market · ₦50k–₦150k' },

  // ════════════════════════════════════════════════
  // NIGERIA — OYO STATE (Ibadan + Ile-Ife)
  // ════════════════════════════════════════════════

  // ── Ibadan North-East LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North-East LGA', tier: 'high', name: 'Bodija',           note: 'Educated professionals · ₦200k–₦600k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North-East LGA', tier: 'high', name: 'Agodi GRA',        note: 'Premium clients · ₦200k–₦550k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North-East LGA', tier: 'mid',  name: 'Secretariat Area', note: 'Government belt · ₦100k–₦280k' },

  // ── Ibadan North LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North LGA',  tier: 'mid',    name: 'Agodi',              note: 'Established SMEs · ₦100k–₦280k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North LGA',  tier: 'mid',    name: 'Jericho',            note: 'Affluent suburb · ₦150k–₦400k' },

  // ── Ibadan South-West LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan South-West LGA', tier: 'mid', name: 'Dugbe',             note: 'Dense commercial · ₦100k–₦300k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan South-West LGA', tier: 'mid', name: 'Ring Road',         note: 'Established SMEs · ₦100k–₦280k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan South-West LGA', tier: 'mid', name: 'Molete',            note: 'Commercial belt · ₦80k–₦240k' },

  // ── Ibadan North-West LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North-West LGA', tier: 'budget', name: 'Iwo Road',       note: 'High volume · ₦50k–₦150k' },
  { country: 'NG', city: 'Ibadan', lga: 'Ibadan North-West LGA', tier: 'budget', name: 'Challenge',      note: 'Dense market · ₦40k–₦130k' },

  // ── Akinyele LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Akinyele LGA',      tier: 'budget', name: 'Ojoo',               note: 'Outskirts market · ₦40k–₦130k' },

  // ── Oluyole LGA ──
  { country: 'NG', city: 'Ibadan', lga: 'Oluyole LGA',       tier: 'mid',    name: 'Oluyole Estate',     note: 'Residential estate · ₦100k–₦280k' },

  // ── Ife Central LGA (Osun State also covers Ile-Ife) ──
  { country: 'NG', city: 'Ile-Ife', lga: 'Ife Central LGA',  tier: 'mid',    name: 'OAU Area, Ile-Ife',  note: 'University community · ₦80k–₦230k' },
  { country: 'NG', city: 'Ile-Ife', lga: 'Ife Central LGA',  tier: 'mid',    name: 'Ile-Ife Township',   note: 'Historic capital city · ₦80k–₦230k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KANO STATE
  // ════════════════════════════════════════════════

  // ── Nassarawa LGA ──
  { country: 'NG', city: 'Kano', lga: 'Nassarawa LGA',       tier: 'high',   name: 'Nassarawa',          note: 'Wealthy traders · ₦300k–₦800k' },
  { country: 'NG', city: 'Kano', lga: 'Nassarawa LGA',       tier: 'high',   name: 'Kano GRA',           note: 'Corporate district · ₦250k–₦700k' },

  // ── Fagge LGA ──
  { country: 'NG', city: 'Kano', lga: 'Fagge LGA',           tier: 'mid',    name: 'Sabon Gari',         note: 'Active commerce · ₦100k–₦300k' },
  { country: 'NG', city: 'Kano', lga: 'Fagge LGA',           tier: 'mid',    name: 'Fagge',              note: 'Trade district · ₦100k–₦280k' },

  // ── Kumbotso LGA ──
  { country: 'NG', city: 'Kano', lga: 'Kumbotso LGA',        tier: 'budget', name: 'Tudun Wada',         note: 'Budget market · ₦40k–₦120k' },

  // ── Dala LGA ──
  { country: 'NG', city: 'Kano', lga: 'Dala LGA',            tier: 'budget', name: 'Dala',               note: 'High density · ₦40k–₦130k' },

  // ── Tarauni LGA ──
  { country: 'NG', city: 'Kano', lga: 'Tarauni LGA',         tier: 'mid',    name: 'Bompai',             note: 'Industrial area · ₦100k–₦280k' },

  // ════════════════════════════════════════════════
  // NIGERIA — EDO STATE (Benin City)
  // ════════════════════════════════════════════════

  // ── Oredo LGA (city centre) ──
  { country: 'NG', city: 'Benin City', lga: 'Oredo LGA',      tier: 'high',   name: 'GRA, Benin City',    note: 'Premium clients · ₦250k–₦700k' },
  { country: 'NG', city: 'Benin City', lga: 'Oredo LGA',      tier: 'high',   name: 'Reservation Area',  note: 'Affluent professionals · ₦200k–₦600k' },
  { country: 'NG', city: 'Benin City', lga: 'Oredo LGA',      tier: 'mid',    name: 'Sapele Road',        note: 'Commercial strip · ₦100k–₦300k' },
  { country: 'NG', city: 'Benin City', lga: 'Oredo LGA',      tier: 'mid',    name: 'Mission Road',       note: 'Active SME belt · ₦80k–₦250k' },
  { country: 'NG', city: 'Benin City', lga: 'Oredo LGA',      tier: 'budget', name: 'Benin City Central', note: 'Old city market · ₦50k–₦150k' },

  // ── Egor LGA ──
  { country: 'NG', city: 'Benin City', lga: 'Egor LGA',       tier: 'mid',    name: 'Uselu',              note: 'Student & SME · ₦80k–₦250k' },
  { country: 'NG', city: 'Benin City', lga: 'Egor LGA',       tier: 'budget', name: 'Ugbowo',             note: 'University area · ₦50k–₦150k' },

  // ── Ikpoba-Okha LGA ──
  { country: 'NG', city: 'Benin City', lga: 'Ikpoba-Okha LGA', tier: 'mid',   name: 'Ikpoba Hill',        note: 'Professionals suburb · ₦80k–₦250k' },
  { country: 'NG', city: 'Benin City', lga: 'Ikpoba-Okha LGA', tier: 'mid',   name: 'Airport Road, Benin', note: 'Commercial corridor · ₦80k–₦230k' },

  // ════════════════════════════════════════════════
  // NIGERIA — IMO STATE (Owerri)
  // ════════════════════════════════════════════════

  // ── Owerri Municipal LGA ──
  { country: 'NG', city: 'Owerri', lga: 'Owerri Municipal LGA', tier: 'high', name: 'New Owerri',         note: 'Imo professionals · ₦250k–₦650k' },
  { country: 'NG', city: 'Owerri', lga: 'Owerri Municipal LGA', tier: 'high', name: 'GRA, Owerri',        note: 'Premium district · ₦200k–₦600k' },
  { country: 'NG', city: 'Owerri', lga: 'Owerri Municipal LGA', tier: 'mid',  name: 'Douglas Road',       note: 'Busy commercial · ₦100k–₦280k' },
  { country: 'NG', city: 'Owerri', lga: 'Owerri Municipal LGA', tier: 'mid',  name: 'Owerri Township',    note: 'City centre SMEs · ₦80k–₦250k' },

  // ── Owerri North LGA ──
  { country: 'NG', city: 'Owerri', lga: 'Owerri North LGA',  tier: 'mid',    name: 'World Bank Estate',  note: 'Growing estate · ₦120k–₦300k' },
  { country: 'NG', city: 'Owerri', lga: 'Owerri North LGA',  tier: 'mid',    name: 'Trans-Egbu',         note: 'Suburb · ₦100k–₦270k' },

  // ── Owerri West LGA ──
  { country: 'NG', city: 'Owerri', lga: 'Owerri West LGA',   tier: 'budget', name: 'Nekede',             note: 'Poly area · ₦50k–₦150k' },

  // ════════════════════════════════════════════════
  // NIGERIA — DELTA STATE (Warri + Asaba)
  // ════════════════════════════════════════════════

  // ── Warri South LGA ──
  { country: 'NG', city: 'Warri', lga: 'Warri South LGA',    tier: 'high',   name: 'GRA, Warri',         note: 'Oil sector clients · ₦300k–₦800k' },
  { country: 'NG', city: 'Warri', lga: 'Warri South LGA',    tier: 'mid',    name: 'PTI Road, Warri',    note: 'Professionals belt · ₦120k–₦320k' },
  { country: 'NG', city: 'Warri', lga: 'Warri South LGA',    tier: 'budget', name: 'Warri Township',     note: 'Busy market · ₦60k–₦180k' },

  // ── Uvwie LGA (Effurun) ──
  { country: 'NG', city: 'Warri', lga: 'Uvwie LGA',          tier: 'mid',    name: 'Effurun',            note: 'Commercial centre · ₦120k–₦320k' },
  { country: 'NG', city: 'Warri', lga: 'Uvwie LGA',          tier: 'mid',    name: 'Ekpan',              note: 'Oil community · ₦100k–₦280k' },

  // ── Oshimili South LGA (Asaba) ──
  { country: 'NG', city: 'Asaba', lga: 'Oshimili South LGA', tier: 'high',   name: 'GRA, Asaba',         note: 'Delta State capital · ₦200k–₦550k' },
  { country: 'NG', city: 'Asaba', lga: 'Oshimili South LGA', tier: 'mid',    name: 'Infant Jesus Area',  note: 'Commercial centre · ₦100k–₦280k' },
  { country: 'NG', city: 'Asaba', lga: 'Oshimili South LGA', tier: 'mid',    name: 'Asaba Township',     note: 'Capital city core · ₦80k–₦240k' },
  { country: 'NG', city: 'Asaba', lga: 'Oshimili South LGA', tier: 'budget', name: 'Cable Point, Asaba', note: 'Growing suburb · ₦50k–₦160k' },

  // ════════════════════════════════════════════════
  // NIGERIA — AKWA IBOM STATE (Uyo)
  // ════════════════════════════════════════════════

  // ── Uyo LGA ──
  { country: 'NG', city: 'Uyo', lga: 'Uyo LGA',              tier: 'high',   name: 'Use Offot',          note: 'Affluent suburb · ₦250k–₦700k' },
  { country: 'NG', city: 'Uyo', lga: 'Uyo LGA',              tier: 'high',   name: 'Ewet Housing Estate', note: 'Government estate · ₦200k–₦600k' },
  { country: 'NG', city: 'Uyo', lga: 'Uyo LGA',              tier: 'mid',    name: 'Uyo Township',       note: 'State capital commerce · ₦100k–₦280k' },
  { country: 'NG', city: 'Uyo', lga: 'Uyo LGA',              tier: 'mid',    name: 'Ikot Ekpene Road',   note: 'Commercial corridor · ₦80k–₦250k' },
  { country: 'NG', city: 'Uyo', lga: 'Uyo LGA',              tier: 'budget', name: 'Itam',               note: 'Industrial suburb · ₦50k–₦150k' },

  // ── Ikot Ekpene LGA ──
  { country: 'NG', city: 'Ikot Ekpene', lga: 'Ikot Ekpene LGA', tier: 'mid', name: 'Ikot Ekpene Township', note: 'Raffia City · ₦80k–₦230k' },

  // ── Eket LGA ──
  { country: 'NG', city: 'Eket', lga: 'Eket LGA',            tier: 'mid',    name: 'Eket Township',      note: 'Oil city · ₦100k–₦280k' },

  // ════════════════════════════════════════════════
  // NIGERIA — CROSS RIVER STATE (Calabar)
  // ════════════════════════════════════════════════

  // ── Calabar Municipal LGA ──
  { country: 'NG', city: 'Calabar', lga: 'Calabar Municipal LGA', tier: 'high', name: 'GRA, Calabar',    note: 'Premium district · ₦200k–₦600k' },
  { country: 'NG', city: 'Calabar', lga: 'Calabar Municipal LGA', tier: 'mid',  name: 'State Housing',   note: 'Civil service class · ₦100k–₦280k' },
  { country: 'NG', city: 'Calabar', lga: 'Calabar Municipal LGA', tier: 'mid',  name: 'Calabar Municipality', note: 'Tourism city · ₦80k–₦250k' },
  { country: 'NG', city: 'Calabar', lga: 'Calabar Municipal LGA', tier: 'mid',  name: 'Mary Slessor Avenue', note: 'Professionals belt · ₦80k–₦250k' },

  // ── Calabar South LGA ──
  { country: 'NG', city: 'Calabar', lga: 'Calabar South LGA', tier: 'budget', name: 'Etta Agbo',         note: 'Dense market · ₦50k–₦150k' },
  { country: 'NG', city: 'Calabar', lga: 'Calabar South LGA', tier: 'budget', name: 'Big Qua Town',      note: 'Budget area · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ABIA STATE (Aba + Umuahia)
  // ════════════════════════════════════════════════

  // ── Aba North LGA ──
  { country: 'NG', city: 'Aba', lga: 'Aba North LGA',        tier: 'high',   name: 'GRA, Aba',           note: 'Business elite · ₦250k–₦600k' },
  { country: 'NG', city: 'Aba', lga: 'Aba North LGA',        tier: 'mid',    name: 'Aba Township',       note: 'Manufacturing & trade · ₦100k–₦280k' },

  // ── Aba South LGA ──
  { country: 'NG', city: 'Aba', lga: 'Aba South LGA',        tier: 'mid',    name: 'Osisioma',           note: 'Industrial suburb · ₦80k–₦240k' },
  { country: 'NG', city: 'Aba', lga: 'Aba South LGA',        tier: 'budget', name: 'Ariaria Market',     note: 'Largest market hub · ₦40k–₦120k' },

  // ── Umuahia North LGA ──
  { country: 'NG', city: 'Umuahia', lga: 'Umuahia North LGA', tier: 'high',  name: 'GRA, Umuahia',       note: 'Abia State capital · ₦180k–₦480k' },
  { country: 'NG', city: 'Umuahia', lga: 'Umuahia North LGA', tier: 'mid',   name: 'Umuahia Township',   note: 'Capital city · ₦80k–₦240k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ANAMBRA STATE (Onitsha + Awka + Nnewi)
  // ════════════════════════════════════════════════

  // ── Onitsha North LGA ──
  { country: 'NG', city: 'Onitsha', lga: 'Onitsha North LGA', tier: 'high',  name: 'GRA, Onitsha',       note: 'Trading elite · ₦250k–₦700k' },
  { country: 'NG', city: 'Onitsha', lga: 'Onitsha North LGA', tier: 'mid',   name: 'Trans Nkisi',        note: 'Commercial belt · ₦100k–₦270k' },

  // ── Onitsha South LGA ──
  { country: 'NG', city: 'Onitsha', lga: 'Onitsha South LGA', tier: 'mid',   name: 'Fegge',              note: 'Dense trade · ₦100k–₦280k' },
  { country: 'NG', city: 'Onitsha', lga: 'Onitsha South LGA', tier: 'budget', name: 'Onitsha Main Market', note: 'Largest market in W.Africa · ₦40k–₦130k' },

  // ── Awka South LGA ──
  { country: 'NG', city: 'Awka', lga: 'Awka South LGA',      tier: 'high',   name: 'GRA, Awka',          note: 'State capital elite · ₦200k–₦550k' },
  { country: 'NG', city: 'Awka', lga: 'Awka South LGA',      tier: 'mid',    name: 'UNIZIK Junction',    note: 'University corridor · ₦100k–₦280k' },
  { country: 'NG', city: 'Awka', lga: 'Awka South LGA',      tier: 'mid',    name: 'Awka Township',      note: 'City centre · ₦80k–₦240k' },

  // ── Nnewi North LGA (auto-parts & manufacturing capital) ──
  { country: 'NG', city: 'Nnewi', lga: 'Nnewi North LGA',    tier: 'mid',    name: 'Nnewi Township',     note: 'Auto-parts capital · ₦100k–₦280k' },
  { country: 'NG', city: 'Nnewi', lga: 'Nnewi North LGA',    tier: 'mid',    name: 'Nkwo-Nnewi Market',  note: 'Massive auto market · ₦80k–₦240k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KWARA STATE (Ilorin)
  // ════════════════════════════════════════════════

  // ── Ilorin West LGA ──
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin West LGA',   tier: 'high',   name: 'GRA, Ilorin',        note: 'Premium clients · ₦200k–₦550k' },
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin West LGA',   tier: 'mid',    name: 'Tanke',              note: 'University area · ₦100k–₦270k' },
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin West LGA',   tier: 'mid',    name: 'Fate Road',          note: 'Commercial strip · ₦80k–₦240k' },

  // ── Ilorin East LGA ──
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin East LGA',   tier: 'mid',    name: 'Ilorin Township',    note: 'Capital city core · ₦80k–₦240k' },
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin East LGA',   tier: 'mid',    name: 'Sango, Ilorin',      note: 'Growing commercial · ₦80k–₦230k' },

  // ── Ilorin South LGA ──
  { country: 'NG', city: 'Ilorin', lga: 'Ilorin South LGA',  tier: 'budget', name: 'Kulende',            note: 'Dense market · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KADUNA STATE
  // ════════════════════════════════════════════════

  // ── Kaduna North LGA ──
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna North LGA',  tier: 'high',   name: 'GRA, Kaduna',        note: 'Military & corporate · ₦200k–₦600k' },
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna North LGA',  tier: 'mid',    name: 'Barnawa',            note: 'Educated middle class · ₦100k–₦280k' },
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna North LGA',  tier: 'mid',    name: 'Malali',             note: 'Commercial suburb · ₦80k–₦240k' },

  // ── Kaduna South LGA ──
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna South LGA',  tier: 'mid',    name: 'Kawo',               note: 'Commercial growth · ₦100k–₦260k' },
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna South LGA',  tier: 'budget', name: 'Kakuri Industrial',  note: 'Industrial zone · ₦50k–₦150k' },
  { country: 'NG', city: 'Kaduna', lga: 'Kaduna South LGA',  tier: 'budget', name: 'Kaduna Township',    note: 'City centre trade · ₦50k–₦150k' },

  // ════════════════════════════════════════════════
  // NIGERIA — PLATEAU STATE (Jos)
  // ════════════════════════════════════════════════

  // ── Jos North LGA ──
  { country: 'NG', city: 'Jos', lga: 'Jos North LGA',        tier: 'high',   name: 'GRA, Jos',           note: 'Plateau elite · ₦200k–₦550k' },
  { country: 'NG', city: 'Jos', lga: 'Jos North LGA',        tier: 'high',   name: 'Rayfield',           note: 'Tourism hill suburb · ₦200k–₦500k' },
  { country: 'NG', city: 'Jos', lga: 'Jos North LGA',        tier: 'mid',    name: 'Jos Township',       note: 'City centre SMEs · ₦80k–₦250k' },
  { country: 'NG', city: 'Jos', lga: 'Jos North LGA',        tier: 'mid',    name: 'Tudun Wada, Jos',    note: 'Commercial suburb · ₦80k–₦230k' },

  // ── Jos South LGA ──
  { country: 'NG', city: 'Jos', lga: 'Jos South LGA',        tier: 'budget', name: 'Bukuru',             note: 'Industrial suburb · ₦50k–₦150k' },
  { country: 'NG', city: 'Jos', lga: 'Jos South LGA',        tier: 'budget', name: 'Rantya',             note: 'Dense suburb · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — OGUN STATE (Abeokuta + Sagamu + Ijebu-Ode)
  // ════════════════════════════════════════════════

  // ── Abeokuta North LGA ──
  { country: 'NG', city: 'Abeokuta', lga: 'Abeokuta North LGA', tier: 'high', name: 'Oke-Mosan',         note: 'Government & elite · ₦200k–₦500k' },
  { country: 'NG', city: 'Abeokuta', lga: 'Abeokuta North LGA', tier: 'mid',  name: 'Panseke',           note: 'Growing commercial · ₦80k–₦240k' },

  // ── Abeokuta South LGA ──
  { country: 'NG', city: 'Abeokuta', lga: 'Abeokuta South LGA', tier: 'mid',  name: 'Kuto',              note: 'Commercial centre · ₦100k–₦270k' },
  { country: 'NG', city: 'Abeokuta', lga: 'Abeokuta South LGA', tier: 'budget', name: 'Lafenwa',         note: 'Dense trade · ₦50k–₦150k' },

  // ── Sagamu LGA ──
  { country: 'NG', city: 'Sagamu', lga: 'Sagamu LGA',         tier: 'mid',    name: 'Sagamu Township',   note: 'Industrial corridor · ₦80k–₦240k' },
  { country: 'NG', city: 'Sagamu', lga: 'Sagamu LGA',         tier: 'mid',    name: 'Ita-Oluwo, Sagamu', note: 'Commercial belt · ₦80k–₦220k' },

  // ── Ijebu-Ode LGA ──
  { country: 'NG', city: 'Ijebu-Ode', lga: 'Ijebu-Ode LGA',  tier: 'mid',    name: 'Ijebu-Ode Township', note: 'Historic trade city · ₦80k–₦240k' },
  { country: 'NG', city: 'Ijebu-Ode', lga: 'Ijebu-Ode LGA',  tier: 'mid',    name: 'Oke-Sopen, Ijebu-Ode', note: 'Professional suburb · ₦80k–₦220k' },

  // ════════════════════════════════════════════════
  // NIGERIA — OSUN STATE (Osogbo + Ile-Ife)
  // ════════════════════════════════════════════════

  // ── Osogbo LGA ──
  { country: 'NG', city: 'Osogbo', lga: 'Osogbo LGA',         tier: 'high',   name: 'GRA, Osogbo',        note: 'Osun State elite · ₦180k–₦480k' },
  { country: 'NG', city: 'Osogbo', lga: 'Osogbo LGA',         tier: 'mid',    name: 'Osogbo Township',    note: 'State capital · ₦70k–₦220k' },
  { country: 'NG', city: 'Osogbo', lga: 'Osogbo LGA',         tier: 'mid',    name: 'Station Road, Osogbo', note: 'Commercial strip · ₦70k–₦210k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ONDO STATE (Akure)
  // ════════════════════════════════════════════════

  // ── Akure South LGA ──
  { country: 'NG', city: 'Akure', lga: 'Akure South LGA',     tier: 'high',   name: 'GRA, Akure',         note: 'Ondo State elite · ₦200k–₦500k' },
  { country: 'NG', city: 'Akure', lga: 'Akure South LGA',     tier: 'mid',    name: 'FUTA Area',          note: 'University corridor · ₦80k–₦240k' },
  { country: 'NG', city: 'Akure', lga: 'Akure South LGA',     tier: 'mid',    name: 'Oba-Ile, Akure',     note: 'Growing suburb · ₦80k–₦230k' },
  { country: 'NG', city: 'Akure', lga: 'Akure South LGA',     tier: 'budget', name: 'Shasha, Akure',      note: 'Dense market · ₦50k–₦150k' },

  // ════════════════════════════════════════════════
  // NIGERIA — EKITI STATE (Ado-Ekiti)
  // ════════════════════════════════════════════════

  // ── Ado Ekiti LGA ──
  { country: 'NG', city: 'Ado-Ekiti', lga: 'Ado Ekiti LGA',   tier: 'high',   name: 'GRA, Ado-Ekiti',     note: 'Ekiti professionals · ₦180k–₦480k' },
  { country: 'NG', city: 'Ado-Ekiti', lga: 'Ado Ekiti LGA',   tier: 'mid',    name: 'Ajilosun',           note: 'Commercial suburb · ₦80k–₦240k' },
  { country: 'NG', city: 'Ado-Ekiti', lga: 'Ado Ekiti LGA',   tier: 'mid',    name: 'Ado-Ekiti Township', note: 'Capital city · ₦70k–₦220k' },

  // ════════════════════════════════════════════════
  // NIGERIA — BENUE STATE (Makurdi)
  // ════════════════════════════════════════════════

  // ── Makurdi LGA ──
  { country: 'NG', city: 'Makurdi', lga: 'Makurdi LGA',       tier: 'mid',    name: 'GRA, Makurdi',       note: 'Benue State capital · ₦100k–₦270k' },
  { country: 'NG', city: 'Makurdi', lga: 'Makurdi LGA',       tier: 'mid',    name: 'High Level, Makurdi', note: 'Professionals area · ₦80k–₦240k' },
  { country: 'NG', city: 'Makurdi', lga: 'Makurdi LGA',       tier: 'mid',    name: 'Wadata, Makurdi',    note: 'Commercial strip · ₦70k–₦210k' },
  { country: 'NG', city: 'Makurdi', lga: 'Makurdi LGA',       tier: 'budget', name: 'Low Level, Makurdi', note: 'Market town · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — SOKOTO STATE
  // ════════════════════════════════════════════════

  // ── Sokoto North LGA ──
  { country: 'NG', city: 'Sokoto', lga: 'Sokoto North LGA',   tier: 'high',   name: 'GRA, Sokoto',        note: 'Caliphate elite · ₦200k–₦500k' },
  { country: 'NG', city: 'Sokoto', lga: 'Sokoto North LGA',   tier: 'mid',    name: 'Mabera',             note: 'Commercial suburb · ₦80k–₦240k' },

  // ── Sokoto South LGA ──
  { country: 'NG', city: 'Sokoto', lga: 'Sokoto South LGA',   tier: 'mid',    name: 'Gidan Igwai',        note: 'Established suburb · ₦70k–₦210k' },
  { country: 'NG', city: 'Sokoto', lga: 'Sokoto South LGA',   tier: 'budget', name: 'Sokoto Central Market', note: 'High volume trading · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KOGI STATE (Lokoja)
  // ════════════════════════════════════════════════

  // ── Lokoja LGA ──
  { country: 'NG', city: 'Lokoja', lga: 'Lokoja LGA',         tier: 'mid',    name: 'GRA, Lokoja',        note: 'Kogi State capital · ₦100k–₦280k' },
  { country: 'NG', city: 'Lokoja', lga: 'Lokoja LGA',         tier: 'mid',    name: 'Adankolo',           note: 'Commercial suburb · ₦80k–₦240k' },
  { country: 'NG', city: 'Lokoja', lga: 'Lokoja LGA',         tier: 'budget', name: 'Lokoja Township',    note: 'Market town · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ADAMAWA STATE (Yola / Jimeta)
  // ════════════════════════════════════════════════

  // ── Yola North LGA ──
  { country: 'NG', city: 'Yola', lga: 'Yola North LGA',       tier: 'mid',    name: 'GRA, Yola',          note: 'Adamawa capital · ₦100k–₦280k' },
  { country: 'NG', city: 'Yola', lga: 'Yola North LGA',       tier: 'mid',    name: 'Jimeta',             note: 'Commercial twin city · ₦90k–₦260k' },
  { country: 'NG', city: 'Yola', lga: 'Yola North LGA',       tier: 'mid',    name: 'Doubeli, Yola',      note: 'New estates · ₦80k–₦240k' },

  // ── Yola South LGA ──
  { country: 'NG', city: 'Yola', lga: 'Yola South LGA',       tier: 'budget', name: 'Yola Township',      note: 'Old town market · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — BORNO STATE (Maiduguri)
  // ════════════════════════════════════════════════

  // ── Maiduguri Metropolitan LGA ──
  { country: 'NG', city: 'Maiduguri', lga: 'Maiduguri Metro LGA', tier: 'mid',  name: 'GRA, Maiduguri',   note: 'Borno State capital · ₦100k–₦280k' },
  { country: 'NG', city: 'Maiduguri', lga: 'Maiduguri Metro LGA', tier: 'mid',  name: 'Bulumkutu',        note: 'Commercial suburb · ₦80k–₦240k' },
  { country: 'NG', city: 'Maiduguri', lga: 'Maiduguri Metro LGA', tier: 'budget', name: 'Gwange',         note: 'Dense market · ₦40k–₦130k' },
  { country: 'NG', city: 'Maiduguri', lga: 'Maiduguri Metro LGA', tier: 'budget', name: 'Old Maiduguri',  note: 'Historic town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // NIGERIA — BAUCHI STATE
  // ════════════════════════════════════════════════

  // ── Bauchi LGA ──
  { country: 'NG', city: 'Bauchi', lga: 'Bauchi LGA',         tier: 'mid',    name: 'GRA, Bauchi',        note: 'Bauchi professionals · ₦100k–₦280k' },
  { country: 'NG', city: 'Bauchi', lga: 'Bauchi LGA',         tier: 'mid',    name: 'Wunti, Bauchi',      note: 'Commercial suburb · ₦80k–₦240k' },
  { country: 'NG', city: 'Bauchi', lga: 'Bauchi LGA',         tier: 'budget', name: 'Bauchi Township',    note: 'Market town · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — ZAMFARA STATE (Gusau)
  // ════════════════════════════════════════════════

  // ── Gusau LGA ──
  { country: 'NG', city: 'Gusau', lga: 'Gusau LGA',           tier: 'mid',    name: 'GRA, Gusau',         note: 'Zamfara capital · ₦80k–₦230k' },
  { country: 'NG', city: 'Gusau', lga: 'Gusau LGA',           tier: 'budget', name: 'Gusau Township',     note: 'Market town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // NIGERIA — NASARAWA STATE (Lafia)
  // ════════════════════════════════════════════════

  // ── Lafia LGA ──
  { country: 'NG', city: 'Lafia', lga: 'Lafia LGA',           tier: 'mid',    name: 'GRA, Lafia',         note: 'Nasarawa capital · ₦80k–₦240k' },
  { country: 'NG', city: 'Lafia', lga: 'Lafia LGA',           tier: 'budget', name: 'Lafia Township',     note: 'Capital city · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — BAYELSA STATE (Yenagoa)
  // ════════════════════════════════════════════════

  // ── Yenagoa LGA ──
  { country: 'NG', city: 'Yenagoa', lga: 'Yenagoa LGA',       tier: 'high',   name: 'GRA, Yenagoa',       note: 'Bayelsa oil money · ₦200k–₦550k' },
  { country: 'NG', city: 'Yenagoa', lga: 'Yenagoa LGA',       tier: 'mid',    name: 'Opolo',              note: 'Commercial area · ₦80k–₦240k' },
  { country: 'NG', city: 'Yenagoa', lga: 'Yenagoa LGA',       tier: 'mid',    name: 'Amarata',            note: 'State capital suburb · ₦80k–₦230k' },
  { country: 'NG', city: 'Yenagoa', lga: 'Yenagoa LGA',       tier: 'budget', name: 'Yenagoa Township',   note: 'Market town · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — EBONYI STATE (Abakaliki)
  // ════════════════════════════════════════════════

  // ── Abakaliki LGA ──
  { country: 'NG', city: 'Abakaliki', lga: 'Abakaliki LGA',   tier: 'mid',    name: 'GRA, Abakaliki',     note: 'Ebonyi professionals · ₦100k–₦280k' },
  { country: 'NG', city: 'Abakaliki', lga: 'Abakaliki LGA',   tier: 'mid',    name: 'Kpirikpiri',         note: 'University area · ₦80k–₦240k' },
  { country: 'NG', city: 'Abakaliki', lga: 'Abakaliki LGA',   tier: 'budget', name: 'Abakaliki Township',  note: 'Capital city · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — GOMBE STATE
  // ════════════════════════════════════════════════

  // ── Gombe LGA ──
  { country: 'NG', city: 'Gombe', lga: 'Gombe LGA',           tier: 'mid',    name: 'GRA, Gombe',         note: 'North East professionals · ₦100k–₦280k' },
  { country: 'NG', city: 'Gombe', lga: 'Gombe LGA',           tier: 'mid',    name: 'Pantami, Gombe',     note: 'Commercial suburb · ₦80k–₦230k' },
  { country: 'NG', city: 'Gombe', lga: 'Gombe LGA',           tier: 'budget', name: 'Gombe Township',     note: 'Market town · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — JIGAWA STATE (Dutse)
  // ════════════════════════════════════════════════

  // ── Dutse LGA ──
  { country: 'NG', city: 'Dutse', lga: 'Dutse LGA',           tier: 'mid',    name: 'Dutse GRA',          note: 'Jigawa capital · ₦70k–₦210k' },
  { country: 'NG', city: 'Dutse', lga: 'Dutse LGA',           tier: 'budget', name: 'Dutse Township',     note: 'Market town · ₦30k–₦100k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KATSINA STATE
  // ════════════════════════════════════════════════

  // ── Katsina LGA ──
  { country: 'NG', city: 'Katsina', lga: 'Katsina LGA',       tier: 'high',   name: 'GRA, Katsina',       note: 'North West professionals · ₦200k–₦500k' },
  { country: 'NG', city: 'Katsina', lga: 'Katsina LGA',       tier: 'mid',    name: 'Kofar Marusa, Katsina', note: 'Historic commercial · ₦80k–₦230k' },
  { country: 'NG', city: 'Katsina', lga: 'Katsina LGA',       tier: 'budget', name: 'Katsina Township',   note: 'Market town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // NIGERIA — KEBBI STATE (Birnin Kebbi)
  // ════════════════════════════════════════════════

  // ── Birnin Kebbi LGA ──
  { country: 'NG', city: 'Birnin Kebbi', lga: 'Birnin Kebbi LGA', tier: 'mid', name: 'GRA, Birnin Kebbi', note: 'Kebbi capital · ₦80k–₦240k' },
  { country: 'NG', city: 'Birnin Kebbi', lga: 'Birnin Kebbi LGA', tier: 'budget', name: 'Birnin Kebbi Township', note: 'Market town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // NIGERIA — NIGER STATE (Minna)
  // ════════════════════════════════════════════════

  // ── Chanchaga LGA (main commercial LGA, Minna) ──
  { country: 'NG', city: 'Minna', lga: 'Chanchaga LGA',       tier: 'high',   name: 'Minna GRA / Tunga',  note: 'Niger State professionals · ₦200k–₦500k' },
  { country: 'NG', city: 'Minna', lga: 'Chanchaga LGA',       tier: 'mid',    name: 'Tunga, Minna',       note: 'Commercial belt · ₦80k–₦240k' },
  { country: 'NG', city: 'Minna', lga: 'Chanchaga LGA',       tier: 'mid',    name: 'Bosso Road, Minna',  note: 'Growing suburb · ₦80k–₦230k' },

  // ── Bosso LGA ──
  { country: 'NG', city: 'Minna', lga: 'Bosso LGA',           tier: 'budget', name: 'Bosso Estate',       note: 'Budget suburb · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // NIGERIA — TARABA STATE (Jalingo)
  // ════════════════════════════════════════════════

  // ── Jalingo LGA ──
  { country: 'NG', city: 'Jalingo', lga: 'Jalingo LGA',        tier: 'mid',    name: 'GRA, Jalingo',       note: 'Taraba capital · ₦80k–₦240k' },
  { country: 'NG', city: 'Jalingo', lga: 'Jalingo LGA',        tier: 'budget', name: 'Jalingo Township',   note: 'Market town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // NIGERIA — YOBE STATE (Damaturu)
  // ════════════════════════════════════════════════

  // ── Damaturu LGA ──
  { country: 'NG', city: 'Damaturu', lga: 'Damaturu LGA',      tier: 'mid',    name: 'GRA, Damaturu',      note: 'Yobe capital · ₦80k–₦230k' },
  { country: 'NG', city: 'Damaturu', lga: 'Damaturu LGA',      tier: 'budget', name: 'Damaturu Township',  note: 'Market town · ₦40k–₦120k' },

  // ════════════════════════════════════════════════
  // GHANA
  // ════════════════════════════════════════════════
  { country: 'GH', name: 'East Legon, Accra',              city: 'Accra',    tier: 'high',   note: 'Wealthy residential · GH₵8k–₵25k' },
  { country: 'GH', name: 'Airport Residential, Accra',     city: 'Accra',    tier: 'high',   note: 'Expats & executives · GH₵10k–₵30k' },
  { country: 'GH', name: 'Cantonments, Accra',             city: 'Accra',    tier: 'high',   note: 'Diplomatic & corporate · GH₵8k–₵20k' },
  { country: 'GH', name: 'Labone, Accra',                  city: 'Accra',    tier: 'high',   note: 'Affluent professionals · GH₵6k–₵15k' },
  { country: 'GH', name: 'Dzorwulu, Accra',                city: 'Accra',    tier: 'high',   note: 'Upmarket suburb · GH₵6k–₵18k' },
  { country: 'GH', name: 'Osu, Accra',                     city: 'Accra',    tier: 'mid',    note: 'Busy commercial strip · GH₵3k–₵8k' },
  { country: 'GH', name: 'Adabraka, Accra',                city: 'Accra',    tier: 'mid',    note: 'Active SME area · GH₵2k–₵6k' },
  { country: 'GH', name: 'Tema Community 1, Accra',        city: 'Tema',     tier: 'mid',    note: 'Port city commerce · GH₵2k–₵6k' },
  { country: 'GH', name: 'Spintex Road, Accra',            city: 'Accra',    tier: 'mid',    note: 'Industrial & retail · GH₵2.5k–₵7k' },
  { country: 'GH', name: 'Madina, Accra',                  city: 'Accra',    tier: 'mid',    note: 'Growing suburb · GH₵1.5k–₵5k' },
  { country: 'GH', name: 'Dansoman, Accra',                city: 'Accra',    tier: 'budget', note: 'High density · GH₵1k–₵3k' },
  { country: 'GH', name: 'Kasoa, Accra',                   city: 'Kasoa',    tier: 'budget', note: 'Fast-growing satellite · GH₵800–₵2.5k' },
  { country: 'GH', name: 'Adum, Kumasi',                   city: 'Kumasi',   tier: 'mid',    note: 'Ashanti capital centre · GH₵2k–₵6k' },
  { country: 'GH', name: 'Asokwa, Kumasi',                 city: 'Kumasi',   tier: 'mid',    note: 'Kumasi business · GH₵1.5k–₵5k' },
  { country: 'GH', name: 'Suame, Kumasi',                  city: 'Kumasi',   tier: 'budget', note: 'Automotive market · GH₵800–₵2.5k' },
  { country: 'GH', name: 'Takoradi, Western Region',       city: 'Takoradi', tier: 'mid',    note: 'Oil & port city · GH₵3k–₵8k' },
  { country: 'GH', name: 'Cape Coast',                     city: 'Cape Coast', tier: 'mid',  note: 'Tourism & university · GH₵1.5k–₵5k' },
  { country: 'GH', name: 'Tamale, Northern Region',        city: 'Tamale',   tier: 'budget', note: 'Northern capital · GH₵800–₵2.5k' },

  // ════════════════════════════════════════════════
  // KENYA
  // ════════════════════════════════════════════════
  { country: 'KE', name: 'Karen, Nairobi',                 city: 'Nairobi',  tier: 'high',   note: 'Expat & wealthy suburb · KSh80k–250k' },
  { country: 'KE', name: 'Westlands, Nairobi',             city: 'Nairobi',  tier: 'high',   note: 'Corporate & retail hub · KSh60k–200k' },
  { country: 'KE', name: 'Kilimani, Nairobi',              city: 'Nairobi',  tier: 'high',   note: 'Upmarket residential · KSh60k–180k' },
  { country: 'KE', name: 'Lavington, Nairobi',             city: 'Nairobi',  tier: 'high',   note: 'Premium professionals · KSh70k–200k' },
  { country: 'KE', name: 'Gigiri, Nairobi',                city: 'Nairobi',  tier: 'high',   note: 'UN & diplomatic zone · KSh80k–250k' },
  { country: 'KE', name: 'Runda, Nairobi',                 city: 'Nairobi',  tier: 'high',   note: 'Elite gated suburb · KSh100k–300k' },
  { country: 'KE', name: 'Parklands, Nairobi',             city: 'Nairobi',  tier: 'mid',    note: 'Established business · KSh30k–80k' },
  { country: 'KE', name: 'South B, Nairobi',               city: 'Nairobi',  tier: 'mid',    note: 'Residential SMEs · KSh20k–60k' },
  { country: 'KE', name: 'Nairobi CBD',                    city: 'Nairobi',  tier: 'mid',    note: 'High-volume commerce · KSh20k–50k' },
  { country: 'KE', name: 'Upperhill, Nairobi',             city: 'Nairobi',  tier: 'high',   note: 'Banking & corporate · KSh70k–220k' },
  { country: 'KE', name: 'Ngong Road, Nairobi',            city: 'Nairobi',  tier: 'mid',    note: 'Suburban commercial · KSh25k–70k' },
  { country: 'KE', name: 'Mombasa CBD',                    city: 'Mombasa',  tier: 'mid',    note: 'Coastal commercial · KSh20k–60k' },
  { country: 'KE', name: 'Nyali, Mombasa',                 city: 'Mombasa',  tier: 'high',   note: 'Upmarket coastal · KSh50k–150k' },
  { country: 'KE', name: 'Kisumu CBD',                     city: 'Kisumu',   tier: 'mid',    note: 'Lake region hub · KSh15k–40k' },
  { country: 'KE', name: 'Nakuru Town',                    city: 'Nakuru',   tier: 'mid',    note: 'Rift Valley hub · KSh15k–40k' },
  { country: 'KE', name: 'Eldoret Town',                   city: 'Eldoret',  tier: 'mid',    note: 'North Rift commerce · KSh15k–40k' },
  { country: 'KE', name: 'Thika Road, Nairobi',            city: 'Nairobi',  tier: 'budget', note: 'Industrial corridor · KSh10k–30k' },

  // ════════════════════════════════════════════════
  // SOUTH AFRICA
  // ════════════════════════════════════════════════
  { country: 'ZA', name: 'Sandton, Johannesburg',          city: 'Johannesburg', tier: 'high',   note: "Africa's richest sq mile · R15k–80k" },
  { country: 'ZA', name: 'Rosebank, Johannesburg',         city: 'Johannesburg', tier: 'high',   note: 'Corporate & lifestyle · R10k–50k' },
  { country: 'ZA', name: 'Fourways, Johannesburg',         city: 'Johannesburg', tier: 'high',   note: 'Suburban premium · R10k–40k' },
  { country: 'ZA', name: 'Bryanston, Johannesburg',        city: 'Johannesburg', tier: 'high',   note: 'Affluent suburb · R10k–40k' },
  { country: 'ZA', name: 'Midrand, Johannesburg',          city: 'Midrand',      tier: 'mid',    note: 'Tech corridor · R6k–20k' },
  { country: 'ZA', name: 'Soweto, Johannesburg',           city: 'Johannesburg', tier: 'budget', note: 'Largest township · R1.5k–5k' },
  { country: 'ZA', name: 'Pretoria East',                  city: 'Pretoria',     tier: 'mid',    note: 'Affluent suburbs · R8k–25k' },
  { country: 'ZA', name: 'Hatfield, Pretoria',             city: 'Pretoria',     tier: 'mid',    note: 'University & embassy · R6k–18k' },
  { country: 'ZA', name: 'V&A Waterfront, Cape Town',      city: 'Cape Town',    tier: 'high',   note: 'Tourism & premium retail · R15k–60k' },
  { country: 'ZA', name: 'Sea Point, Cape Town',           city: 'Cape Town',    tier: 'high',   note: 'Affluent coastal · R12k–45k' },
  { country: 'ZA', name: 'Claremont, Cape Town',           city: 'Cape Town',    tier: 'mid',    note: 'Southern suburbs · R8k–25k' },
  { country: 'ZA', name: 'Bellville, Cape Town',           city: 'Cape Town',    tier: 'mid',    note: 'Northern suburbs · R5k–15k' },
  { country: 'ZA', name: 'Umhlanga, Durban',               city: 'Durban',       tier: 'high',   note: 'Upmarket coastal · R10k–35k' },
  { country: 'ZA', name: 'Berea, Durban',                  city: 'Durban',       tier: 'mid',    note: 'City fringe · R4k–12k' },

  // ════════════════════════════════════════════════
  // UGANDA
  // ════════════════════════════════════════════════
  { country: 'UG', name: 'Kololo, Kampala',                city: 'Kampala', tier: 'high',   note: 'Elite residential · USh3M–8M' },
  { country: 'UG', name: 'Nakasero, Kampala',              city: 'Kampala', tier: 'high',   note: 'Corporate & embassy · USh2M–6M' },
  { country: 'UG', name: 'Bugolobi, Kampala',              city: 'Kampala', tier: 'high',   note: 'Expat suburb · USh2M–5M' },
  { country: 'UG', name: 'Ntinda, Kampala',                city: 'Kampala', tier: 'mid',    note: 'Growing suburb · USh800k–2M' },
  { country: 'UG', name: 'Kampala CBD',                    city: 'Kampala', tier: 'mid',    note: 'High-volume commerce · USh600k–1.5M' },
  { country: 'UG', name: 'Muyenga, Kampala',              city: 'Kampala', tier: 'mid',    note: 'Residential commercial · USh700k–2M' },
  { country: 'UG', name: 'Naalya, Kampala',               city: 'Kampala', tier: 'mid',    note: 'Suburban growth · USh600k–1.5M' },
  { country: 'UG', name: 'Mukono, Uganda',                 city: 'Mukono',  tier: 'budget', note: 'Town near Kampala · USh300k–800k' },

  // ════════════════════════════════════════════════
  // TANZANIA
  // ════════════════════════════════════════════════
  { country: 'TZ', name: 'Masaki, Dar es Salaam',          city: 'Dar es Salaam', tier: 'high',   note: 'Expat & elite · TSh500k–1.5M' },
  { country: 'TZ', name: 'Oyster Bay, Dar es Salaam',      city: 'Dar es Salaam', tier: 'high',   note: 'Diplomatic suburb · TSh400k–1.2M' },
  { country: 'TZ', name: 'Mikocheni, Dar es Salaam',       city: 'Dar es Salaam', tier: 'mid',    note: 'Growing commercial · TSh200k–500k' },
  { country: 'TZ', name: 'Kariakoo, Dar es Salaam',        city: 'Dar es Salaam', tier: 'budget', note: 'Largest market · TSh80k–250k' },
  { country: 'TZ', name: 'Arusha CBD',                     city: 'Arusha',        tier: 'mid',    note: 'Safari & tourism hub · TSh200k–600k' },
  { country: 'TZ', name: 'Njiro, Arusha',                  city: 'Arusha',        tier: 'high',   note: 'Upmarket Arusha · TSh300k–800k' },
  { country: 'TZ', name: 'Mwanza City',                    city: 'Mwanza',        tier: 'mid',    note: 'Lake Victoria hub · TSh150k–400k' },

  // ════════════════════════════════════════════════
  // RWANDA
  // ════════════════════════════════════════════════
  { country: 'RW', name: 'Kiyovu, Kigali',                 city: 'Kigali', tier: 'high',   note: 'Premium Kigali · RWF600k–1.5M' },
  { country: 'RW', name: 'Nyarutarama, Kigali',            city: 'Kigali', tier: 'high',   note: 'Expat & exec suburb · RWF500k–1.2M' },
  { country: 'RW', name: 'Kimihurura, Kigali',             city: 'Kigali', tier: 'mid',    note: 'Growing commercial · RWF200k–600k' },
  { country: 'RW', name: 'Remera, Kigali',                 city: 'Kigali', tier: 'mid',    note: 'Busy suburb · RWF150k–450k' },
  { country: 'RW', name: 'Kicukiro, Kigali',               city: 'Kigali', tier: 'budget', note: 'Dense residential · RWF80k–250k' },

  // ════════════════════════════════════════════════
  // SENEGAL
  // ════════════════════════════════════════════════
  { country: 'SN', name: 'Plateau, Dakar',                 city: 'Dakar', tier: 'high',   note: 'Business district · XOF600k–1.5M' },
  { country: 'SN', name: 'Almadies, Dakar',                city: 'Dakar', tier: 'high',   note: 'Upmarket & expat · XOF500k–1.2M' },
  { country: 'SN', name: 'Mermoz, Dakar',                  city: 'Dakar', tier: 'mid',    note: 'Professional class · XOF200k–500k' },
  { country: 'SN', name: 'Ouakam, Dakar',                  city: 'Dakar', tier: 'mid',    note: 'Growing suburb · XOF150k–400k' },
  { country: 'SN', name: 'Guédiawaye, Dakar',              city: 'Dakar', tier: 'budget', note: 'Dense suburban · XOF80k–250k' },

  // ════════════════════════════════════════════════
  // CAMEROON
  // ════════════════════════════════════════════════
  { country: 'CM', name: 'Bastos, Yaoundé',                city: 'Yaoundé', tier: 'high',   note: 'Diplomatic & elite · XAF500k–1.2M' },
  { country: 'CM', name: 'Nlongkak, Yaoundé',              city: 'Yaoundé', tier: 'mid',    note: 'Growing suburb · XAF200k–500k' },
  { country: 'CM', name: 'Bonanjo, Douala',                city: 'Douala',  tier: 'high',   note: 'Business district · XAF400k–1M' },
  { country: 'CM', name: 'Akwa, Douala',                   city: 'Douala',  tier: 'mid',    note: 'Commercial centre · XAF150k–400k' },
  { country: 'CM', name: 'Makepe, Douala',                 city: 'Douala',  tier: 'mid',    note: 'Growing district · XAF120k–350k' },
  { country: 'CM', name: 'Bepanda, Douala',                city: 'Douala',  tier: 'budget', note: 'Dense market · XAF60k–180k' },

  // ════════════════════════════════════════════════
  // UNITED STATES
  // ════════════════════════════════════════════════
  { country: 'US', name: 'Manhattan, New York',            city: 'New York',      tier: 'high',   note: 'Luxury & finance · $8k–$30k' },
  { country: 'US', name: 'Beverly Hills, Los Angeles',     city: 'Los Angeles',   tier: 'high',   note: 'High-end retail · $7k–$25k' },
  { country: 'US', name: 'SoMa, San Francisco',            city: 'San Francisco', tier: 'high',   note: 'Tech & startups · $8k–$30k' },
  { country: 'US', name: 'Downtown, Miami',                city: 'Miami',         tier: 'high',   note: 'Affluent & corporate · $6k–$20k' },
  { country: 'US', name: 'Buckhead, Atlanta',              city: 'Atlanta',       tier: 'mid',    note: 'Upscale business · $3k–$10k' },
  { country: 'US', name: 'Downtown, Austin',               city: 'Austin',        tier: 'mid',    note: 'Growing SME hub · $3k–$9k' },
  { country: 'US', name: 'Brooklyn, New York',             city: 'New York',      tier: 'mid',    note: 'Dense SME market · $2.5k–$8k' },
  { country: 'US', name: 'Plano, Dallas',                  city: 'Dallas',        tier: 'mid',    note: 'Suburban business · $2k–$7k' },
  { country: 'US', name: 'Midtown, Houston',               city: 'Houston',       tier: 'mid',    note: 'Energy city core · $2.5k–$8k' },
  { country: 'US', name: 'Queens, New York',               city: 'New York',      tier: 'budget', note: 'High volume · $800–$2.5k' },
  { country: 'US', name: 'East LA, Los Angeles',           city: 'Los Angeles',   tier: 'budget', note: 'Price-sensitive · $700–$2k' },
  { country: 'US', name: 'South Side, Chicago',            city: 'Chicago',       tier: 'budget', note: 'Dense community · $700–$2k' },

  // ════════════════════════════════════════════════
  // UNITED KINGDOM
  // ════════════════════════════════════════════════
  { country: 'GB', name: 'Mayfair, London',                city: 'London',     tier: 'high',   note: 'Luxury & wealth · £6k–£25k' },
  { country: 'GB', name: 'Kensington, London',             city: 'London',     tier: 'high',   note: 'Affluent residential · £5k–£20k' },
  { country: 'GB', name: 'Canary Wharf, London',           city: 'London',     tier: 'high',   note: 'Corporate & finance · £6k–£22k' },
  { country: 'GB', name: 'Chelsea, London',                city: 'London',     tier: 'high',   note: 'Premium lifestyle · £6k–£22k' },
  { country: 'GB', name: 'Shoreditch, London',             city: 'London',     tier: 'mid',    note: 'Creative & startups · £2.5k–£8k' },
  { country: 'GB', name: 'Hackney, London',                city: 'London',     tier: 'mid',    note: 'Creative economy · £2k–£7k' },
  { country: 'GB', name: 'City Centre, Manchester',        city: 'Manchester', tier: 'mid',    note: 'Northern business hub · £2k–£7k' },
  { country: 'GB', name: 'Salford, Manchester',            city: 'Manchester', tier: 'mid',    note: 'Media City area · £1.8k–£6k' },
  { country: 'GB', name: 'City Centre, Birmingham',        city: 'Birmingham', tier: 'mid',    note: 'Active SME market · £1.8k–£6k' },
  { country: 'GB', name: 'Edgbaston, Birmingham',          city: 'Birmingham', tier: 'mid',    note: 'Professional suburb · £2k–£6k' },
  { country: 'GB', name: 'City Centre, Leeds',             city: 'Leeds',      tier: 'mid',    note: 'Northern commerce · £1.8k–£6k' },
  { country: 'GB', name: 'City Centre, Bristol',           city: 'Bristol',    tier: 'mid',    note: 'Creative & tech · £2k–£7k' },
  { country: 'GB', name: 'City Centre, Glasgow',           city: 'Glasgow',    tier: 'mid',    note: 'Scottish commercial · £1.8k–£6k' },
  { country: 'GB', name: 'Croydon, London',                city: 'London',     tier: 'budget', note: 'High volume · £600–£2k' },
  { country: 'GB', name: 'Bradford',                       city: 'Bradford',   tier: 'budget', note: 'Price-sensitive · £500–£1.8k' },
  { country: 'GB', name: 'Wolverhampton',                  city: 'Wolverhampton', tier: 'budget', note: 'West Midlands market · £500–£1.8k' },

  // ════════════════════════════════════════════════
  // CANADA
  // ════════════════════════════════════════════════
  { country: 'CA', name: 'Yorkville, Toronto',             city: 'Toronto',     tier: 'high',   note: 'Luxury district · C$7k–C$28k' },
  { country: 'CA', name: 'West Vancouver',                 city: 'Vancouver',   tier: 'high',   note: 'Wealthy residential · C$7k–C$25k' },
  { country: 'CA', name: 'Financial District, Toronto',    city: 'Toronto',     tier: 'high',   note: 'Corporate core · C$6k–C$22k' },
  { country: 'CA', name: 'Yaletown, Vancouver',            city: 'Vancouver',   tier: 'high',   note: 'Tech & lifestyle · C$6k–C$20k' },
  { country: 'CA', name: 'Kitchener-Waterloo',             city: 'Waterloo',    tier: 'mid',    note: 'Tech corridor · C$3k–C$9k' },
  { country: 'CA', name: 'Downtown, Calgary',              city: 'Calgary',     tier: 'mid',    note: 'Energy & business · C$2.5k–C$8k' },
  { country: 'CA', name: 'Mississauga',                    city: 'Mississauga', tier: 'mid',    note: 'Suburban SMEs · C$2k–C$7k' },
  { country: 'CA', name: 'Downtown, Ottawa',               city: 'Ottawa',      tier: 'mid',    note: 'Government & tech · C$2.5k–C$8k' },
  { country: 'CA', name: 'Plateau-Mont-Royal, Montreal',   city: 'Montreal',    tier: 'mid',    note: 'Creative district · C$2k–C$7k' },
  { country: 'CA', name: 'Scarborough, Toronto',           city: 'Toronto',     tier: 'budget', note: 'High volume · C$800–C$2.5k' },
  { country: 'CA', name: 'Surrey, Vancouver',              city: 'Vancouver',   tier: 'budget', note: 'Price-sensitive · C$700–C$2.2k' },
  { country: 'CA', name: 'Brampton, Ontario',              city: 'Brampton',    tier: 'budget', note: 'Dense suburban · C$800–C$2.5k' },

  // ════════════════════════════════════════════════
  // NIGERIA — REMAINING STATES (Bayelsa, Ebonyi, Gombe, Jigawa, Katsina, Kebbi, Niger, Taraba, Yobe)
  // ════════════════════════════════════════════════
  { country: 'NG', name: 'GRA, Yenagoa',                  city: 'Yenagoa',    tier: 'high',   note: 'Bayelsa oil money · ₦200k–₦550k' },
  { country: 'NG', name: 'Yenagoa Township',               city: 'Yenagoa',    tier: 'mid',    note: 'Capital city core · ₦80k–₦240k' },
  { country: 'NG', name: 'Opolo, Yenagoa',                 city: 'Yenagoa',    tier: 'mid',    note: 'Commercial area · ₦80k–₦230k' },
  { country: 'NG', name: 'GRA, Abakaliki',                 city: 'Abakaliki',  tier: 'high',   note: 'Ebonyi professionals · ₦180k–₦480k' },
  { country: 'NG', name: 'Abakaliki Township',             city: 'Abakaliki',  tier: 'mid',    note: 'Capital city · ₦70k–₦220k' },
  { country: 'NG', name: 'GRA, Gombe',                     city: 'Gombe',      tier: 'high',   note: 'North East professionals · ₦180k–₦480k' },
  { country: 'NG', name: 'Gombe Township',                 city: 'Gombe',      tier: 'mid',    note: 'Capital city · ₦70k–₦220k' },
  { country: 'NG', name: 'Dutse Township',                 city: 'Dutse',      tier: 'mid',    note: 'Jigawa capital · ₦60k–₦180k' },
  { country: 'NG', name: 'GRA, Katsina',                   city: 'Katsina',    tier: 'high',   note: 'North West professionals · ₦200k–₦500k' },
  { country: 'NG', name: 'Katsina Township',               city: 'Katsina',    tier: 'mid',    note: 'Capital city · ₦70k–₦220k' },
  { country: 'NG', name: 'GRA, Birnin Kebbi',              city: 'Birnin Kebbi', tier: 'mid',  note: 'Kebbi capital · ₦80k–₦230k' },
  { country: 'NG', name: 'Birnin Kebbi Township',          city: 'Birnin Kebbi', tier: 'budget', note: 'Market area · ₦40k–₦130k' },
  { country: 'NG', name: 'GRA, Minna',                     city: 'Minna',      tier: 'high',   note: 'Niger State professionals · ₦200k–₦500k' },
  { country: 'NG', name: 'Chanchaga, Minna',               city: 'Minna',      tier: 'mid',    note: 'Commercial suburb · ₦80k–₦240k' },
  { country: 'NG', name: 'Minna Township',                 city: 'Minna',      tier: 'mid',    note: 'Capital city · ₦70k–₦220k' },
  { country: 'NG', name: 'GRA, Jalingo',                   city: 'Jalingo',    tier: 'mid',    note: 'Taraba capital · ₦80k–₦230k' },
  { country: 'NG', name: 'Jalingo Township',               city: 'Jalingo',    tier: 'budget', note: 'Market area · ₦40k–₦130k' },
  { country: 'NG', name: 'GRA, Damaturu',                  city: 'Damaturu',   tier: 'mid',    note: 'Yobe capital · ₦80k–₦230k' },
  { country: 'NG', name: 'Damaturu Township',              city: 'Damaturu',   tier: 'budget', note: 'Market area · ₦40k–₦130k' },

  // ════════════════════════════════════════════════
  // GHANA — REMAINING REGIONS
  // ════════════════════════════════════════════════
  { country: 'GH', name: 'Koforidua Township',             city: 'Koforidua',  tier: 'mid',    note: 'Eastern Region capital · GH₵1.5k–₵5k' },
  { country: 'GH', name: 'New Juaben, Koforidua',          city: 'Koforidua',  tier: 'mid',    note: 'Commercial hub · GH₵1.2k–₵4k' },
  { country: 'GH', name: 'Ho Township',                    city: 'Ho',         tier: 'mid',    note: 'Volta Region capital · GH₵1k–₵3.5k' },
  { country: 'GH', name: 'Sunyani Township',               city: 'Sunyani',    tier: 'mid',    note: 'Bono Region capital · GH₵1k–₵3k' },
  { country: 'GH', name: 'Techiman Township',              city: 'Techiman',   tier: 'mid',    note: 'Bono East · market city · GH₵1k–₵3.5k' },
  { country: 'GH', name: 'Bolgatanga Township',            city: 'Bolgatanga', tier: 'budget', note: 'Upper East capital · GH₵500–₵2k' },
  { country: 'GH', name: 'Wa Township',                    city: 'Wa',         tier: 'budget', note: 'Upper West capital · GH₵500–₵1.8k' },

  // ════════════════════════════════════════════════
  // SOUTH AFRICA — REMAINING PROVINCES
  // ════════════════════════════════════════════════
  { country: 'ZA', name: 'Newton Park, Gqeberha',          city: 'Gqeberha',   tier: 'mid',    note: 'Eastern Cape commercial · R4k–R12k' },
  { country: 'ZA', name: 'Walmer, Gqeberha',               city: 'Gqeberha',   tier: 'mid',    note: 'Upmarket suburb · R5k–R15k' },
  { country: 'ZA', name: 'Gqeberha CBD',                   city: 'Gqeberha',   tier: 'budget', note: 'City centre · R2k–R6k' },
  { country: 'ZA', name: 'Vincent, East London',           city: 'East London', tier: 'mid',   note: 'Eastern Cape suburb · R4k–R12k' },
  { country: 'ZA', name: 'East London CBD',                city: 'East London', tier: 'budget', note: 'City centre · R2k–R6k' },
  { country: 'ZA', name: 'Platinum Square, Polokwane',     city: 'Polokwane',  tier: 'mid',    note: 'Limpopo business hub · R4k–R12k' },
  { country: 'ZA', name: 'Polokwane CBD',                  city: 'Polokwane',  tier: 'budget', note: 'Limpopo capital · R2k–R6k' },
  { country: 'ZA', name: 'Rustenburg CBD',                 city: 'Rustenburg', tier: 'mid',    note: 'Platinum city · R4k–R12k' },
  { country: 'ZA', name: 'Waterfall Mall Area, Rustenburg',city: 'Rustenburg', tier: 'mid',    note: 'Growing suburb · R4k–R12k' },
  { country: 'ZA', name: 'Nelspruit CBD',                  city: 'Nelspruit',  tier: 'mid',    note: 'Mpumalanga capital · R3k–R9k' },
  { country: 'ZA', name: 'Riverside Mall Area, Nelspruit', city: 'Nelspruit',  tier: 'mid',    note: 'Retail corridor · R3.5k–R10k' },
  { country: 'ZA', name: 'Westdene, Bloemfontein',         city: 'Bloemfontein', tier: 'mid',  note: 'Free State professionals · R3k–R9k' },
  { country: 'ZA', name: 'Langenhoven Park, Bloemfontein', city: 'Bloemfontein', tier: 'mid',  note: 'Growing suburb · R3k–R9k' },
  { country: 'ZA', name: 'Bloemfontein CBD',               city: 'Bloemfontein', tier: 'budget', note: 'Judicial capital · R1.5k–R4k' },

  // ════════════════════════════════════════════════
  // UGANDA — REMAINING REGIONS
  // ════════════════════════════════════════════════
  { country: 'UG', name: 'Jinja City Centre',             city: 'Jinja',      tier: 'mid',    note: 'Source of Nile · USh500k–1.5M' },
  { country: 'UG', name: 'Kakira, Jinja',                 city: 'Jinja',      tier: 'mid',    note: 'Industrial suburb · USh400k–1.2M' },
  { country: 'UG', name: 'Gulu City Centre',              city: 'Gulu',       tier: 'mid',    note: 'Northern Uganda hub · USh500k–1.5M' },
  { country: 'UG', name: 'Pece, Gulu',                    city: 'Gulu',       tier: 'mid',    note: 'Commercial suburb · USh400k–1M' },
  { country: 'UG', name: 'Mbarara City Centre',           city: 'Mbarara',    tier: 'mid',    note: 'Western Uganda hub · USh500k–1.5M' },
  { country: 'UG', name: 'Kakoba, Mbarara',               city: 'Mbarara',    tier: 'mid',    note: 'Growing suburb · USh400k–1.2M' },

  // ════════════════════════════════════════════════
  // TANZANIA — ADDITIONAL REGIONS
  // ════════════════════════════════════════════════
  { country: 'TZ', name: 'Moshi City Centre',             city: 'Moshi',      tier: 'mid',    note: 'Kilimanjaro gateway · TSh150k–400k' },
  { country: 'TZ', name: 'Shantytown, Moshi',             city: 'Moshi',      tier: 'budget', note: 'Market area · TSh60k–180k' },
  { country: 'TZ', name: 'Dodoma City Centre',            city: 'Dodoma',     tier: 'mid',    note: 'Capital city · TSh150k–400k' },
  { country: 'TZ', name: 'Zanzibar Stone Town',           city: 'Zanzibar City', tier: 'high', note: 'Tourism premium · TSh400k–1M' },
  { country: 'TZ', name: 'Zanzibar City Centre',          city: 'Zanzibar City', tier: 'mid',  note: 'Island commerce · TSh150k–400k' },

  // ════════════════════════════════════════════════
  // RWANDA — REMAINING PROVINCES
  // ════════════════════════════════════════════════
  { country: 'RW', name: 'Rwamagana Town',                city: 'Rwamagana',  tier: 'mid',    note: 'Eastern Province hub · RWF120k–350k' },
  { country: 'RW', name: 'Musanze Town',                  city: 'Musanze',    tier: 'mid',    note: 'Northern Province · volcanoes tourism · RWF120k–350k' },
  { country: 'RW', name: 'Huye Town',                     city: 'Huye',       tier: 'mid',    note: 'Southern Province · university city · RWF100k–300k' },
  { country: 'RW', name: 'Muhanga Town',                  city: 'Muhanga',    tier: 'mid',    note: 'Southern Province hub · RWF100k–280k' },
  { country: 'RW', name: 'Rubavu Town',                   city: 'Rubavu',     tier: 'mid',    note: 'Western Province · Lake Kivu · RWF120k–350k' },

  // ════════════════════════════════════════════════
  // SENEGAL — ADDITIONAL REGIONS
  // ════════════════════════════════════════════════
  { country: 'SN', name: 'Thiès City Centre',             city: 'Thiès',      tier: 'mid',    note: 'Second city · XOF150k–400k' },
  { country: 'SN', name: 'Saint-Louis City Centre',       city: 'Saint-Louis',tier: 'mid',    note: 'Northern city · XOF120k–350k' },

  // ════════════════════════════════════════════════
  // CAMEROON — ADDITIONAL REGIONS
  // ════════════════════════════════════════════════
  { country: 'CM', name: 'Bamenda City Centre',           city: 'Bamenda',    tier: 'mid',    note: 'North West capital · XAF100k–300k' },
  { country: 'CM', name: 'Commercial Avenue, Bamenda',    city: 'Bamenda',    tier: 'mid',    note: 'Main business strip · XAF100k–280k' },
  { country: 'CM', name: 'Bafoussam City Centre',         city: 'Bafoussam',  tier: 'mid',    note: 'West Region capital · XAF120k–350k' },
  { country: 'CM', name: 'Garoua City Centre',            city: 'Garoua',     tier: 'mid',    note: 'North Region capital · XAF100k–280k' },
  { country: 'CM', name: 'Ngaoundéré City Centre',        city: 'Ngaoundéré', tier: 'mid',    note: 'Adamawa capital · XAF100k–280k' },
  { country: 'CM', name: 'Buea City Centre',              city: 'Buea',       tier: 'mid',    note: 'Mount Cameroon city · XAF100k–280k' },
];

export const TIER_CONFIG: Record<Tier, { label: string; color: string; dot: string; badge: string }> = {
  high:   { label: 'High-ticket', color: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
  mid:    { label: 'Mid-range',   color: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
  budget: { label: 'Budget',      color: 'text-gray-400',   dot: 'bg-gray-500',   badge: 'bg-gray-500/15 text-gray-300 border-gray-500/20' },
};

export interface StateRegion {
  code: string;
  name: string;
  country: string;
  cities: string[];
}

export const STATES: StateRegion[] = [

  // ════════════════════════════════════
  // NIGERIA — 36 states + FCT (alphabetical)
  // ════════════════════════════════════
  { code: 'NG-AB', name: 'Abia',         country: 'NG', cities: ['Aba', 'Umuahia'] },
  { code: 'NG-AD', name: 'Adamawa',      country: 'NG', cities: ['Yola'] },
  { code: 'NG-AK', name: 'Akwa Ibom',   country: 'NG', cities: ['Uyo', 'Ikot Ekpene', 'Eket'] },
  { code: 'NG-AN', name: 'Anambra',     country: 'NG', cities: ['Onitsha', 'Awka', 'Nnewi'] },
  { code: 'NG-BA', name: 'Bauchi',      country: 'NG', cities: ['Bauchi'] },
  { code: 'NG-BY', name: 'Bayelsa',     country: 'NG', cities: ['Yenagoa'] },
  { code: 'NG-BN', name: 'Benue',       country: 'NG', cities: ['Makurdi'] },
  { code: 'NG-BO', name: 'Borno',       country: 'NG', cities: ['Maiduguri'] },
  { code: 'NG-CR', name: 'Cross River', country: 'NG', cities: ['Calabar'] },
  { code: 'NG-DL', name: 'Delta',       country: 'NG', cities: ['Warri', 'Asaba'] },
  { code: 'NG-EB', name: 'Ebonyi',      country: 'NG', cities: ['Abakaliki'] },
  { code: 'NG-ED', name: 'Edo',         country: 'NG', cities: ['Benin City'] },
  { code: 'NG-EK', name: 'Ekiti',       country: 'NG', cities: ['Ado-Ekiti'] },
  { code: 'NG-EN', name: 'Enugu',       country: 'NG', cities: ['Enugu'] },
  { code: 'NG-FC', name: 'FCT – Abuja', country: 'NG', cities: ['Abuja'] },
  { code: 'NG-GO', name: 'Gombe',       country: 'NG', cities: ['Gombe'] },
  { code: 'NG-IM', name: 'Imo',         country: 'NG', cities: ['Owerri'] },
  { code: 'NG-JI', name: 'Jigawa',      country: 'NG', cities: ['Dutse'] },
  { code: 'NG-KD', name: 'Kaduna',      country: 'NG', cities: ['Kaduna'] },
  { code: 'NG-KN', name: 'Kano',        country: 'NG', cities: ['Kano'] },
  { code: 'NG-KT', name: 'Katsina',     country: 'NG', cities: ['Katsina'] },
  { code: 'NG-KE', name: 'Kebbi',       country: 'NG', cities: ['Birnin Kebbi'] },
  { code: 'NG-KO', name: 'Kogi',        country: 'NG', cities: ['Lokoja'] },
  { code: 'NG-KW', name: 'Kwara',       country: 'NG', cities: ['Ilorin'] },
  { code: 'NG-LA', name: 'Lagos',       country: 'NG', cities: ['Lagos'] },
  { code: 'NG-NA', name: 'Nasarawa',    country: 'NG', cities: ['Lafia'] },
  { code: 'NG-NI', name: 'Niger',       country: 'NG', cities: ['Minna'] },
  { code: 'NG-OG', name: 'Ogun',        country: 'NG', cities: ['Abeokuta', 'Sagamu', 'Ijebu-Ode'] },
  { code: 'NG-ON', name: 'Ondo',        country: 'NG', cities: ['Akure'] },
  { code: 'NG-OS', name: 'Osun',        country: 'NG', cities: ['Osogbo', 'Ile-Ife'] },
  { code: 'NG-OY', name: 'Oyo',         country: 'NG', cities: ['Ibadan', 'Ile-Ife'] },
  { code: 'NG-PL', name: 'Plateau',     country: 'NG', cities: ['Jos'] },
  { code: 'NG-RI', name: 'Rivers',      country: 'NG', cities: ['Port Harcourt'] },
  { code: 'NG-SO', name: 'Sokoto',      country: 'NG', cities: ['Sokoto'] },
  { code: 'NG-TA', name: 'Taraba',      country: 'NG', cities: ['Jalingo'] },
  { code: 'NG-YO', name: 'Yobe',        country: 'NG', cities: ['Damaturu'] },
  { code: 'NG-ZM', name: 'Zamfara',     country: 'NG', cities: ['Gusau'] },

  // ════════════════════════════════════
  // GHANA — all 16 regions
  // ════════════════════════════════════
  { code: 'GH-AF', name: 'Ahafo',         country: 'GH', cities: ['Goaso'] },
  { code: 'GH-AH', name: 'Ashanti',       country: 'GH', cities: ['Kumasi'] },
  { code: 'GH-BO', name: 'Bono',          country: 'GH', cities: ['Sunyani'] },
  { code: 'GH-BE', name: 'Bono East',     country: 'GH', cities: ['Techiman'] },
  { code: 'GH-CE', name: 'Central',       country: 'GH', cities: ['Cape Coast'] },
  { code: 'GH-EA', name: 'Eastern',       country: 'GH', cities: ['Koforidua'] },
  { code: 'GH-GA', name: 'Greater Accra', country: 'GH', cities: ['Accra', 'Tema', 'Kasoa'] },
  { code: 'GH-NE', name: 'North East',    country: 'GH', cities: ['Nalerigu'] },
  { code: 'GH-NR', name: 'Northern',      country: 'GH', cities: ['Tamale'] },
  { code: 'GH-OT', name: 'Oti',           country: 'GH', cities: ['Dambai'] },
  { code: 'GH-SV', name: 'Savannah',      country: 'GH', cities: ['Damongo'] },
  { code: 'GH-UE', name: 'Upper East',    country: 'GH', cities: ['Bolgatanga'] },
  { code: 'GH-UW', name: 'Upper West',    country: 'GH', cities: ['Wa'] },
  { code: 'GH-VO', name: 'Volta',         country: 'GH', cities: ['Ho'] },
  { code: 'GH-WE', name: 'Western',       country: 'GH', cities: ['Takoradi'] },
  { code: 'GH-WN', name: 'Western North', country: 'GH', cities: ['Sefwi Wiawso'] },

  // ════════════════════════════════════
  // KENYA — 47 counties (major commercial ones)
  // ════════════════════════════════════
  { code: 'KE-NA', name: 'Nairobi',         country: 'KE', cities: ['Nairobi'] },
  { code: 'KE-KI', name: 'Kiambu',          country: 'KE', cities: ['Thika', 'Ruiru', 'Kiambu'] },
  { code: 'KE-MO', name: 'Mombasa',         country: 'KE', cities: ['Mombasa'] },
  { code: 'KE-NA2',name: 'Nakuru',          country: 'KE', cities: ['Nakuru'] },
  { code: 'KE-UA', name: 'Uasin Gishu',     country: 'KE', cities: ['Eldoret'] },
  { code: 'KE-KS', name: 'Kisumu',          country: 'KE', cities: ['Kisumu'] },
  { code: 'KE-KA', name: 'Kakamega',        country: 'KE', cities: ['Kakamega'] },
  { code: 'KE-ME', name: 'Meru',            country: 'KE', cities: ['Meru'] },
  { code: 'KE-MA', name: 'Machakos',        country: 'KE', cities: ['Machakos', 'Athi River'] },
  { code: 'KE-NY', name: 'Nyeri',           country: 'KE', cities: ['Nyeri'] },
  { code: 'KE-KI2',name: 'Kilifi',          country: 'KE', cities: ['Malindi', 'Kilifi'] },
  { code: 'KE-KA2',name: 'Kajiado',         country: 'KE', cities: ['Ongata Rongai', 'Kitengela'] },
  { code: 'KE-MI', name: 'Migori',          country: 'KE', cities: ['Migori'] },
  { code: 'KE-BU', name: 'Bungoma',         country: 'KE', cities: ['Bungoma'] },
  { code: 'KE-KI3',name: 'Kisii',           country: 'KE', cities: ['Kisii'] },
  { code: 'KE-TR', name: 'Trans-Nzoia',     country: 'KE', cities: ['Kitale'] },
  { code: 'KE-TH', name: 'Tharaka-Nithi',   country: 'KE', cities: ['Chuka'] },
  { code: 'KE-HO', name: 'Homa Bay',        country: 'KE', cities: ['Homa Bay'] },
  { code: 'KE-SI', name: 'Siaya',           country: 'KE', cities: ['Siaya'] },
  { code: 'KE-KE', name: 'Kericho',         country: 'KE', cities: ['Kericho'] },
  { code: 'KE-NA3',name: 'Nandi',           country: 'KE', cities: ['Kapsabet'] },
  { code: 'KE-LA', name: 'Laikipia',        country: 'KE', cities: ['Nanyuki'] },
  { code: 'KE-KI4',name: 'Kirinyaga',       country: 'KE', cities: ['Kerugoya'] },
  { code: 'KE-EM', name: 'Embu',            country: 'KE', cities: ['Embu'] },
  { code: 'KE-WA', name: 'Wajir',           country: 'KE', cities: ['Wajir'] },
  { code: 'KE-GA', name: 'Garissa',         country: 'KE', cities: ['Garissa'] },
  { code: 'KE-MB', name: 'Mombasa (South)', country: 'KE', cities: ['Kwale'] },
  { code: 'KE-MS', name: 'Murang\'a',       country: 'KE', cities: ['Murang\'a'] },
  { code: 'KE-NR', name: 'Nyandarua',       country: 'KE', cities: ['Ol Kalou'] },
  { code: 'KE-KT', name: 'Kericho (Tea)',   country: 'KE', cities: ['Litein'] },
  { code: 'KE-TK', name: 'Turkana',         country: 'KE', cities: ['Lodwar'] },
  { code: 'KE-WE', name: 'West Pokot',      country: 'KE', cities: ['Kapenguria'] },
  { code: 'KE-SA', name: 'Samburu',         country: 'KE', cities: ['Maralal'] },
  { code: 'KE-EL', name: 'Elgeyo-Marakwet', country: 'KE', cities: ['Iten'] },
  { code: 'KE-BR', name: 'Baringo',         country: 'KE', cities: ['Kabarnet'] },
  { code: 'KE-NA4',name: 'Narok',           country: 'KE', cities: ['Narok'] },
  { code: 'KE-KA3',name: 'Kericho (West)',  country: 'KE', cities: ['Bomet'] },
  { code: 'KE-TA', name: 'Taita-Taveta',    country: 'KE', cities: ['Voi'] },
  { code: 'KE-KW', name: 'Kwale',           country: 'KE', cities: ['Kwale Town'] },
  { code: 'KE-TN', name: 'Tana River',      country: 'KE', cities: ['Hola'] },
  { code: 'KE-LM', name: 'Lamu',            country: 'KE', cities: ['Lamu'] },
  { code: 'KE-IS', name: 'Isiolo',          country: 'KE', cities: ['Isiolo'] },
  { code: 'KE-MR', name: 'Marsabit',        country: 'KE', cities: ['Marsabit'] },
  { code: 'KE-MA2',name: 'Mandera',         country: 'KE', cities: ['Mandera'] },
  { code: 'KE-SO', name: 'Kericho (South)', country: 'KE', cities: ['Sotik'] },
  { code: 'KE-VH', name: 'Vihiga',          country: 'KE', cities: ['Vihiga'] },
  { code: 'KE-NY2',name: 'Nyamira',         country: 'KE', cities: ['Nyamira'] },

  // ════════════════════════════════════
  // SOUTH AFRICA — all 9 provinces
  // ════════════════════════════════════
  { code: 'ZA-GT', name: 'Gauteng',         country: 'ZA', cities: ['Johannesburg', 'Pretoria', 'Midrand'] },
  { code: 'ZA-WC', name: 'Western Cape',    country: 'ZA', cities: ['Cape Town'] },
  { code: 'ZA-KN', name: 'KwaZulu-Natal',   country: 'ZA', cities: ['Durban'] },
  { code: 'ZA-EC', name: 'Eastern Cape',    country: 'ZA', cities: ['Gqeberha', 'East London'] },
  { code: 'ZA-LI', name: 'Limpopo',         country: 'ZA', cities: ['Polokwane'] },
  { code: 'ZA-MP', name: 'Mpumalanga',      country: 'ZA', cities: ['Nelspruit'] },
  { code: 'ZA-NW', name: 'North West',      country: 'ZA', cities: ['Rustenburg', 'Mahikeng'] },
  { code: 'ZA-FS', name: 'Free State',      country: 'ZA', cities: ['Bloemfontein'] },
  { code: 'ZA-NC', name: 'Northern Cape',   country: 'ZA', cities: ['Kimberley'] },

  // ════════════════════════════════════
  // UGANDA — 4 administrative regions
  // ════════════════════════════════════
  { code: 'UG-C',  name: 'Central',  country: 'UG', cities: ['Kampala', 'Mukono', 'Entebbe'] },
  { code: 'UG-E',  name: 'Eastern',  country: 'UG', cities: ['Jinja', 'Mbale', 'Soroti'] },
  { code: 'UG-N',  name: 'Northern', country: 'UG', cities: ['Gulu', 'Lira', 'Arua'] },
  { code: 'UG-W',  name: 'Western',  country: 'UG', cities: ['Mbarara', 'Fort Portal', 'Kasese'] },

  // ════════════════════════════════════
  // TANZANIA — major regions
  // ════════════════════════════════════
  { code: 'TZ-DA', name: 'Dar es Salaam',   country: 'TZ', cities: ['Dar es Salaam'] },
  { code: 'TZ-AR', name: 'Arusha',          country: 'TZ', cities: ['Arusha'] },
  { code: 'TZ-MW', name: 'Mwanza',          country: 'TZ', cities: ['Mwanza'] },
  { code: 'TZ-DO', name: 'Dodoma',          country: 'TZ', cities: ['Dodoma'] },
  { code: 'TZ-KI', name: 'Kilimanjaro',     country: 'TZ', cities: ['Moshi'] },
  { code: 'TZ-ZN', name: 'Zanzibar',        country: 'TZ', cities: ['Zanzibar City'] },
  { code: 'TZ-MO', name: 'Morogoro',        country: 'TZ', cities: ['Morogoro'] },
  { code: 'TZ-TA', name: 'Tanga',           country: 'TZ', cities: ['Tanga'] },
  { code: 'TZ-MB', name: 'Mbeya',           country: 'TZ', cities: ['Mbeya'] },
  { code: 'TZ-IR', name: 'Iringa',          country: 'TZ', cities: ['Iringa'] },
  { code: 'TZ-SO', name: 'Songwe',          country: 'TZ', cities: ['Vwawa'] },
  { code: 'TZ-GE', name: 'Geita',           country: 'TZ', cities: ['Geita'] },
  { code: 'TZ-KA', name: 'Kagera',          country: 'TZ', cities: ['Bukoba'] },
  { code: 'TZ-LI', name: 'Lindi',           country: 'TZ', cities: ['Lindi'] },
  { code: 'TZ-MA', name: 'Mara',            country: 'TZ', cities: ['Musoma'] },
  { code: 'TZ-MT', name: 'Mtwara',          country: 'TZ', cities: ['Mtwara'] },
  { code: 'TZ-RU', name: 'Rukwa',           country: 'TZ', cities: ['Sumbawanga'] },
  { code: 'TZ-RU2',name: 'Ruvuma',          country: 'TZ', cities: ['Songea'] },
  { code: 'TZ-SH', name: 'Shinyanga',       country: 'TZ', cities: ['Shinyanga'] },
  { code: 'TZ-SI', name: 'Simiyu',          country: 'TZ', cities: ['Bariadi'] },
  { code: 'TZ-SI2',name: 'Singida',         country: 'TZ', cities: ['Singida'] },
  { code: 'TZ-TB', name: 'Tabora',          country: 'TZ', cities: ['Tabora'] },
  { code: 'TZ-PW', name: 'Pwani (Coast)',   country: 'TZ', cities: ['Kibaha'] },
  { code: 'TZ-MA2',name: 'Manyara',         country: 'TZ', cities: ['Babati'] },
  { code: 'TZ-KA2',name: 'Katavi',          country: 'TZ', cities: ['Mpanda'] },
  { code: 'TZ-NJ', name: 'Njombe',          country: 'TZ', cities: ['Njombe'] },

  // ════════════════════════════════════
  // RWANDA — 5 provinces + Kigali
  // ════════════════════════════════════
  { code: 'RW-KG', name: 'Kigali City',     country: 'RW', cities: ['Kigali'] },
  { code: 'RW-EA', name: 'Eastern Province', country: 'RW', cities: ['Rwamagana'] },
  { code: 'RW-NO', name: 'Northern Province', country: 'RW', cities: ['Musanze'] },
  { code: 'RW-SO', name: 'Southern Province', country: 'RW', cities: ['Huye', 'Muhanga'] },
  { code: 'RW-WE', name: 'Western Province', country: 'RW', cities: ['Rubavu', 'Karongi'] },

  // ════════════════════════════════════
  // SENEGAL — 14 regions
  // ════════════════════════════════════
  { code: 'SN-DK', name: 'Dakar',        country: 'SN', cities: ['Dakar'] },
  { code: 'SN-TH', name: 'Thiès',        country: 'SN', cities: ['Thiès'] },
  { code: 'SN-SL', name: 'Saint-Louis',  country: 'SN', cities: ['Saint-Louis'] },
  { code: 'SN-DI', name: 'Diourbel',     country: 'SN', cities: ['Diourbel', 'Touba'] },
  { code: 'SN-KL', name: 'Kaolack',      country: 'SN', cities: ['Kaolack'] },
  { code: 'SN-FA', name: 'Fatick',       country: 'SN', cities: ['Fatick'] },
  { code: 'SN-KA', name: 'Kaffrine',     country: 'SN', cities: ['Kaffrine'] },
  { code: 'SN-KO', name: 'Kolda',        country: 'SN', cities: ['Kolda'] },
  { code: 'SN-LO', name: 'Louga',        country: 'SN', cities: ['Louga'] },
  { code: 'SN-MA', name: 'Matam',        country: 'SN', cities: ['Matam'] },
  { code: 'SN-SE', name: 'Sédhiou',      country: 'SN', cities: ['Sédhiou'] },
  { code: 'SN-TC', name: 'Tambacounda',  country: 'SN', cities: ['Tambacounda'] },
  { code: 'SN-ZI', name: 'Ziguinchor',   country: 'SN', cities: ['Ziguinchor'] },
  { code: 'SN-KD', name: 'Kédougou',     country: 'SN', cities: ['Kédougou'] },

  // ════════════════════════════════════
  // CAMEROON — all 10 regions
  // ════════════════════════════════════
  { code: 'CM-AD', name: 'Adamawa',     country: 'CM', cities: ['Ngaoundéré'] },
  { code: 'CM-CE', name: 'Centre',      country: 'CM', cities: ['Yaoundé'] },
  { code: 'CM-ES', name: 'East',        country: 'CM', cities: ['Bertoua'] },
  { code: 'CM-FN', name: 'Far North',   country: 'CM', cities: ['Maroua'] },
  { code: 'CM-LT', name: 'Littoral',    country: 'CM', cities: ['Douala'] },
  { code: 'CM-NO', name: 'North',       country: 'CM', cities: ['Garoua'] },
  { code: 'CM-NW', name: 'North West',  country: 'CM', cities: ['Bamenda'] },
  { code: 'CM-SO', name: 'South',       country: 'CM', cities: ['Ebolowa'] },
  { code: 'CM-SW', name: 'South West',  country: 'CM', cities: ['Buea'] },
  { code: 'CM-WE', name: 'West',        country: 'CM', cities: ['Bafoussam'] },

  // ════════════════════════════════════
  // UNITED STATES — major states
  // ════════════════════════════════════
  { code: 'US-NY', name: 'New York',       country: 'US', cities: ['New York'] },
  { code: 'US-CA', name: 'California',     country: 'US', cities: ['Los Angeles', 'San Francisco'] },
  { code: 'US-TX', name: 'Texas',          country: 'US', cities: ['Austin', 'Dallas', 'Houston'] },
  { code: 'US-FL', name: 'Florida',        country: 'US', cities: ['Miami', 'Orlando', 'Tampa'] },
  { code: 'US-IL', name: 'Illinois',       country: 'US', cities: ['Chicago'] },
  { code: 'US-GA', name: 'Georgia',        country: 'US', cities: ['Atlanta'] },
  { code: 'US-WA', name: 'Washington',     country: 'US', cities: ['Seattle'] },
  { code: 'US-MA', name: 'Massachusetts',  country: 'US', cities: ['Boston'] },
  { code: 'US-PA', name: 'Pennsylvania',   country: 'US', cities: ['Philadelphia', 'Pittsburgh'] },
  { code: 'US-AZ', name: 'Arizona',        country: 'US', cities: ['Phoenix', 'Scottsdale'] },
  { code: 'US-CO', name: 'Colorado',       country: 'US', cities: ['Denver'] },
  { code: 'US-NC', name: 'North Carolina', country: 'US', cities: ['Charlotte', 'Raleigh'] },
  { code: 'US-TN', name: 'Tennessee',      country: 'US', cities: ['Nashville', 'Memphis'] },
  { code: 'US-VA', name: 'Virginia',       country: 'US', cities: ['Richmond', 'Arlington'] },
  { code: 'US-NJ', name: 'New Jersey',     country: 'US', cities: ['Newark', 'Jersey City'] },
  { code: 'US-MI', name: 'Michigan',       country: 'US', cities: ['Detroit'] },
  { code: 'US-OH', name: 'Ohio',           country: 'US', cities: ['Columbus', 'Cleveland'] },
  { code: 'US-MN', name: 'Minnesota',      country: 'US', cities: ['Minneapolis'] },
  { code: 'US-OR', name: 'Oregon',         country: 'US', cities: ['Portland'] },
  { code: 'US-NV', name: 'Nevada',         country: 'US', cities: ['Las Vegas'] },
  { code: 'US-MD', name: 'Maryland',       country: 'US', cities: ['Baltimore'] },
  { code: 'US-MO', name: 'Missouri',       country: 'US', cities: ['St. Louis', 'Kansas City'] },
  { code: 'US-IN', name: 'Indiana',        country: 'US', cities: ['Indianapolis'] },
  { code: 'US-WI', name: 'Wisconsin',      country: 'US', cities: ['Milwaukee'] },
  { code: 'US-UT', name: 'Utah',           country: 'US', cities: ['Salt Lake City'] },
  { code: 'US-LA', name: 'Louisiana',      country: 'US', cities: ['New Orleans'] },
  { code: 'US-SC', name: 'South Carolina', country: 'US', cities: ['Charleston'] },
  { code: 'US-KY', name: 'Kentucky',       country: 'US', cities: ['Louisville'] },
  { code: 'US-OK', name: 'Oklahoma',       country: 'US', cities: ['Oklahoma City'] },
  { code: 'US-CT', name: 'Connecticut',    country: 'US', cities: ['Hartford', 'Stamford'] },
  { code: 'US-AL', name: 'Alabama',        country: 'US', cities: ['Birmingham'] },
  { code: 'US-MS', name: 'Mississippi',    country: 'US', cities: ['Jackson'] },
  { code: 'US-AR', name: 'Arkansas',       country: 'US', cities: ['Little Rock'] },
  { code: 'US-IA', name: 'Iowa',           country: 'US', cities: ['Des Moines'] },
  { code: 'US-KS', name: 'Kansas',         country: 'US', cities: ['Wichita'] },
  { code: 'US-NM', name: 'New Mexico',     country: 'US', cities: ['Albuquerque'] },
  { code: 'US-NE', name: 'Nebraska',       country: 'US', cities: ['Omaha'] },
  { code: 'US-ID', name: 'Idaho',          country: 'US', cities: ['Boise'] },
  { code: 'US-HI', name: 'Hawaii',         country: 'US', cities: ['Honolulu'] },
  { code: 'US-AK', name: 'Alaska',         country: 'US', cities: ['Anchorage'] },
  { code: 'US-DC', name: 'Washington D.C.', country: 'US', cities: ['Washington D.C.'] },

  // ════════════════════════════════════
  // UNITED KINGDOM — all regions
  // ════════════════════════════════════
  { code: 'GB-LN', name: 'London',            country: 'GB', cities: ['London'] },
  { code: 'GB-GM', name: 'Greater Manchester', country: 'GB', cities: ['Manchester', 'Salford'] },
  { code: 'GB-NW', name: 'North West (Merseyside)', country: 'GB', cities: ['Liverpool'] },
  { code: 'GB-WM', name: 'West Midlands',     country: 'GB', cities: ['Birmingham', 'Wolverhampton', 'Coventry'] },
  { code: 'GB-WY', name: 'West Yorkshire',    country: 'GB', cities: ['Leeds', 'Bradford'] },
  { code: 'GB-SY', name: 'South Yorkshire',   country: 'GB', cities: ['Sheffield'] },
  { code: 'GB-EM', name: 'East Midlands',     country: 'GB', cities: ['Nottingham', 'Leicester'] },
  { code: 'GB-BS', name: 'South West (Bristol)', country: 'GB', cities: ['Bristol'] },
  { code: 'GB-SE', name: 'South East',        country: 'GB', cities: ['Brighton', 'Southampton'] },
  { code: 'GB-NE', name: 'North East',        country: 'GB', cities: ['Newcastle', 'Sunderland'] },
  { code: 'GB-EA', name: 'East of England',   country: 'GB', cities: ['Norwich', 'Cambridge'] },
  { code: 'GB-SC', name: 'Scotland',          country: 'GB', cities: ['Glasgow', 'Edinburgh', 'Aberdeen'] },
  { code: 'GB-WL', name: 'Wales',             country: 'GB', cities: ['Cardiff', 'Swansea'] },
  { code: 'GB-NI', name: 'Northern Ireland',  country: 'GB', cities: ['Belfast'] },

  // ════════════════════════════════════
  // CANADA — all provinces & territories
  // ════════════════════════════════════
  { code: 'CA-ON', name: 'Ontario',           country: 'CA', cities: ['Toronto', 'Mississauga', 'Brampton', 'Waterloo', 'Ottawa', 'Hamilton'] },
  { code: 'CA-BC', name: 'British Columbia',  country: 'CA', cities: ['Vancouver', 'Surrey', 'Victoria'] },
  { code: 'CA-AB', name: 'Alberta',           country: 'CA', cities: ['Calgary', 'Edmonton'] },
  { code: 'CA-QC', name: 'Quebec',            country: 'CA', cities: ['Montreal', 'Quebec City'] },
  { code: 'CA-MB', name: 'Manitoba',          country: 'CA', cities: ['Winnipeg'] },
  { code: 'CA-SK', name: 'Saskatchewan',      country: 'CA', cities: ['Regina', 'Saskatoon'] },
  { code: 'CA-NS', name: 'Nova Scotia',       country: 'CA', cities: ['Halifax'] },
  { code: 'CA-NB', name: 'New Brunswick',     country: 'CA', cities: ['Moncton', 'Fredericton'] },
  { code: 'CA-NL', name: 'Newfoundland',      country: 'CA', cities: ['St. John\'s'] },
  { code: 'CA-PE', name: 'PEI',               country: 'CA', cities: ['Charlottetown'] },
  { code: 'CA-NT', name: 'Northwest Territories', country: 'CA', cities: ['Yellowknife'] },
  { code: 'CA-YT', name: 'Yukon',             country: 'CA', cities: ['Whitehorse'] },
  { code: 'CA-NU', name: 'Nunavut',           country: 'CA', cities: ['Iqaluit'] },
];
