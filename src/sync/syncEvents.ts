type ExpenseMutationListener = () => void;
type CategoryMutationListener = () => void;

const expenseMutationListeners = new Set<ExpenseMutationListener>();
const categoryMutationListeners = new Set<CategoryMutationListener>();

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
