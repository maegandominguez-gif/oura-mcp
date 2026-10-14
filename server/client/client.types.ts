export type PersonalInfo = {
	id: string;
	age: number;
	weight: number;
	height: number;
	biological_sex: string;
	email: string;
}

export type DailyReadiness = {
	id: string;
	contributors: Record<string, unknown>;
	day: string;
	score: number | null;
	temperature_deviation?: number | null;
	timestamp: string;
};

export type DailyReadinessResponse = {
	data: DailyReadiness[];
	nextToken: string | null;
};

export type DailyActivity = {
	id: string;
	class_5_min: (number | null)[];
	score: number | null;
	active_calories: number;
	average_met_minutes: number;
	contributors: Record<string, unknown>;
	equivalent_walking_distance: number;
	high_activity_met_minutes: number;
	high_activity_time: number;
	inactivity_alerts: number;
	low_activity_met_minutes: number;
	low_activity_time: number;
	medium_activity_met_minutes: number;
	medium_activity_time: number;
	meters_to_target: number;
	non_wear_time: number;
	resting_time: number;
	sedentary_met_minutes: number;
	sedentary_time: number;
	steps: number;
	target_calories: number;
	target_meters: number;
	total_calories: number;
	day: string;
	timestamp: string;
};

export type DailyActivityResponse = {
	data: DailyActivity[];
	nextToken: string | null;
};

export type DailySleep = {
	id: string;
	contributors: Record<string, unknown>;
	day: string;
	score: number | null;
	timestamp: string;
}

export type DailySleepResponse = {
	data: DailySleep[];
	nextToken: string | null;
}

export type HeartRateData = {
	bpm: number;
	source: string;
	timestamp: string;
};

export type HeartRateResponse = {
	data: HeartRateData[];
	nextToken: string | null;
}

export type DailyStress = {
	id: string;
	day: string;
	stress_high: number;
	stress_average: number;
	stress_low: number;
	recovery_high: number;
	recovery_average: number;
	recovery_low: number;
	day_summary?: "restored" | "normal" | "stressful" | null;
	timestamp: string;
};

export type DailyStressResponse = {
	data: DailyStress[];
	nextToken: string | null;
};

export type Workout = {
	id: string;
	day: string;
	activity: string; // camelCase type, e.g. "walking", "strengthTraining", "hiit"
	start_datetime: string;
	end_datetime: string;
	source: string; // "manual" | "autodetected" | "confirmed" | "workout_heart_rate"
	calories: number | null;
	distance: number | null; // meters
	intensity: string; // "easy" | "moderate" | "hard"
	label: string | null;
};

export type WorkoutResponse = {
	data: Workout[];
	nextToken: string | null;
};

export type DailySPO2 = {
	id: string;
	day: string;
	contributors: Record<string, unknown>;
	spo2_percentage: { average: number } | null;
	breathing_disturbance_index?: number | null;
	timestamp: string;
};

export type DailySPO2Response = {
	data: DailySPO2[];
	nextToken: string | null;
};
/** One sleep period from /usercollection/sleep. Durations are in seconds. */
export type SleepPeriod = {
	id: string;
	day: string;
	type: "long_sleep" | "sleep" | "late_nap" | "rest" | "deleted" | string;
	bedtime_start: string;
	bedtime_end: string;
	total_sleep_duration: number | null;
	time_in_bed: number;
	efficiency: number | null;
	latency: number | null;
	deep_sleep_duration: number | null;
	rem_sleep_duration: number | null;
	light_sleep_duration: number | null;
	average_hrv: number | null;
	average_heart_rate: number | null;
	lowest_heart_rate: number | null;
	average_breath: number | null;
};

export type SleepPeriodResponse = {
	data: SleepPeriod[];
	next_token: string | null;
};
