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
