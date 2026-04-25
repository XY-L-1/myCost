type ExpenseMutationListener = () => void;
type CategoryMutationListener = () => void;
type BudgetMutationListener = () => void;
type RecurringExpenseMutationListener = () => void;

const expenseMutationListeners = new Set<ExpenseMutationListener>();
const categoryMutationListeners = new Set<CategoryMutationListener>();
const budgetMutationListeners = new Set<BudgetMutationListener>();
const recurringExpenseMutationListeners =
  new Set<RecurringExpenseMutationListener>();

export function subscribeToExpenseMutations(
  listener: ExpenseMutationListener
): () => void {
  expenseMutationListeners.add(listener);
  return () => {
    expenseMutationListeners.delete(listener);
  };
}

export function notifyExpenseMutation() {
  expenseMutationListeners.forEach((listener) => listener());
}

export function subscribeToCategoryMutations(
  listener: CategoryMutationListener
): () => void {
  categoryMutationListeners.add(listener);
  return () => {
    categoryMutationListeners.delete(listener);
  };
}

export function notifyCategoryMutation() {
  categoryMutationListeners.forEach((listener) => listener());
}

export function subscribeToBudgetMutations(
  listener: BudgetMutationListener
): () => void {
  budgetMutationListeners.add(listener);
  return () => {
    budgetMutationListeners.delete(listener);
  };
}

export function notifyBudgetMutation() {
  budgetMutationListeners.forEach((listener) => listener());
}

export function subscribeToRecurringExpenseMutations(
  listener: RecurringExpenseMutationListener
): () => void {
  recurringExpenseMutationListeners.add(listener);
  return () => {
    recurringExpenseMutationListeners.delete(listener);
  };
}

export function notifyRecurringExpenseMutation() {
  recurringExpenseMutationListeners.forEach((listener) => listener());
}
