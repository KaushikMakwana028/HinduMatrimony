import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme";

function ModalField({
  label,
  required,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  maxLength,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.star}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle"
            size={13}
            color="#DC2626"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function EducationCareerContent({ type, item, onSave, onClose }) {
  const isEducation = type === "education";
  const isEdit = Boolean(item && item.id);

  const initialValues = useMemo(() => {
    if (isEducation) {
      return {
        degree: item?.degree || "",
        institution: item?.institution || "",
        start: item?.start !== undefined && item?.start !== null ? String(item.start) : "",
        end: item?.end !== undefined && item?.end !== null ? String(item.end) : "",
      };
    }
    return {
      designation: item?.designation || "",
      company: item?.company || "",
      start: item?.start !== undefined && item?.start !== null ? String(item.start) : "",
      end: item?.end !== undefined && item?.end !== null ? String(item.end) : "",
    };
  }, [isEducation, item]);

  const [form, setForm] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const errs = {};
    if (isEducation) {
      if (!form.degree.trim()) errs.degree = "Degree is required";
      if (!form.institution.trim()) errs.institution = "Institution is required";
      if (!form.start.trim()) errs.start = "Start year is required";
    } else {
      if (!form.designation.trim()) errs.designation = "Designation is required";
      if (!form.company.trim()) errs.company = "Company is required";
      if (!form.start.trim()) errs.start = "Start year is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        general: err?.message || "Failed to save details",
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.modalOverlay}
    >
      <View style={styles.modalCard}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleRow}>
            <View
              style={[
                styles.modalIconWrap,
                { backgroundColor: isEducation ? "#EEF2FF" : "#F0FDF4" },
              ]}
            >
              <Ionicons
                name={isEducation ? "school-outline" : "briefcase-outline"}
                size={20}
                color={isEducation ? "#4F46E5" : "#16A34A"}
              />
            </View>
            <View>
              <Text style={styles.modalTitle}>
                {isEdit
                  ? `Edit ${isEducation ? "Education" : "Career"}`
                  : `Add ${isEducation ? "Education" : "Career"}`}
              </Text>
              <Text style={styles.modalSubtitle}>
                {isEducation
                  ? "Degree, institution & passing year"
                  : "Designation, company & duration"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Form Body */}
        <ScrollView
          style={styles.modalBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errors.general ? (
            <View style={styles.bannerError}>
              <Ionicons
                name="alert-circle"
                size={18}
                color="#DC2626"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.bannerErrorText}>{errors.general}</Text>
            </View>
          ) : null}

          {isEducation ? (
            <>
              <ModalField
                label="Degree / Course"
                required
                value={form.degree}
                onChangeText={(t) => {
                  setForm((p) => ({ ...p, degree: t }));
                  setErrors((p) => ({ ...p, degree: undefined }));
                }}
                placeholder="e.g. MCA, B.Tech, MBA"
                error={errors.degree}
              />
              <ModalField
                label="Institution / University"
                required
                value={form.institution}
                onChangeText={(t) => {
                  setForm((p) => ({ ...p, institution: t }));
                  setErrors((p) => ({ ...p, institution: undefined }));
                }}
                placeholder="e.g. SSIT, RB College, Gujarat University"
                error={errors.institution}
              />
            </>
          ) : (
            <>
              <ModalField
                label="Designation / Role"
                required
                value={form.designation}
                onChangeText={(t) => {
                  setForm((p) => ({ ...p, designation: t }));
                  setErrors((p) => ({ ...p, designation: undefined }));
                }}
                placeholder="e.g. Software Developer, Intern"
                error={errors.designation}
              />
              <ModalField
                label="Company / Employer"
                required
                value={form.company}
                onChangeText={(t) => {
                  setForm((p) => ({ ...p, company: t }));
                  setErrors((p) => ({ ...p, company: undefined }));
                }}
                placeholder="e.g. Vision, Google, TCS"
                error={errors.company}
              />
            </>
          )}

          {/* Start & End Years Row */}
          <View style={styles.yearRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <ModalField
                label="Start Year"
                required
                value={form.start}
                onChangeText={(t) => {
                  setForm((p) => ({ ...p, start: t }));
                  setErrors((p) => ({ ...p, start: undefined }));
                }}
                placeholder="e.g. 2022"
                keyboardType="number-pad"
                maxLength={4}
                error={errors.start}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <ModalField
                label="End Year (Optional)"
                value={form.end}
                onChangeText={(t) => setForm((p) => ({ ...p, end: t }))}
                placeholder="e.g. 2025"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={onClose}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveActionBtn, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.saveActionText}>
                  {isEdit ? "Update" : "Save"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Reusable modal for Adding / Editing Education & Career entries
 */
export default function EducationCareerModal({
  visible,
  type = "education",
  item,
  onSave,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {visible ? (
        <EducationCareerContent
          key={String(item?.id || "new")}
          type={type}
          item={item}
          onSave={onSave}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  modalTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.text,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 6,
  },
  star: {
    color: COLORS.primary,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "#DC2626",
  },
  yearRow: {
    flexDirection: "row",
  },
  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerErrorText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#B91C1C",
    flex: 1,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  cancelActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  cancelActionText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#374151",
  },
  saveActionBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveActionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
