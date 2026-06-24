export interface Personnel {
  id: string;
  badgeNumber: string;
  rank: {
    id: string;
    rank_name: string;
  } | null;
  rankId: string;
  fullname: string;
  unitId: string;
  unit?: {
    id: string;
    unit_name: string;
  } | null;
  designation: string;
  phoneNumber?: string;
  viberNumber?: string;
  isApproved: boolean;
  role: string;
  email?: string;
}

export interface Unit {
  id: string;
  unitName: string;
}

export interface PersonnelLog {
  id: string;
  personnelId: string;
  latitude: number;
  longitude: number;
  speed: number;
  networkSignal: number;
  dutyType: string | null;
  capturedAt: string;
  isSynced: boolean;
}

export interface Schedule {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  sector: string;
  unitId: string;
  personnelId: string;
}
