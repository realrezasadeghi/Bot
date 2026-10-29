import type { UserAcademicSelection } from '../../domain/academic/study-field.js';
import type { SubscriptionDto } from '../dto/schedule.js';
import type { BotContent } from './bot-messages.js';
import { backToMenu } from './bot-messages.js';

export function renderSubscription(
	subscription: SubscriptionDto | null,
): BotContent {
	if (!subscription) {
		return {
			text: 'در حال حاضر در هیچ برنامه‌ای ثبت‌نام نکرده‌اید.',
			buttons: [
				[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
				[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
			],
		};
	}

	const mode =
		subscription.mode === 'FOLLOW_PROGRAM'
			? 'پیروی از دروس پیش‌فرض برنامه'
			: `انتخاب دستی ${subscription.selectedCourseOfferingIds.length} درس`;

	return {
		text: [
			'برنامه فعلی شما',
			`برنامه: ${subscription.programTitle}`,
			`ترم: ${subscription.termTitle}`,
			`حالت: ${mode}`,
		].join('\n'),
		buttons: [
			[{ text: 'ویرایش دروس', callbackData: 'menu:customize' }],
			[{ text: 'تنظیم اعلان‌ها', callbackData: 'menu:prefs' }],
			[{ text: 'لغو اشتراک', callbackData: 'menu:unsubscribe' }],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}
export function renderPreferences(subscription: SubscriptionDto): BotContent {
	const preference = subscription.preferences;
	if (!preference) {
		return {
			text: 'تنظیمات اعلان برای این برنامه یافت نشد.',
			buttons: backToMenu(),
		};
	}

	const onOff = (enabled: boolean): string => (enabled ? 'روشن' : 'خاموش');

	return {
		text: [
			'تنظیمات اعلان‌ها',
			`خلاصه روزانه: ${onOff(preference.dailySummaryEnabled)}`,
			`ساعت خلاصه روزانه: ${preference.dailySummaryTime}`,
			`یادآوری کلاس: ${onOff(preference.classReminderEnabled)}`,
			`فاصله یادآوری: ${preference.reminderOffsetMinutes} دقیقه قبل`,
			`اعلان روز بدون کلاس: ${onOff(preference.notifyOnEmptyDays)}`,
		].join('\n'),
		buttons: [
			[
				{
					text: `خلاصه روزانه: ${onOff(preference.dailySummaryEnabled)}`,
					callbackData: 'pref:toggle:summary',
				},
			],
			[
				{
					text: `یادآوری کلاس: ${onOff(preference.classReminderEnabled)}`,
					callbackData: 'pref:toggle:reminder',
				},
			],
			[
				{
					text: `اعلان روز بدون کلاس: ${onOff(preference.notifyOnEmptyDays)}`,
					callbackData: 'pref:toggle:empty',
				},
			],
			[
				{ text: '۰۷:۰۰', callbackData: 'pref:time:07:00' },
				{ text: '۰۸:۰۰', callbackData: 'pref:time:08:00' },
				{ text: '۰۹:۰۰', callbackData: 'pref:time:09:00' },
			],
			[
				{ text: '۳۰ دقیقه قبل', callbackData: 'pref:offset:30' },
				{ text: '۶۰ دقیقه قبل', callbackData: 'pref:offset:60' },
				{ text: '۱۲۰ دقیقه قبل', callbackData: 'pref:offset:120' },
			],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}
export function renderStudentPreferences(
	selection: UserAcademicSelection,
): BotContent {
	return {
		text: [
			'تنظیمات اعلان‌های برنامه انتخابی',
			'',
			`یادآوری کلاس: ${selection.classReminderEnabled ? 'فعال' : 'غیرفعال'}`,
			`زمان یادآوری: ${selection.reminderOffsetMinutes} دقیقه قبل از کلاس`,
		].join('\n'),
		buttons: [
			[
				{
					text: selection.classReminderEnabled
						? 'غیرفعال کردن یادآوری'
						: 'فعال کردن یادآوری',
					callbackData: 'spref:toggle:reminder',
				},
			],
			[
				{ text: '۱۵ دقیقه قبل', callbackData: 'spref:offset:15' },
				{ text: '۳۰ دقیقه قبل', callbackData: 'spref:offset:30' },
			],
			[
				{ text: '۶۰ دقیقه قبل', callbackData: 'spref:offset:60' },
				{ text: '۱۲۰ دقیقه قبل', callbackData: 'spref:offset:120' },
			],
			[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
		],
	};
}
