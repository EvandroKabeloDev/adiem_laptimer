export type Session = {
  id: string;
  started_at: string;
  finished_at: string | null;
  device_name: string | null;
  device_address: string | null;
  test_name: string | null;
  notes: string | null;
};

export type Lap = {
  id: number;
  session_id: string;
  lap_number: number;
  start_packet_id: number | null;
  end_packet_id: number | null;
  start_at: string;
  end_at: string;
  lap_time_ms: number;
  counter_start: number | null;
  counter_end: number | null;
  counter_delta: number | null;
  source: string;
};