export const SITES_REGISTRY = {
  "fancy-bazar-04": {
    id: "fancy-bazar-04",
    name: "Slot No. 05 G.S Road",
    authority: "Guwahati Municipal Corporation",
    leasedTo: "M/s XYZ Parking Solutions Pvt. Ltd.",
    workOrder: "GMC/ENG/PK-0881",
    tenure: "01/01/2024 - 31/12/2024",
    areaSqft: 5000,
    ticketCollector: "Tanmoy Sarkar",
    slotValidity: "2 hours",
    geoStamp: "26.1804° N, 91.7539° E",
    totalCapacity: 65,
    rates: {
      "4W": { baseHours: 1, price: 20 },
      "2W": { baseHours: 1, price: 10 },
    },
  },
};

// In-memory active parking logs for simulation
export const ACTIVE_TICKETS = [
  {
    id: "TKT-101",
    vehicleNo: "AS-01-AB-1234",
    vehicleType: "4W",
    entryTime: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(), // Parked 2.5 hrs ago
    status: "PARKED",
  },
];