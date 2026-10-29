import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const QUICK_PRESETS = [
  { label: "Morning", time: "08:30 AM", h: 8, m: 30, p: "AM" },
  { label: "Noon", time: "12:00 PM", h: 12, m: 0, p: "PM" },
  { label: "Afternoon", time: "03:15 PM", h: 3, m: 15, p: "PM" },
  { label: "Evening", time: "06:30 PM", h: 6, m: 30, p: "PM" },
  { label: "Night", time: "10:00 PM", h: 10, m: 0, p: "PM" },
];

/**
 * Parse an existing time string (e.g. "10:30 AM", "14:20", "8:5 PM") into 12h parts
 */
function parseTimeString(raw) {
  if (!raw || typeof raw !== "string") {
    return { hour: 10, minute: 30, period: "AM" };
  }
  const clean = raw.trim();
  const ampmMatch = clean.match(/(am|pm)/i);
  let period = ampmMatch ? ampmMatch[1].toUpperCase() : null;

  // Extract numbers
  const digits = clean.replace(/[^0-9:]/g, "").split(":");
  let hour = parseInt(digits[0], 10);
  let minute = digits[1] ? parseInt(digits[1], 10) : 0;

  if (isNaN(hour) || hour < 0) hour = 10;
  if (isNaN(minute) || minute < 0 || minute > 59) minute = 0;

  // If 24-hour format (no AM/PM found)
  if (!period) {
    if (hour >= 12) {
      period = "PM";
      if (hour > 12) hour -= 12;
    } else {
      period = "AM";
      if (hour === 0) hour = 12;
    }
  } else {
    // 12-hour normalize
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
  }

  return { hour, minute, period };
}

function formatTimeString(hour, minute, period) {
  const padH = hour < 10 ? `0${hour}` : `${hour}`;
  const padM = minute < 10 ? `0${minute}` : `${minute}`;
  return `${padH}:${padM} ${period}`;
}

function TimePickerContent({ value, onConfirm, onClose, title }) {
  const initial = useMemo(() => parseTimeString(value), [value]);
  const [selectedHour, setSelectedHour] = useState(initial.hour);
  const [selectedMinute, setSelectedMinute] = useState(initial.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(initial.period);
  const [activeTab, setActiveTab] = useState("hour"); // "hour" | "minute"

  const formattedDisplay = useMemo(() => {
    return formatTimeString(selectedHour, selectedMinute, selectedPeriod);
  }, [selectedHour, selectedMinute, selectedPeriod]);

  const handleApplyPreset = (preset) => {
    setSelectedHour(preset.h);
    setSelectedMinute(preset.m);
    setSelectedPeriod(preset.p);
  };

  const handleConfirm = () => {
    onConfirm(formattedDisplay);
    onClose();
  };

  const handleClear = () => {
    onConfirm("");
    onClose();
  };

  const adjustMinute = (delta) => {
    setSelectedMinute((prev) => {
      let next = prev + delta;
      if (next < 0) next = 59;
      if (next > 59) next = 0;
      return next;
    });
  };

  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Digital Display (hour / minute boxes double as tabs) */}
        <View style={styles.displayCard}>
          <View style={styles.digitsRow}>
            <TouchableOpacity
              style={[
                styles.digitBox,
                activeTab === "hour" && styles.digitBoxActive,
              ]}
              onPress={() => setActiveTab("hour")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.digitText,
                  activeTab === "hour" && styles.digitTextActive,
                ]}
              >
                {pad(selectedHour)}
              </Text>
              <Text
                style={[
                  styles.digitSub,
                  activeTab === "hour" && styles.digitSubActive,
                ]}
              >
                Hour
              </Text>
            </TouchableOpacity>

            <Text style={styles.colonSeparator}>:</Text>

            <TouchableOpacity
              style={[
                styles.digitBox,
                activeTab === "minute" && styles.digitBoxActive,
              ]}
              onPress={() => setActiveTab("minute")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.digitText,
                  activeTab === "minute" && styles.digitTextActive,
                ]}
              >
                {pad(selectedMinute)}
              </Text>
              <Text
                style={[
                  styles.digitSub,
                  activeTab === "minute" && styles.digitSubActive,
                ]}
              >
                Min
              </Text>
            </TouchableOpacity>

            {/* AM / PM */}
            <View style={styles.ampmColumn}>
              {["AM", "PM"].map((p) => {
                const active = selectedPeriod === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.ampmBtn, active && styles.ampmBtnActive]}
                    onPress={() => setSelectedPeriod(p)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={p === "AM" ? "sunny-outline" : "moon-outline"}
                      size={14}
                      color={active ? "#fff" : COLORS.textLight}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[styles.ampmText, active && styles.ampmTextActive]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Hours Grid */}
        {activeTab === "hour" && (
          <View style={styles.gridSection}>
            <View style={styles.grid}>
              {HOURS.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                    onPress={() => {
                      setSelectedHour(h);
                      // Auto-advance to minute tab for seamless UX
                      setActiveTab("minute");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Minutes Grid & Fine-tuner */}
        {activeTab === "minute" && (
          <View style={styles.gridSection}>
            <View style={styles.grid}>
              {MINUTE_PRESETS.map((m) => {
                const isSelected = selectedMinute === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                    onPress={() => setSelectedMinute(m)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {pad(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Exact minute</Text>
              <View style={styles.stepperWrap}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustMinute(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{pad(selectedMinute)}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustMinute(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Quick Presets */}
        <Text style={styles.presetsHeading}>Quick presets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {QUICK_PRESETS.map((preset) => {
            const isMatch =
              selectedHour === preset.h &&
              selectedMinute === preset.m &&
              selectedPeriod === preset.p;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.presetChip, isMatch && styles.presetChipActive]}
                onPress={() => handleApplyPreset(preset)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipLabel,
                    isMatch && styles.presetChipLabelActive,
                  ]}
                >
                  {preset.label}
                </Text>
                <Text
                  style={[
                    styles.presetChipTime,
                    isMatch && styles.presetChipTimeActive,
                  ]}
                >
                  {preset.time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.confirmBtnText}>Confirm Time</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * 12-Hour Time Picker Modal with AM / PM matching HinduMatrimony aesthetic
 */
export default function TimePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
  title = "Select Time of Birth",
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      {visible ? (
        <TimePickerContent
          key={String(value || "empty")}
          value={value}
          onConfirm={onConfirm}
          onClose={onClose}
          title={title}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF8F6",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8E2",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
  },
  clearBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#DC2626",
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Display Card
  displayCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3E8E2",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  digitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  digitBox: {
    width: 82,
    height: 82,
    borderRadius: 18,
    backgroundColor: "#FFF1F2",
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  digitBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#FFE4E6",
  },
  digitText: {
    fontSize: 36,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    lineHeight: 42,
  },
  digitTextActive: {
    color: COLORS.primary,
  },
  digitSub: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
    marginTop: -2,
  },
  digitSubActive: {
    color: COLORS.primary,
  },
  colonSeparator: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginHorizontal: 8,
    marginTop: -6,
  },
  ampmColumn: {
    marginLeft: 14,
    gap: 8,
  },
  ampmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 78,
    height: 37,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ampmBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  ampmText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  ampmTextActive: {
    color: "#fff",
  },

  // Grid section (hours / minutes)
  gridSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3E8E2",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cell: {
    width: "23%",
    height: 56,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "#FAF5F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0E6DE",
  },
  cellSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cellText: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  cellTextSelected: {
    color: "#fff",
  },

  // Minute fine-tuner
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3E8E2",
  },
  stepperLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 48,
    textAlign: "center",
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },

  // Presets
  presetsHeading: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
    marginBottom: 10,
    marginLeft: 2,
  },
  presetsRow: {
    gap: 8,
    paddingRight: 4,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F3E8E2",
    alignItems: "center",
  },
  presetChipActive: {
    backgroundColor: "#FFE4E6",
    borderColor: COLORS.primary,
  },
  presetChipLabel: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
  },
  presetChipLabelActive: {
    color: COLORS.primary,
  },
  presetChipTime: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 1,
  },
  presetChipTimeActive: {
    color: COLORS.primary,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3E8E2",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textLight,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: "#fff",
  },
});
