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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CURRENT_YEAR = new Date().getFullYear();
const MAX_ELIGIBLE_YEAR = CURRENT_YEAR - 18; // At least 18 yrs old for matrimony
const MIN_ELIGIBLE_YEAR = 1945;

// Generate years from max to min
const YEARS = [];
for (let y = MAX_ELIGIBLE_YEAR; y >= MIN_ELIGIBLE_YEAR; y--) {
  YEARS.push(y);
}

const AGE_PRESETS = [
  { label: "21 yrs", age: 21 },
  { label: "23 yrs", age: 23 },
  { label: "25 yrs", age: 25 },
  { label: "27 yrs", age: 27 },
  { label: "30 yrs", age: 30 },
  { label: "32 yrs", age: 32 },
  { label: "35 yrs", age: 35 },
  { label: "40 yrs", age: 40 },
];

function parseDateString(raw) {
  const defaultYear = CURRENT_YEAR - 25;
  const defaultMonth = 0; // Jan
  const defaultDay = 1;

  if (!raw || typeof raw !== "string") {
    return { year: defaultYear, month: defaultMonth, day: defaultDay };
  }

  const clean = raw.trim();

  // YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return {
        year: Math.max(MIN_ELIGIBLE_YEAR, Math.min(MAX_ELIGIBLE_YEAR, y)),
        month: Math.max(0, Math.min(11, m)),
        day: Math.max(1, Math.min(31, d)),
      };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return {
        year: Math.max(MIN_ELIGIBLE_YEAR, Math.min(MAX_ELIGIBLE_YEAR, y)),
        month: Math.max(0, Math.min(11, m)),
        day: Math.max(1, Math.min(31, d)),
      };
    }
  }

  return { year: defaultYear, month: defaultMonth, day: defaultDay };
}

function formatDate(year, month, day, format = "YYYY-MM-DD") {
  const padM = String(month + 1).padStart(2, "0");
  const padD = String(day).padStart(2, "0");
  if (format === "DD/MM/YYYY") {
    return `${padD}/${padM}/${year}`;
  }
  return `${year}-${padM}-${padD}`;
}

function calculateAge(year, month, day) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Inner component holding state so it resets cleanly without setState in effect
 */
function DatePickerContent({
  value,
  onConfirm,
  onClose,
  format = "YYYY-MM-DD",
  title = "Select Date of Birth",
}) {
  const initial = useMemo(() => parseDateString(value), [value]);
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [activeView, setActiveView] = useState("day"); // "day" | "month" | "year"

  // Days in current year + month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // First day of week for this month (0 = Sun, 6 = Sat)
  const firstDayOfWeek = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay();
  }, [selectedYear, selectedMonth]);

  // Calendar split into week rows (null = empty slot) so cells never wrap oddly
  const weeks = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [firstDayOfWeek, daysInMonth]);

  // Current age
  const age = useMemo(() => {
    return calculateAge(selectedYear, selectedMonth, selectedDay);
  }, [selectedYear, selectedMonth, selectedDay]);

  // Formatted date output
  const formattedDisplay = useMemo(() => {
    return formatDate(selectedYear, selectedMonth, selectedDay, format);
  }, [selectedYear, selectedMonth, selectedDay, format]);

  // Handle month change via arrows
  const prevMonth = () => {
    if (selectedMonth === 0) {
      if (selectedYear > MIN_ELIGIBLE_YEAR) {
        setSelectedYear((y) => y - 1);
        setSelectedMonth(11);
      }
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      if (selectedYear < MAX_ELIGIBLE_YEAR) {
        setSelectedYear((y) => y + 1);
        setSelectedMonth(0);
      }
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    const finalDay = Math.min(selectedDay, daysInMonth);
    const res = formatDate(selectedYear, selectedMonth, finalDay, format);
    const iso = formatDate(selectedYear, selectedMonth, finalDay, "YYYY-MM-DD");
    onConfirm(res, iso);
    onClose();
  };

  const handleClear = () => {
    onConfirm("", "");
    onClose();
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      {/* Top Header */}
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
        {/* Selected Date Summary */}
        <View style={styles.displayCard}>
          <View style={styles.displayDateRow}>
            <View style={styles.displayIconWrap}>
              <Ionicons name="calendar" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.displayDateText} numberOfLines={1}>
                {selectedDay} {MONTH_NAMES[selectedMonth]} {selectedYear}
              </Text>
              <Text style={styles.displayFormatSub}>
                {formattedDisplay}
              </Text>
            </View>
          </View>
          <View style={styles.ageBadge}>
            <Text style={styles.ageBadgeText}>{age} yrs</Text>
          </View>
        </View>

        {/* -------------------- VIEW 1: DAY CALENDAR -------------------- */}
        {activeView === "day" && (
          <View style={styles.calendarCard}>
            {/* Month & Year Navigation Row */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={prevMonth}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={COLORS.text} />
              </TouchableOpacity>

              <View style={styles.monthYearPickerBtns}>
                <TouchableOpacity
                  style={styles.monthSelectBtn}
                  onPress={() => setActiveView("month")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.monthSelectText}>
                    {MONTH_NAMES[selectedMonth]}
                  </Text>
                  <Ionicons
                    name="caret-down"
                    size={12}
                    color={COLORS.primary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.yearSelectBtn}
                  onPress={() => setActiveView("year")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.yearSelectText}>{selectedYear}</Text>
                  <Ionicons
                    name="caret-down"
                    size={12}
                    color={COLORS.primary}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={nextMonth}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            {/* Weekdays Row */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((w, idx) => (
                <View key={w} style={styles.weekdayCell}>
                  <Text
                    style={[
                      styles.weekdayText,
                      (idx === 0 || idx === 6) && styles.weekendText,
                    ]}
                  >
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {weeks.map((week, wIdx) => (
                <View key={`week-${wIdx}`} style={styles.weekRow}>
                  {week.map((dayNum, dIdx) => {
                    if (!dayNum) {
                      return (
                        <View
                          key={`empty-${wIdx}-${dIdx}`}
                          style={styles.dayCellEmpty}
                        />
                      );
                    }
                    const isSelected = selectedDay === dayNum;
                    return (
                      <TouchableOpacity
                        key={`day-${dayNum}`}
                        style={styles.dayCellWrap}
                        onPress={() => setSelectedDay(dayNum)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.dayCell,
                            isSelected && styles.dayCellSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.dayTextSelected,
                            ]}
                          >
                            {dayNum}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* -------------------- VIEW 2: MONTH SELECTOR -------------------- */}
        {activeView === "month" && (
          <View style={styles.calendarCard}>
            <View style={styles.pickerHeaderRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => setActiveView("day")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.sectionHeading}>{selectedYear}</Text>
              <View style={styles.navArrowSpacer} />
            </View>
            <View style={styles.monthsGrid}>
              {MONTH_NAMES.map((mName, mIdx) => {
                const isSelected = selectedMonth === mIdx;
                return (
                  <TouchableOpacity
                    key={mName}
                    style={[
                      styles.monthCard,
                      isSelected && styles.monthCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(mIdx);
                      setActiveView("day");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.monthCardText,
                        isSelected && styles.monthCardTextSelected,
                      ]}
                    >
                      {MONTH_SHORT[mIdx]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* -------------------- VIEW 3: YEAR SELECTOR -------------------- */}
        {activeView === "year" && (
          <View style={styles.calendarCard}>
            <View style={styles.pickerHeaderRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => setActiveView("day")}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.sectionHeading}>Birth year</Text>
              <View style={styles.navArrowSpacer} />
            </View>
            <Text style={styles.sectionSubHeading}>
              Must be 18 or older ({MIN_ELIGIBLE_YEAR} - {MAX_ELIGIBLE_YEAR})
            </Text>
            <ScrollView
              style={styles.yearsScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.yearsGrid}>
                {YEARS.map((y) => {
                  const isSelected = selectedYear === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearCard,
                        isSelected && styles.yearCardSelected,
                      ]}
                      onPress={() => {
                        setSelectedYear(y);
                        setActiveView("month");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.yearCardText,
                          isSelected && styles.yearCardTextSelected,
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Quick Age Presets */}
        <Text style={styles.presetsHeading}>Quick age presets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {AGE_PRESETS.map((p) => {
            const targetYear = CURRENT_YEAR - p.age;
            const isMatch = selectedYear === targetYear;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetChip, isMatch && styles.presetChipActive]}
                onPress={() => {
                  setSelectedYear(targetYear);
                  setActiveView("day");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    isMatch && styles.presetChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          activeOpacity={0.7}
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
          <Text style={styles.confirmBtnText}>Confirm ({formattedDisplay})</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * Modern, cross-platform Date Picker Modal with calendar, month, and year selectors
 */
export default function DatePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
  format = "YYYY-MM-DD",
  title = "Select Date of Birth",
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      {visible ? (
        <DatePickerContent
          key={String(value || "empty")}
          value={value}
          onConfirm={onConfirm}
          onClose={onClose}
          format={format}
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
    borderBottomWidth: 1,
    borderBottomColor: "#F3E8E2",
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
  },
  clearBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#F3E8E2",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  displayDateRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  displayIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  displayDateText: {
    flexShrink: 1,
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
  },
  displayFormatSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  ageBadge: {
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  ageBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },

  // Calendar Card
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#F3E8E2",
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5EBE6",
    alignItems: "center",
    justifyContent: "center",
  },
  navArrowSpacer: {
    width: 36,
    height: 36,
  },
  monthYearPickerBtns: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#FFF0F5",
    borderRadius: 10,
    marginRight: 8,
  },
  monthSelectText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  yearSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#FFF0F5",
    borderRadius: 10,
  },
  yearSelectText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },

  // Weekdays
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  weekdayText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textLight,
  },
  weekendText: {
    color: "#E11D48",
  },

  // Days Grid
  daysGrid: {},
  weekRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  dayCellEmpty: {
    flex: 1,
    height: 42,
  },
  dayCellWrap: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  dayTextSelected: {
    fontFamily: FONTS.bold,
    color: "#FFFFFF",
  },

  // Month / Year picker header
  pickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
  },
  sectionSubHeading: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 12,
    marginTop: -4,
  },

  // Months Grid
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  monthCard: {
    width: "31%",
    height: 54,
    backgroundColor: "#FAF5F0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F0E6DE",
  },
  monthCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthCardText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  monthCardTextSelected: {
    color: "#FFFFFF",
  },

  // Years Grid (scrollable)
  yearsScroll: {
    maxHeight: 300,
  },
  yearsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  yearCard: {
    width: "31%",
    height: 46,
    backgroundColor: "#FAF5F0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F0E6DE",
  },
  yearCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearCardText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  yearCardTextSelected: {
    color: "#FFFFFF",
  },

  // Presets
  presetsHeading: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 10,
    marginLeft: 2,
  },
  presetsRow: {
    paddingRight: 4,
  },
  presetChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#F3E8E2",
  },
  presetChipActive: {
    backgroundColor: "#FFE4E6",
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
  },
  presetChipTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  // Footer Actions
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3E8E2",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  cancelBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textLight,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});
