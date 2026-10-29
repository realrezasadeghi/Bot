import type { BotContent } from './bot-content.js';
import { backToMenu, MAIN_MENU } from './bot-content.js';

export function renderWelcome(): BotContent {
	return {
		text: [
			'به ربات برنامه‌ریزی درسی خوش آمدید.',
			'',
			'برای دریافت برنامه، ابتدا یک برنامه تحصیلی انتخاب کنید.',
			'از منوی زیر شروع کنید.',
		].join('\n'),
		buttons: MAIN_MENU,
	};
}
export function renderMainMenu(): BotContent {
	return {
		text: 'منوی اصلی',
		buttons: MAIN_MENU,
	};
}
export function renderHelp(): BotContent {
	return {
		text: [
			'دستورهای موجود:',
			'/start شروع و منوی اصلی',
			'/today برنامه امروز',
			'/week برنامه هفتگی',
			'/exams امتحان‌های پیش رو',
			'/program برنامه فعلی',
			'/subscribe انتخاب یا تغییر برنامه',
			'/study انتخاب رشته، ترم و دروس',
			'/customize انتخاب دروس',
			'/prefs تنظیم اعلان‌ها',
			'/unsubscribe لغو اشتراک',
			'/cancel انصراف از مرحله فعلی',
			'/help راهنما',
		].join('\n'),
		buttons: backToMenu(),
	};
}
export function renderUnresolvedProgramGrouping(): BotContent {
	return {
		text: [
			'برای این مقطع، رشته و ترم برنامه تحصیلی قابل انتخاب پیدا نشد.',
			'منبع دانشگاه در پاسخ فعلی، گروه‌بندی برنامه/رشته کافی برای ساخت برنامه ارائه نکرده است.',
			'این مورد به عنوان یک نیاز یکپارچه‌سازی حل‌نشده ثبت شده و نباید با داده ساختگی پر شود.',
		].join('\n'),
		buttons: backToMenu(),
	};
}
