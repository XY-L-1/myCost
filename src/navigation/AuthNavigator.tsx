import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthEntryScreen } from "../screens/AuthEntryScreen";
import { SignInScreen } from "../screens/SignInScreen";
import { SignUpScreen } from "../screens/SignUpScreen";

export type AuthStackParamList = {
  AuthEntry: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const FONT_BODY = Platform.select({ ios: "Avenir Next", android: "serif" });

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerTitleStyle: { fontFamily: FONT_BODY },
      }}
    >
      <Stack.Screen name="AuthEntry" component={AuthEntryScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
