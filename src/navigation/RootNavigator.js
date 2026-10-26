import React from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import MainTabs from "./MainTabs";
import EditProfileScreen from "../screens/EditProfileScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import DeactivateAccountScreen from "../screens/DeactivateAccountScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import PackagesScreen from "../screens/PackagesScreen";
import MemberProfileScreen from "../screens/MemberProfileScreen";
import GalleryScreen from "../screens/GalleryScreen";
import HappyStoryScreen from "../screens/HappyStoryScreen";
import IgnoredUsersScreen from "../screens/IgnoredUsersScreen";
import MyInterestScreen from "../screens/MyInterestScreen";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../theme";
import ProfileViewerScreen from "../screens/ProfileViewerScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? "MainTabs" : "Login"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="MemberProfile" component={MemberProfileScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
      <Stack.Screen name="HappyStory" component={HappyStoryScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="DeactivateAccount" component={DeactivateAccountScreen} />
      <Stack.Screen name="Packages" component={PackagesScreen} />
      <Stack.Screen name="IgnoredUsers" component={IgnoredUsersScreen} />
      <Stack.Screen name="IgnoredUserList" component={IgnoredUsersScreen} />
      <Stack.Screen name="MyInterest" component={MyInterestScreen} />
      <Stack.Screen name="Interests" component={MyInterestScreen} />
      <Stack.Screen name="ProfileViewer" component={ProfileViewerScreen} />
    </Stack.Navigator>
  );
}
