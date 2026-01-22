export type RoomStatus = "ACTIVE" | "OUT_OF_ORDER";
export type HousekeepingStatus = "CLEAN" | "DIRTY" | "INSPECT" | "OUT_OF_SERVICE";

export type StayStatus = "DRAFT" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT";

export type AvailabilityRoomType = {
  id: string;
  code: string;
  name: string;
};

export type AvailabilityStay = {
  id: string; // reservation id
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD exclusive
  startDateKey?: string; // YYYY-MM-DD
  endDateKey?: string; // YYYY-MM-DD (checkout date, exclusive)
  status: StayStatus;
  guestName: string;
  source: "MANUAL" | "DIRECT";
  channel: string | null;
};

export type AvailabilityBlock = {
  id: string;
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD exclusive
  reason: string | null;
};

export type AvailabilityOccupancy = "" | "STAY" | "BLOCK";

export type AvailabilityRoom = {
  id: string;
  name: string;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  roomType: AvailabilityRoomType;
  stays: AvailabilityStay[];
  blocks: AvailabilityBlock[];
  occupancy: AvailabilityOccupancy[];
};

export type AvailabilityResponse = {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  dates: string[]; // date columns
  rooms: AvailabilityRoom[];
};

export type RoomStatusFilter = "ALL" | "CLEAN" | "DIRTY" | "OUT_OF_ORDER";
export type ViewDays = 7 | 14 | 30;

export type DailySummary = {
  date: string; // YYYY-MM-DD
  sold: number;
  total: number;
  occupancyPct: number; // 0..100
  adrCents: number | null; // not available yet
};
