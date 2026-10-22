import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import ActiveMembersScreen from "../screens/ActiveMembersScreen";
import MyInterestScreen from "../screens/MyInterestScreen";
import ShortlistScreen from "../screens/ShortlistScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { COLORS, FONTS } from "../theme";

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    Home: {
        active: "home",
        inactive: "home-outline",
    },
    ActiveMembers: {
        active: "people",
        inactive: "people-outline",
    },
    MyInterest: {
        active: "heart",
        inactive: "heart-outline",
    },
    Shortlist: {
        active: "star",
        inactive: "star-outline",
    },
    Profile: {
        active: "person",
        inactive: "person-outline",
    },
};

function TabBarIcon({ routeName, focused, color }) {
    const icons = TAB_ICONS[routeName] || { active: "ellipse", inactive: "ellipse-outline" };
    const iconName = focused ? icons.active : icons.inactive;

    return (
        <View style={styles.iconContainer}>
            <Ionicons name={iconName} size={24} color={color} />
        </View>
    );
}

export default function MainTabs() {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 10);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: "#9E8E87",
                tabBarStyle: [
                    styles.tabBar,
                    {
                        height: 62 + bottomPadding,
                        paddingBottom: bottomPadding,
                    },
                ],
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarItemStyle: styles.tabBarItem,
                tabBarIcon: ({ focused, color }) => (
                    <TabBarIcon
                        routeName={route.name}
                        focused={focused}
                        color={color}
                    />
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
                options={{ tabBarLabel: "Interests" }}
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

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#EDE3DC",
        paddingTop: 8,
        ...Platform.select({
            ios: {
                shadowColor: "#2B1B17",
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    tabBarItem: {
        paddingVertical: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    tabBarLabel: {
        fontFamily: FONTS.medium,
        fontSize: 11,
        marginTop: 3,
        letterSpacing: 0.2,
    },
    iconContainer: {
        alignItems: "center",
        justifyContent: "center",
        height: 26,
    },
});
