import { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { Expense } from "../types/expense";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export function ExpenseListScreen() {
   const [expenses, setExpenses] = useState<Expense[]>([]);
   const navigation = useNavigation();

   useFocusEffect(
      useCallback(() => {
         const now = new Date();
         const year = now.getFullYear();
         const month = now.getMonth() + 1;
      
         ExpenseRepository.getByMonth(year, month).then(setExpenses);
      }, [])
   );

   return (
      <View style={{ flex: 1, padding: 16 }}>
      <FlatList
         data={expenses}
         keyExtractor={(item) => item.id}
         ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40 }}>
            No expenses yet
            </Text>
         }
         renderItem={({ item }) => (
            <View style={{ paddingVertical: 12 }}>
            <Text>{item.description}</Text>
            <Text>
               ${(item.amountCents / 100).toFixed(2)} · {item.currency}
            </Text>
            </View>
         )}
      />

      {/* Floating + button */}
      <TouchableOpacity
         onPress={() => navigation.navigate("AddExpense" as never)}
         style={{
            position: "absolute",
            right: 16,
            bottom: 16,
            backgroundColor: "#000",
            padding: 16,
            borderRadius: 32,
         }}
      >
         <Text style={{ color: "#fff", fontSize: 18 }}>＋</Text>
      </TouchableOpacity>
      </View>
   );
}