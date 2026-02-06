import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ExpenseListScreen } from "../screens/ExpenseListScreen";
import { AddExpenseScreen } from "../screens/AddExpenseScreen";



export type RootStackParamList = {
   Expenses: undefined;
   AddExpense: undefined;
};

const Stack = createNativeStackNavigator();

export function RootNavigator() {
   return (
      <Stack.Navigator>
         <Stack.Screen
         name="Expenses"
         component={ExpenseListScreen}
         options={{ title: "Expenses" }}
         />

         <Stack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={{ title: "Add Expense" }}
         />
      </Stack.Navigator>
   );
}