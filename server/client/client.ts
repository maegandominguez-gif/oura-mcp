// oura client

import { throwOuraError } from "./client.errors.ts";
import { DailyActivityResponse, DailyReadinessResponse, DailySleepResponse, HeartRateResponse, DailyStressResponse, WorkoutResponse, DailySPO2Response, PersonalInfo, SleepPeriodResponse } from "./client.types.ts";

const OURA_BASE_URL = "https://api.ouraring.com/v2";

/**
 * Format a date as YYYY-MM-DD for Oura API daily endpoints
 */
function formatDateForOuraAPI(date: Date): string {
	return date.toISOString().split('T')[0];
}

export class OuraApi {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Make a request to the Oura API
	 * 
	 * @param path the API endpoint path
	 * @param options fetch options
	 * @param filters URL search parameters
	 * 
	 * @returns the JSON response from the API
	 */
	private async _request<T>(
		path: string,
		options?: RequestInit,
		filters?: URLSearchParams,
	): Promise<T> {
		const url = `${OURA_BASE_URL}${path}${filters ? `?${filters.toString()}` : ""
			}`;
		const headers = {
			Authorization: `Bearer ${this.apiKey}`,
			"Content-Type": "application/json",
			...options?.headers,
		};
		const response = await fetch(url, { ...options, headers });

		if (!response.ok) {
			throwOuraError(response);
		}

		return response.json();
	}

	/**
	 * Get personal information about the authenticated user
	 * 
	 * @returns {Promise<PersonalInfo>}
	 */
	async getPersonalInfo(): Promise<PersonalInfo> {
		const personalInfo = await this._request<PersonalInfo>('/usercollection/personal_info');
		return personalInfo;
	}

	/**
	 * Get daily activity data from Oura
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<DailyActivityResponse>}
	 */
	async getDailyActivity(
		startDate?: Date,
		endDate?: Date,
	): Promise<DailyActivityResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const dailyActivity = await this._request<DailyActivityResponse>("/usercollection/daily_activity", {}, filters);

		return dailyActivity;
	}

	/**
	 * Get daily readiness data from Oura
	 * 
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<DailyReadinessResponse>}
	 */
	async getDailyReadiness(
		startDate?: Date,
		endDate?: Date,
	): Promise<DailyReadinessResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const dailyReadiness = await this._request<DailyReadinessResponse>("/usercollection/daily_readiness", {}, filters);

		return dailyReadiness;
	}

	/**
	 * Get daily sleep data from Oura
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<DailySleepResponse>}
	 */
	async getDailySleep(startDate?: Date, endDate?: Date): Promise<DailySleepResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const sleepRoutes = await this._request<DailySleepResponse>("/usercollection/daily_sleep", {}, filters);

		return sleepRoutes;
	}

	/**
	 * Get detailed heart rate data from Oura.
	 *
	 * @param {Date} startDateTime the start of the period you would like data for
	 * @param {Date} endDateTime the end of the period you would like data for
	 * @returns {Promise<HeartRateResponse>}
	 */
	async getHeartRate(startDateTime?: Date, endDateTime?: Date): Promise<HeartRateResponse> {
		if (!startDateTime) {
			startDateTime = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDateTime) {
			endDateTime = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDateTime));
		filters.append("end_date", formatDateForOuraAPI(endDateTime));

		const heartRate = await this._request<HeartRateResponse>("/usercollection/heartrate", {}, filters);

		return heartRate;
	}

	/**
	 * Get daily stress data from Oura
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<DailyStressResponse>}
	 */
	async getDailyStress(
		startDate?: Date,
		endDate?: Date,
	): Promise<DailyStressResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const dailyStress = await this._request<DailyStressResponse>("/usercollection/daily_stress", {}, filters);

		return dailyStress;
	}

	/**
	 * Get workout data from Oura
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<WorkoutResponse>}
	 */
	async getWorkouts(
		startDate?: Date,
		endDate?: Date,
		nextToken?: string | null,
	): Promise<WorkoutResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 7)); // Default to last week for workouts
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));
		if (nextToken) filters.append("next_token", nextToken);

		const workouts = await this._request<WorkoutResponse>("/usercollection/workout", {}, filters);

		return workouts;
	}

	/**
	 * Get daily blood oxygen data from Oura
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<DailySPO2Response>}
	 */
	async getDailySPO2(
		startDate?: Date,
		endDate?: Date,
	): Promise<DailySPO2Response> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const dailySPO2 = await this._request<DailySPO2Response>("/usercollection/daily_spo2", {}, filters);

		return dailySPO2;
	}

	/**
	 * Get detailed sleep periods from Oura (HRV, heart rate, stage durations)
	 *
	 * @param {Date} startDate the start of the period you would like data for
	 * @param {Date} endDate the end of the period you would like data for
	 * @returns {Promise<SleepPeriodResponse>}
	 */
	async getSleepPeriods(
		startDate?: Date,
		endDate?: Date,
	): Promise<SleepPeriodResponse> {
		if (!startDate) {
			startDate = new Date(new Date().setDate(new Date().getDate() - 1));
		}
		if (!endDate) {
			endDate = new Date();
		}

		const filters = new URLSearchParams();
		filters.append("start_date", formatDateForOuraAPI(startDate));
		filters.append("end_date", formatDateForOuraAPI(endDate));

		const sleepPeriods = await this._request<SleepPeriodResponse>("/usercollection/sleep", {}, filters);

		return sleepPeriods;
	}
}
