// lib/mock-data.js

const LOCATIONS = [
  { id: "Slot No. 21 R.P Road", name: "M/S Prabhat to Priya Sweets", area: 6200, cap: 70, col: "Sri Manab Haloi" },
  { id: "Slot No. 35 R.G Baruah Road", name: "Dainik Janambhumi to Srinagar Path Junction (Both Side)", area: 5500, cap: 60, col: "M/S Kalita Enterprise" },
  { id: "Slot at Ganeshguri Flyover", name: "Ganeshguri Flyover", area: 4800, cap: 50, col: "Sri Sanjay Kr. Das" },
  { id: "Slot No. 49 SRCB Road", name: "Opposite Raj Hotel to Fancy Bazar Police Outpost", area: 5000, cap: 65, col: "Smt. Moonmy Borah" },
  { id: "Slot No. 41", name: "Pratiksha Hospital entrance point to Jonaki Path entrance", area: 7000, cap: 80, col: "Sri Jupitar Bhuyan" },
  { id: "Slot No. 19 G.S. Road", name: "Times of India Office to Saharia's Path Lab (Both Side)", area: 6500, cap: 75, col: "M/S J.K Enterprise" },
  { id: "Slot No. 5 G.S. Road", name: "Dihang Arcade to Orion Palace East Side", area: 4200, cap: 45, col: "Sri Sanjay Kr. Das" },
  { id: "Slot No. 2 H.B. Road", name: "Cotton Collegiate road Junction to Paltanbazar Police Point South Side", area: 8500, cap: 90, col: "Sri Dipu Das" },
  { id: "Slot No. 7 A.T. Road", name: "Col J. Ali Road Junction to Viswaratna Hotel", area: 7200, cap: 85, col: "M/S Manash Enterprise" },
  { id: "Slot No. 10 G.S. Road", name: "Guwahati Sanitary to Silver Square", area: 9000, cap: 100, col: "M/S Mahakal Enterprise" },
  { id: "Slot at Lachit Ghat Parking", name: "Lachit Ghat Parking", area: 12000, cap: 130, col: "M/S Jupitara Traders" },
  { id: "Slot No. 29 Betkuchi", name: "Betkuchi Wholesale Market (Both Side)", area: 4600, cap: 50, col: "M/S Sarania Enterprise" },
  { id: "Slot No. 27 Jaswant Road", name: "M.G. Road Junction to C.K Road Junction (One Side)", area: 8000, cap: 90, col: "Sri Sanjay Kr. Das" },
  { id: "Slot No. 38 Beltola Basistha Road", name: "Opp. Sankardev Netralaya Office to AG Office Junction", area: 5400, cap: 60, col: "M/S J.K Enterprise" },
  { id: "Slot No. 40 Manipur East Road", name: "Kiranshree Hotel Point to Namghar Road (One Side)", area: 6000, cap: 70, col: "M/s J.K Enterprise" },
  { id: "Slot No. 9 G.S. Road", name: "Pragati Manor to Wills Lifestyle West Side", area: 5100, cap: 55, col: "M/S J.K Enterprise" },
  { id: "Slot No. 16 A.T. Road", name: "Gate No. 6 to Gate No. 8 (KRB Road) South Side", area: 4900, cap: 50, col: "Sri Pranjan Jyoti Barman" },
  { id: "Slot at Ulubari Flyover", name: "Ulubari Flyover", area: 6800, cap: 75, col: "M/S Sarania Enterprise" },
  { id: "Slot at Sixmile Flyover", name: "Sixmile Flyover", area: 4500, cap: 50, col: "M/S Sarania Enterprise" },
  { id: "Slot No. 28 G.S. Road", name: "Prime Bake's Special Sangam Steel Hardware West Side", area: 5200, cap: 60, col: "M/S Sarania Enterprise" },
  { id: "Slot No. 25 Express Highway", name: "Union Bank to IDBI Bank East Side", area: 4000, cap: 45, col: "M/S Kalita Enterprise" },
  { id: "Slot No. 31 S.J. Road", name: "Vision Hospital to Siv Mandir (One Side) in Rotation", area: 6000, cap: 65, col: "Sri Deganta Deka" },
  { id: "Slot at Basement Parking", name: "Fancy Bazar Market Complex", area: 4500, cap: 50, col: "Sri Monjit Pathak" },
];

export const SITES_REGISTRY = LOCATIONS.reduce((acc, loc, index) => {
  // Uses the actual official lessee name from your data
  const actualLessee = loc.col || "Authorized Lessee";

  acc[loc.id] = {
    id: loc.id,
    name: loc.name,
    authority: "Guwahati Municipal Corporation",
    lesseeName: actualLessee,
    leasedTo: actualLessee,
    workOrder: `GMC/ENG/PK-${1000 + index}`,
    tenure: "01/01/2026 - 31/12/2026",
    areaSqft: loc.area,
    ticketCollector: actualLessee,
    slotValidity: "2 hours",
    geoStamp: `26.${1500 + index * 12}° N, 91.${7100 + index * 10}° E`,
    totalCapacity: loc.cap,
    rates: {
      "4W": { baseHours: 1, price: 20 },
      "2W": { baseHours: 1, price: 10 },
    },
  };
  return acc;
}, {});

// In-memory active parking logs for simulation
export const ACTIVE_TICKETS = [
  {
    id: "TKT-101",
    vehicleNo: "AS-01-AB-1234",
    vehicleType: "4W",
    entryTime: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
    status: "PARKED",
  },
];