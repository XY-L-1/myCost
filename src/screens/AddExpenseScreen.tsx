import { useState, useEffect } from "react";
import { View, Text, TextInput, Button } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { ExpenseRepository } from "../repositories/expenseRepository";
import { CategoryRepository } from "../repositories/categoryRepository";
import { generateUUID } from "../utils/uuid";
import { Category } from "../types/category";
import { useAuthStore } from "../auth/authStore";
import { useNavigation } from "@react-navigation/native";


export function AddExpenseScreen() {
   const auth = useAuthStore();
   const navigation = useNavigation();

   const [amount, setAmount] = useState("");
   const [description, setDescription] = useState("");
   const [categories, setCategories] = useState<Category[]>([]);
   const [categoryId, setCategoryId] = useState<string | null>(null);

   useEffect(() => {
      CategoryRepository.getAll().then((cats) => {
         setCategories(cats);
         if (cats.length > 0) {
         setCategoryId(cats[0].id);
         }
      });
   }, []);

   async function onSave() {
      if (!amount || !categoryId) return;

      const now = new Date().toISOString();
      const id = await generateUUID();

      await ExpenseRepository.create({
         id,
         userId: auth.user?.id ?? null,
         amountCents: Math.round(Number(amount) * 100),
         currency: "USD",
         categoryId,
         description,
         expenseDate: now.slice(0, 10),
         createdAt: now,
         updatedAt: now,
         deletedAt: null,
         dirty: 1,
         version: 1,
         deviceId: "device-id-placeholder",
      });

      navigation.goBack();
   }

   return (
      <View style={{ flex: 1, padding: 16 }}>
         <Text>Amount</Text>
         <TextInput
         keyboardType="decimal-pad"
         value={amount}
         onChangeText={setAmount}
         placeholder="0.00"
         style={{ borderBottomWidth: 1, marginBottom: 16 }}
         />

         <Text>Description</Text>
         <TextInput
         value={description}
         onChangeText={setDescription}
         placeholder="Coffee, lunch..."
         style={{ borderBottomWidth: 1, marginBottom: 16 }}
         />

         <Text>Category</Text>
         {categories.map((cat) => (
         <Text
            key={cat.id}
            style={{
               padding: 8,
               backgroundColor: cat.id === categoryId ? "#ddd" : "#eee",
               marginVertical: 4,
            }}
            onPress={() => setCategoryId(cat.id)}
         >
            {cat.name}
         </Text>
         ))}

         <View style={{ marginTop: 24 }}>
         <Button title="Save" onPress={onSave} />
         </View>
      </View>
   );
}