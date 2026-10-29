import type { OutboundButton } from '../dto/messaging.js';

export interface BotContent {
	text: string;
	buttons: OutboundButton[][];
}

export const MAIN_MENU: OutboundButton[][] = [
	[
		{ text: 'برنامه امروز', callbackData: 'menu:today' },
		{ text: 'برنامه هفتگی', callbackData: 'menu:week' },
	],
	[{ text: 'انتخاب یا تغییر برنامه', callbackData: 'menu:subscribe' }],
	[{ text: 'انتخاب رشته و دروس', callbackData: 'menu:study' }],
	[{ text: 'برنامه فعلی', callbackData: 'menu:program' }],
	[{ text: 'امتحان‌های پیش رو', callbackData: 'menu:exams' }],
	[{ text: 'تنظیم اعلان‌ها', callbackData: 'menu:prefs' }],
	[{ text: 'راهنما', callbackData: 'menu:help' }],
];

export function backToMenu(): OutboundButton[][] {
	return [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]];
}
