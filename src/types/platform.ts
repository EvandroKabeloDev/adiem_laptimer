export type EventType =
  | "training"
  | "qualification"
  | "race"
  | "test"
  | "setup"
  | "other";

export type EventVisibility = "private" | "team" | "public";

export type EventStatus =
  | "scheduled"
  | "running"
  | "finished"
  | "cancelled";

export type Track = {
  id: string;
  name: string;
  kartodrome: string | null;
  length_m: number | null;
  configuration: string | null;
  status: string;
};

export type PilotCategory = {
  id: string;
  name: string;
  status: string;
};

export type Pilot = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_m: number | null;
  category_id: string | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  google_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RacingEvent = {
  id: string;
  name: string;
  event_type: EventType;
  track_id: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  visibility: EventVisibility;
  status: EventStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  track?: Track | null;
};

export type Kart = {
  id: string;
  number: string;
  name: string | null;
  category_id: string | null;
  chassis: string | null;
  chassis_year: number | null;
  engine: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type KartSetup = {
  id: string;
  kart_id: string;
  name: string;
  setup_date: string | null;
  tire_brand: string | null;
  tire_model: string | null;
  tire_pressure_psi: number | string | null;
  front_sprocket: number | string | null;
  rear_sprocket: number | string | null;
  caster: number | string | null;
  camber: number | string | null;
  geometry: string | null;
  brake_pad_status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
