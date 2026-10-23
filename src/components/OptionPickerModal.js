import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

/**
 * Fast, searchable option picker modal for single-select dropdowns
 */
export default function OptionPickerModal({
  visible,
  title,
  subtitle,
  options = [],
  selectedId,
  onSelect,
  onClose,
  loading = false,
  placeholder = "Search options...",
}) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const starts = [];
    const contains = [];
    (options || []).forEach((opt) => {
      const name = String(opt.name || "").toLowerCase();
      if (name.startsWith(q)) {
        starts.push(opt);
      } else if (name.includes(q)) {
        contains.push(opt);
      }
    });
    return starts.concat(contains);
  }, [options, query]);

  const handleSelect = (item) => {
    setQuery("");
    onSelect(item);
  };

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title || "Select Option"}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              <Text style={styles.subtitle}>
                {options.length} {options.length === 1 ? "option" : "options"} available
              </Text>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textLight}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {Boolean(query) && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Options List */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading options...</Text>
          </View>
        ) : filteredOptions.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="file-tray-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No options found</Text>
            <Text style={styles.emptySubtitle}>Try searching with a different keyword</Text>
          </View>
        ) : (
          <FlatList
            data={filteredOptions}
            keyExtractor={(item, index) => String(item.id ?? index)}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={25}
            maxToRenderPerBatch={30}
            windowSize={10}
            renderItem={({ item }) => {
              const isSelected = String(item.id) === String(selectedId);
              return (
                <TouchableOpacity
                  style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                    {item.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 2,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    padding: 0,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  itemRowSelected: {
    backgroundColor: "#FFF1F2",
  },
  itemText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    flex: 1,
  },
  itemTextSelected: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },
});
