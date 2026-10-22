import React from "react";
import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeScreen from "../screens/HomeScreen";
import ActiveMembersScreen from "../screens/ActiveMembersScreen";
import MyInterestScreen from "../screens/MyInterestScreen";
import ShortlistScreen from "../screens/ShortlistScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Tab = createBottomTabNavigator();

const PRIMARY = "#F9407F";
const INACTIVE = "#9C8E88";

const ICONS = {
    Home: "🏠",
    ActiveMembers: "👥",
    MyInterest: "💖",
    Shortlist: "⭐",
    Profile: "👤",
};

function TabIcon({ name, focused }) {
    return (
        <View style={{ alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>
                {ICONS[name]}
            </Text>
        </View>
    );
}

export default function MainTabs() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: PRIMARY,
                tabBarInactiveTintColor: INACTIVE,
                tabBarStyle: {
                    height: 56 + insets.bottom,
                    paddingBottom: Math.max(insets.bottom, 8),
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderTopColor: "#E8DDD5",
                    backgroundColor: "#FFFFFF",
                },
                tabBarLabelStyle: {
                    fontFamily: "Poppins_500Medium",
                    fontSize: 11,
                    marginTop: 2,
                },
                tabBarIcon: ({ focused }) => (
                    <TabIcon name={route.name} focused={focused} />
                ),
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: "Home" }}
            />
            <Tab.Screen
                name="ActiveMembers"
                component={ActiveMembersScreen}
                options={{ tabBarLabel: "Active" }}
            />
            <Tab.Screen
                name="MyInterest"
                component={MyInterestScreen}
                options={{ tabBarLabel: "Interest" }}
            />
            <Tab.Screen
                name="Shortlist"
                component={ShortlistScreen}
                options={{ tabBarLabel: "Shortlist" }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: "Profile" }}
            />
        </Tab.Navigator>
    );
}