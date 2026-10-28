import type { OutboundMessage } from '../../../../application/dto/messaging.js';
import type {
	CallbackContext,
	CallbackHandler,
	HandlerDeps,
} from './handler-deps.js';

export class StudySelectionCallbackHandler implements CallbackHandler {
	constructor(private readonly deps: HandlerDeps) {}

	async execute(context: CallbackContext): Promise<OutboundMessage | null> {
		const { userId, event, recipient, payload } = context;
		const [operation, ...values] = payload.params;
		const value = values[0];
		const state = await this.deps.stateStore.get({
			userId,
			platform: event.platform,
			botScope: event.botScope,
		});

		if (operation === 'level' && value) {
			const fields = await this.deps.getStudyFields.execute(value);
			if (fields.length === 0) {
				return {
					recipient,
					text: 'برای این مقطع رشته‌ای تعریف نشده است.',
					buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
				};
			}
			await this.deps.stateStore.set({
				userId,
				platform: event.platform,
				botScope: event.botScope,
				step: 'STUDY_SELECT_FIELD',
				data: { levelId: value },
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
			});
			return this.deps.renderer.studyFields(fields, recipient);
		}

		if (operation === 'field' && value) {
			if (!state?.data.levelId) {
				return this.deps.renderer.restartFlow(recipient);
			}
			const terms = await this.deps.getAvailableTerms.execute();
			await this.deps.stateStore.set({
				userId,
				platform: event.platform,
				botScope: event.botScope,
				step: 'STUDY_SELECT_TERM',
				data: { levelId: state.data.levelId, fieldId: value },
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
			});
			return this.deps.renderer.studyTerms(terms, recipient);
		}

		if (operation === 'term' && value) {
			if (!state?.data.levelId || !state.data.fieldId) {
				return this.deps.renderer.restartFlow(recipient);
			}
			const offerings = await this.deps.getAvailableCourseOfferings.execute(
				userId,
				{
					studyFieldId: state.data.fieldId,
					termId: value,
				},
			);
			if (offerings.length === 0) {
				return {
					recipient,
					text: 'برای این رشته و ترم درسی تعریف نشده است.',
					buttons: [[{ text: 'بازگشت به منو', callbackData: 'menu:home' }]],
				};
			}
			await this.deps.stateStore.set({
				userId,
				platform: event.platform,
				botScope: event.botScope,
				step: 'STUDY_SELECT_COURSES',
				data: {
					levelId: state.data.levelId,
					fieldId: state.data.fieldId,
					termId: value,
					selectedCourseOfferingIds: '',
				},
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
			});
			return this.deps.renderer.courseOfferings(offerings, new Set(), recipient);
		}

		if (
			(operation === 'toggle' || operation === 'save') &&
			state?.data.levelId &&
			state.data.fieldId &&
			state.data.termId
		) {
			const selected = new Set(
				(state.data.selectedCourseOfferingIds ?? '').split(',').filter(Boolean),
			);
			if (operation === 'toggle' && value) {
				if (selected.has(value)) selected.delete(value);
				else selected.add(value);
				await this.deps.stateStore.set({
					userId,
					platform: event.platform,
					botScope: event.botScope,
					step: 'STUDY_SELECT_COURSES',
					data: {
						levelId: state.data.levelId,
						fieldId: state.data.fieldId,
						termId: state.data.termId,
						selectedCourseOfferingIds: [...selected].join(','),
					},
					updatedAt: new Date(),
					expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
				});
				const offerings = await this.deps.getAvailableCourseOfferings.execute(
					userId,
					{
						studyFieldId: state.data.fieldId,
						termId: state.data.termId,
					},
				);
				return this.deps.renderer.courseOfferings(offerings, selected, recipient);
			}

			if (operation === 'save') {
				await this.deps.saveStudentCourseSelection.execute({
					userId,
					academicLevelId: state.data.levelId,
					studyFieldId: state.data.fieldId,
					academicTermId: state.data.termId,
					selectedCourseOfferingIds: [...selected],
				});
				await this.deps.stateStore.clear({
					userId,
					platform: event.platform,
					botScope: event.botScope,
				});
				return {
					recipient,
					text: `انتخاب دروس ذخیره شد. ${selected.size} درس فعال است.`,
					buttons: this.deps.renderer.mainMenu(recipient).buttons,
				};
			}
		}

		return this.deps.renderer.restartFlow(recipient);
	}
}
