export interface ScheduleEntryDto {
	occurrenceId: string;
	courseOfferingId: string;
	date: string;
	weekday: number;
	weekdayLabel: string;
	startTime: string;
	endTime: string;
	location: string | null;
	courseCode: string;
	courseTitle: string;
	instructorName: string | null;
	status: 'SCHEDULED' | 'CANCELLED';
}

export interface DailyScheduleDto {
	date: string;
	timeZone: string;
	classes: ScheduleEntryDto[];
}

export interface WeeklyScheduleDto {
	weekStart: string;
	weekEnd: string;
	timeZone: string;
	days: DailyScheduleDto[];
}

export interface SubscriptionDto {
	id: string;
	programOfferingId: string;
	programTitle: string;
	termTitle: string;
	mode: 'FOLLOW_PROGRAM' | 'CUSTOMIZED';
	status: 'ACTIVE' | 'UNSUBSCRIBED';
	selectedCourseOfferingIds: string[];
	preferences: {
		dailySummaryEnabled: boolean;
		dailySummaryTime: string;
		classReminderEnabled: boolean;
		reminderOffsetMinutes: number;
		notifyOnEmptyDays: boolean;
	} | null;
}

export interface ProgramSummaryDto {
	id: string;
	title: string;
	levelTitle: string;
	fieldTitle: string;
	termTitle: string;
	termId: string;
	courseCount: number;
}
