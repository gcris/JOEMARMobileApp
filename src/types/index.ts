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
  photo_url?: string; // URL to the personnel's photo in Supabase storage
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
  duty_type: string;
  unitId: string;
  personnelId: string;
  personnel: Array<{
    rank_name: string;
    fullname: string;
    phone_number: string;
    viber_number: string;
  }>;
}

// Navigation types
export interface RootStackParamList {
  Main: undefined;
  Account: {
    personnelId: string;
    isDarkTheme: boolean;
  };
}
