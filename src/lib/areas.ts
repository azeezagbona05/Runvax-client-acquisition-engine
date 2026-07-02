export type Tier = 'high' | 'mid' | 'budget';

export interface Area {
  name: string;
  city: string;
  tier: Tier;
  note: string;
  country: string;
}

export const AREAS: Area[] = [
  // ── Nigeria · Lagos High-ticket ──
  { country: 'NG', name: 'Ikoyi, Lagos',              city: 'Lagos',         tier: 'high',   note: 'Wealthiest district · ₦800k–₦3M' },
  { country: 'NG', name: 'Victoria Island, Lagos',    city: 'Lagos',         tier: 'high',   note: 'Corporate & luxury · ₦600k–₦2M' },
  { country: 'NG', name: 'Banana Island, Lagos',      city: 'Lagos',         tier: 'high',   note: 'Ultra-premium · ₦1M+' },
  { country: 'NG', name: 'Lekki Phase 1, Lagos',      city: 'Lagos',         tier: 'high',   note: 'Growing premium · ₦400k–₦1.5M' },
  { country: 'NG', name: 'Eti-Osa, Lagos',            city: 'Lagos',         tier: 'high',   note: 'Tech & corporate hub · ₦400k–₦1M' },
  // ── Nigeria · Lagos Mid-range ──
  { country: 'NG', name: 'Ikeja GRA, Lagos',          city: 'Lagos',         tier: 'mid',    note: 'Established SMEs · ₦200k–₦500k' },
  { country: 'NG', name: 'Maryland, Lagos',           city: 'Lagos',         tier: 'mid',    note: 'Commercial · ₦150k–₦400k' },
  { country: 'NG', name: 'Gbagada, Lagos',            city: 'Lagos',         tier: 'mid',    note: 'Residential-commercial mix · ₦150k–₦350k' },
  { country: 'NG', name: 'Magodo, Lagos',             city: 'Lagos',         tier: 'mid',    note: 'Educated middle class · ₦200k–₦400k' },
  { country: 'NG', name: 'Lekki Phase 2, Lagos',      city: 'Lagos',         tier: 'mid',    note: 'Developing market · ₦200k–₦500k' },
  { country: 'NG', name: 'Ajah, Lagos',               city: 'Lagos',         tier: 'mid',    note: 'Fast-growing area · ₦150k–₦350k' },
  { country: 'NG', name: 'Yaba, Lagos',               city: 'Lagos',         tier: 'mid',    note: 'Tech hub & students · ₦100k–₦300k' },
  { country: 'NG', name: 'Surulere, Lagos',           city: 'Lagos',         tier: 'mid',    note: 'Dense market · ₦100k–₦300k' },
  { country: 'NG', name: 'Sangotedo, Lagos',          city: 'Lagos',         tier: 'mid',    note: 'New estates · ₦150k–₦400k' },
  // ── Nigeria · Lagos Budget ──
  { country: 'NG', name: 'Ikeja, Lagos',              city: 'Lagos',         tier: 'budget', note: 'High volume · ₦80k–₦200k' },
  { country: 'NG', name: 'Ikorodu, Lagos',            city: 'Lagos',         tier: 'budget', note: 'Large market · ₦50k–₦150k' },
  { country: 'NG', name: 'Alimosho, Lagos',           city: 'Lagos',         tier: 'budget', note: 'Highest density · ₦50k–₦150k' },
  { country: 'NG', name: 'Ayobo, Lagos',              city: 'Lagos',         tier: 'budget', note: 'Very price-sensitive · ₦40k–₦120k' },
  { country: 'NG', name: 'Ipaja, Lagos',              city: 'Lagos',         tier: 'budget', note: 'High volume needed · ₦40k–₦120k' },
  { country: 'NG', name: 'Mushin, Lagos',             city: 'Lagos',         tier: 'budget', note: 'Budget market · ₦30k–₦100k' },
  { country: 'NG', name: 'Oshodi, Lagos',             city: 'Lagos',         tier: 'budget', note: 'Trade-focused · ₦50k–₦120k' },
  { country: 'NG', name: 'Agege, Lagos',              city: 'Lagos',         tier: 'budget', note: 'Price-sensitive · ₦30k–₦100k' },
  // ── Nigeria · Abuja ──
  { country: 'NG', name: 'Maitama, Abuja',            city: 'Abuja',         tier: 'high',   note: 'Ministers & executives · ₦800k–₦3M' },
  { country: 'NG', name: 'Asokoro, Abuja',            city: 'Abuja',         tier: 'high',   note: 'Government elite · ₦600k–₦2M' },
  { country: 'NG', name: 'Wuse 2, Abuja',             city: 'Abuja',         tier: 'high',   note: 'Corporate hub · ₦400k–₦1.2M' },
  { country: 'NG', name: 'Jabi, Abuja',               city: 'Abuja',         tier: 'high',   note: 'Premium retail · ₦400k–₦1M' },
  { country: 'NG', name: 'Garki, Abuja',              city: 'Abuja',         tier: 'mid',    note: 'Established business · ₦200k–₦500k' },
  { country: 'NG', name: 'Gwarinpa, Abuja',           city: 'Abuja',         tier: 'mid',    note: 'Growing estates · ₦150k–₦400k' },
  { country: 'NG', name: 'Karu, Abuja',               city: 'Abuja',         tier: 'mid',    note: 'Dense SME market · ₦100k–₦300k' },
  { country: 'NG', name: 'Kubwa, Abuja',              city: 'Abuja',         tier: 'mid',    note: 'Satellite town · ₦100k–₦250k' },
  // ── Nigeria · Other cities ──
  { country: 'NG', name: 'GRA, Port Harcourt',        city: 'Port Harcourt', tier: 'high',   note: 'Oil-money area · ₦500k–₦1.5M' },
  { country: 'NG', name: 'Rumuola, Port Harcourt',    city: 'Port Harcourt', tier: 'mid',    note: 'Commercial district · ₦150k–₦400k' },
  { country: 'NG', name: 'Trans Amadi, Port Harcourt',city: 'Port Harcourt', tier: 'mid',    note: 'Industrial/SME · ₦150k–₦400k' },
  { country: 'NG', name: 'GRA, Enugu',                city: 'Enugu',         tier: 'high',   note: 'Premium clients · ₦300k–₦800k' },
  { country: 'NG', name: 'Independence Layout, Enugu',city: 'Enugu',         tier: 'mid',    note: 'Established businesses · ₦150k–₦350k' },
  { country: 'NG', name: 'Bodija, Ibadan',            city: 'Ibadan',        tier: 'high',   note: 'Educated professionals · ₦200k–₦600k' },
  { country: 'NG', name: 'Dugbe, Ibadan',             city: 'Ibadan',        tier: 'mid',    note: 'Dense commercial · ₦100k–₦300k' },
  { country: 'NG', name: 'Nassarawa, Kano',           city: 'Kano',          tier: 'high',   note: 'Wealthy traders · ₦300k–₦800k' },
  { country: 'NG', name: 'Sabon Gari, Kano',          city: 'Kano',          tier: 'mid',    note: 'Active commerce · ₦100k–₦300k' },
  { country: 'NG', name: 'GRA, Benin City',           city: 'Benin City',    tier: 'high',   note: 'Premium clients · ₦250k–₦700k' },
  { country: 'NG', name: 'Sapele Road, Benin City',   city: 'Benin City',    tier: 'mid',    note: 'Commercial strip · ₦100k–₦300k' },

  // ── Ghana ──
  { country: 'GH', name: 'East Legon, Accra, Ghana',          city: 'Accra',    tier: 'high',   note: 'Wealthy residential · GH₵8k–₵25k' },
  { country: 'GH', name: 'Airport Residential, Accra, Ghana', city: 'Accra',    tier: 'high',   note: 'Expats & executives · GH₵10k–₵30k' },
  { country: 'GH', name: 'Cantonments, Accra, Ghana',         city: 'Accra',    tier: 'high',   note: 'Diplomatic & corporate · GH₵8k–₵20k' },
  { country: 'GH', name: 'Labone, Accra, Ghana',              city: 'Accra',    tier: 'high',   note: 'Affluent professionals · GH₵6k–₵15k' },
  { country: 'GH', name: 'Osu, Accra, Ghana',                 city: 'Accra',    tier: 'mid',    note: 'Busy commercial strip · GH₵3k–₵8k' },
  { country: 'GH', name: 'Adabraka, Accra, Ghana',            city: 'Accra',    tier: 'mid',    note: 'Active SME area · GH₵2k–₵6k' },
  { country: 'GH', name: 'Dansoman, Accra, Ghana',            city: 'Accra',    tier: 'budget', note: 'High density · GH₵1k–₵3k' },
  { country: 'GH', name: 'Adum, Kumasi, Ghana',               city: 'Kumasi',   tier: 'mid',    note: 'Kumasi city centre · GH₵2k–₵6k' },
  { country: 'GH', name: 'Takoradi, Ghana',                   city: 'Takoradi', tier: 'mid',    note: 'Oil & port city · GH₵3k–₵8k' },

  // ── Kenya ──
  { country: 'KE', name: 'Karen, Nairobi, Kenya',          city: 'Nairobi',  tier: 'high',   note: 'Expat & wealthy suburb · KSh80k–250k' },
  { country: 'KE', name: 'Westlands, Nairobi, Kenya',      city: 'Nairobi',  tier: 'high',   note: 'Corporate & retail hub · KSh60k–200k' },
  { country: 'KE', name: 'Kilimani, Nairobi, Kenya',       city: 'Nairobi',  tier: 'high',   note: 'Upmarket residential · KSh60k–180k' },
  { country: 'KE', name: 'Lavington, Nairobi, Kenya',      city: 'Nairobi',  tier: 'high',   note: 'Premium professionals · KSh70k–200k' },
  { country: 'KE', name: 'Parklands, Nairobi, Kenya',      city: 'Nairobi',  tier: 'mid',    note: 'Established business · KSh30k–80k' },
  { country: 'KE', name: 'South B, Nairobi, Kenya',        city: 'Nairobi',  tier: 'mid',    note: 'Residential SMEs · KSh20k–60k' },
  { country: 'KE', name: 'Nairobi CBD, Kenya',             city: 'Nairobi',  tier: 'mid',    note: 'High-volume commerce · KSh20k–50k' },
  { country: 'KE', name: 'Mombasa CBD, Kenya',             city: 'Mombasa',  tier: 'mid',    note: 'Coastal commercial · KSh20k–60k' },
  { country: 'KE', name: 'Nyali, Mombasa, Kenya',          city: 'Mombasa',  tier: 'high',   note: 'Upmarket coastal · KSh50k–150k' },
  { country: 'KE', name: 'Kisumu CBD, Kenya',              city: 'Kisumu',   tier: 'mid',    note: 'Lake region hub · KSh15k–40k' },

  // ── South Africa ──
  { country: 'ZA', name: 'Sandton, Johannesburg, South Africa',    city: 'Johannesburg', tier: 'high',   note: "Africa's richest sq mile · R15k–80k" },
  { country: 'ZA', name: 'Rosebank, Johannesburg, South Africa',   city: 'Johannesburg', tier: 'high',   note: 'Corporate & lifestyle · R10k–50k' },
  { country: 'ZA', name: 'Fourways, Johannesburg, South Africa',   city: 'Johannesburg', tier: 'high',   note: 'Suburban premium · R10k–40k' },
  { country: 'ZA', name: 'Midrand, South Africa',                  city: 'Midrand',      tier: 'mid',    note: 'Tech corridor · R6k–20k' },
  { country: 'ZA', name: 'Pretoria East, South Africa',            city: 'Pretoria',     tier: 'mid',    note: 'Affluent suburbs · R8k–25k' },
  { country: 'ZA', name: 'V&A Waterfront, Cape Town, South Africa',city: 'Cape Town',    tier: 'high',   note: 'Tourism & premium retail · R15k–60k' },
  { country: 'ZA', name: 'Claremont, Cape Town, South Africa',     city: 'Cape Town',    tier: 'mid',    note: 'Southern suburbs · R8k–25k' },
  { country: 'ZA', name: 'Umhlanga, Durban, South Africa',         city: 'Durban',       tier: 'high',   note: 'Upmarket coastal · R10k–35k' },

  // ── Uganda ──
  { country: 'UG', name: 'Kololo, Kampala, Uganda',     city: 'Kampala', tier: 'high',   note: 'Elite residential · USh3M–8M' },
  { country: 'UG', name: 'Nakasero, Kampala, Uganda',   city: 'Kampala', tier: 'high',   note: 'Corporate & embassy · USh2M–6M' },
  { country: 'UG', name: 'Ntinda, Kampala, Uganda',     city: 'Kampala', tier: 'mid',    note: 'Growing suburb · USh800k–2M' },
  { country: 'UG', name: 'Kampala CBD, Uganda',         city: 'Kampala', tier: 'mid',    note: 'High-volume commerce · USh600k–1.5M' },
  { country: 'UG', name: 'Muyenga, Kampala, Uganda',    city: 'Kampala', tier: 'mid',    note: 'Residential commercial · USh700k–2M' },

  // ── Tanzania ──
  { country: 'TZ', name: 'Masaki, Dar es Salaam, Tanzania',     city: 'Dar es Salaam', tier: 'high',   note: 'Expat & elite · TSh500k–1.5M' },
  { country: 'TZ', name: 'Oyster Bay, Dar es Salaam, Tanzania', city: 'Dar es Salaam', tier: 'high',   note: 'Diplomatic suburb · TSh400k–1.2M' },
  { country: 'TZ', name: 'Mikocheni, Dar es Salaam, Tanzania',  city: 'Dar es Salaam', tier: 'mid',    note: 'Growing commercial · TSh200k–500k' },
  { country: 'TZ', name: 'Arusha CBD, Tanzania',                city: 'Arusha',        tier: 'mid',    note: 'Safari & tourism hub · TSh200k–600k' },

  // ── Rwanda ──
  { country: 'RW', name: 'Kiyovu, Kigali, Rwanda',     city: 'Kigali', tier: 'high',   note: 'Premium Kigali · RWF600k–1.5M' },
  { country: 'RW', name: 'Nyarutarama, Kigali, Rwanda',city: 'Kigali', tier: 'high',   note: 'Expat & exec suburb · RWF500k–1.2M' },
  { country: 'RW', name: 'Kimihurura, Kigali, Rwanda', city: 'Kigali', tier: 'mid',    note: 'Growing commercial · RWF200k–600k' },

  // ── Senegal ──
  { country: 'SN', name: 'Plateau, Dakar, Senegal',    city: 'Dakar',  tier: 'high',   note: 'Business district · XOF600k–1.5M' },
  { country: 'SN', name: 'Almadies, Dakar, Senegal',   city: 'Dakar',  tier: 'high',   note: 'Upmarket & expat · XOF500k–1.2M' },
  { country: 'SN', name: 'Mermoz, Dakar, Senegal',     city: 'Dakar',  tier: 'mid',    note: 'Professional class · XOF200k–500k' },

  // ── Cameroon ──
  { country: 'CM', name: 'Bastos, Yaoundé, Cameroon',  city: 'Yaoundé', tier: 'high',   note: 'Diplomatic & elite · XAF500k–1.2M' },
  { country: 'CM', name: 'Bonanjo, Douala, Cameroon',  city: 'Douala',  tier: 'high',   note: 'Business district · XAF400k–1M' },
  { country: 'CM', name: 'Akwa, Douala, Cameroon',     city: 'Douala',  tier: 'mid',    note: 'Commercial centre · XAF150k–400k' },

  // ── United States ──
  { country: 'US', name: 'Manhattan, New York, USA',        city: 'New York',      tier: 'high',   note: 'Luxury & finance · $8k–$30k' },
  { country: 'US', name: 'Beverly Hills, Los Angeles, USA', city: 'Los Angeles',   tier: 'high',   note: 'High-end retail · $7k–$25k' },
  { country: 'US', name: 'SoMa, San Francisco, USA',        city: 'San Francisco', tier: 'high',   note: 'Tech & startups · $8k–$30k' },
  { country: 'US', name: 'Downtown, Miami, USA',            city: 'Miami',         tier: 'high',   note: 'Affluent & corporate · $6k–$20k' },
  { country: 'US', name: 'Buckhead, Atlanta, USA',          city: 'Atlanta',       tier: 'mid',    note: 'Upscale business · $3k–$10k' },
  { country: 'US', name: 'Downtown, Austin, USA',           city: 'Austin',        tier: 'mid',    note: 'Growing SME hub · $3k–$9k' },
  { country: 'US', name: 'Brooklyn, New York, USA',         city: 'New York',      tier: 'mid',    note: 'Dense SME market · $2.5k–$8k' },
  { country: 'US', name: 'Plano, Dallas, USA',              city: 'Dallas',        tier: 'mid',    note: 'Suburban business · $2k–$7k' },
  { country: 'US', name: 'Queens, New York, USA',           city: 'New York',      tier: 'budget', note: 'High volume · $800–$2.5k' },
  { country: 'US', name: 'East LA, Los Angeles, USA',       city: 'Los Angeles',   tier: 'budget', note: 'Price-sensitive · $700–$2k' },

  // ── United Kingdom ──
  { country: 'GB', name: 'Mayfair, London, UK',             city: 'London',     tier: 'high',   note: 'Luxury & wealth · £6k–£25k' },
  { country: 'GB', name: 'Kensington, London, UK',          city: 'London',     tier: 'high',   note: 'Affluent residential · £5k–£20k' },
  { country: 'GB', name: 'Canary Wharf, London, UK',        city: 'London',     tier: 'high',   note: 'Corporate & finance · £6k–£22k' },
  { country: 'GB', name: 'Shoreditch, London, UK',          city: 'London',     tier: 'mid',    note: 'Creative & startups · £2.5k–£8k' },
  { country: 'GB', name: 'City Centre, Manchester, UK',     city: 'Manchester', tier: 'mid',    note: 'Northern business hub · £2k–£7k' },
  { country: 'GB', name: 'City Centre, Birmingham, UK',     city: 'Birmingham', tier: 'mid',    note: 'Active SME market · £1.8k–£6k' },
  { country: 'GB', name: 'Croydon, London, UK',             city: 'London',     tier: 'budget', note: 'High volume · £600–£2k' },
  { country: 'GB', name: 'Bradford, UK',                    city: 'Bradford',   tier: 'budget', note: 'Price-sensitive · £500–£1.8k' },

  // ── Canada ──
  { country: 'CA', name: 'Yorkville, Toronto, Canada',          city: 'Toronto',     tier: 'high',   note: 'Luxury district · C$7k–C$28k' },
  { country: 'CA', name: 'West Vancouver, Canada',              city: 'Vancouver',   tier: 'high',   note: 'Wealthy residential · C$7k–C$25k' },
  { country: 'CA', name: 'Financial District, Toronto, Canada', city: 'Toronto',     tier: 'high',   note: 'Corporate core · C$6k–C$22k' },
  { country: 'CA', name: 'Kitchener-Waterloo, Canada',         city: 'Waterloo',    tier: 'mid',    note: 'Tech corridor · C$3k–C$9k' },
  { country: 'CA', name: 'Downtown, Calgary, Canada',           city: 'Calgary',     tier: 'mid',    note: 'Energy & business · C$2.5k–C$8k' },
  { country: 'CA', name: 'Mississauga, Canada',                 city: 'Mississauga', tier: 'mid',    note: 'Suburban SMEs · C$2k–C$7k' },
  { country: 'CA', name: 'Scarborough, Toronto, Canada',        city: 'Toronto',     tier: 'budget', note: 'High volume · C$800–C$2.5k' },
  { country: 'CA', name: 'Surrey, Vancouver, Canada',           city: 'Vancouver',   tier: 'budget', note: 'Price-sensitive · C$700–C$2.2k' },
];

export const TIER_CONFIG: Record<Tier, { label: string; color: string; dot: string; badge: string }> = {
  high:   { label: '🏆 High-ticket',   color: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
  mid:    { label: '💼 Mid-range',     color: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
  budget: { label: '💰 Budget market', color: 'text-gray-400',   dot: 'bg-gray-500',   badge: 'bg-gray-500/15 text-gray-300 border-gray-500/20' },
};
