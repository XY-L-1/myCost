import { DataScope } from "../domain/dataScope";
import { RecurringExpenseRepository } from "../repositories/recurringExpenseRepository";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { generateUUID } from "../utils/uuid";
import { formatDateKey, nextRecurringDate } from "../utils/date";

export async function materializeDueRecurringExpenses(
  scope: DataScope,
  deviceId: string
) {
  // Recurring rules are local-only for now. Materialization happens on-device.
  const recurringExpenses = await RecurringExpenseRepository.getAll(scope);
  const todayKey = formatDateKey(new Date());

  for (const recurring of recurringExpenses) {
    if (!recurring.isActive) continue;

    let nextDueDate = recurring.nextDueDate;
    let lastGeneratedDate = recurring.lastGeneratedDate;

    while (nextDueDate <= todayKey) {
      const now = new Date().toISOString();
      await ExpenseRepository.create({
        id: await generateUUID(),
        amountCents: recurring.amountCents,
        currency: recurring.currency,
        categoryId: recurring.categoryId,
        description: recurring.description ?? recurring.title,
        expenseDate: nextDueDate,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        dirty: scope.userId ? 1 : 0,
        version: 1,
        deviceId,
        ownerKey: scope.ownerKey,
        userId: scope.userId,
      });

      lastGeneratedDate = nextDueDate;
      nextDueDate = nextRecurringDate(nextDueDate, recurring.frequency);
    }

    if (lastGeneratedDate !== recurring.lastGeneratedDate) {
      await RecurringExpenseRepository.updateGenerationState(
        scope,
        recurring.id,
        nextDueDate,
        lastGeneratedDate!
      );
    }
  }
}
