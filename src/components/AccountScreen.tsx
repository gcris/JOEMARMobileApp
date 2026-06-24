import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { getStyles, getThemeColors } from '../theme/styles';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../services/supabase';
import { getPersonnelById, savePersonnel } from '../services/database';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';

interface AccountScreenProps {
  personnelId: string;
  isDarkTheme: boolean;
  onClose: () => void;
}

export const AccountScreen = ({ personnelId, isDarkTheme, onClose }: AccountScreenProps) => {
  const styles = getStyles(isDarkTheme);
  const colors = getThemeColors(isDarkTheme);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [personnel, setPersonnel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form fields
  const [fullname, setFullname] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [viberNumber, setViberNumber] = useState<string>('');

  // Load personnel data
  useEffect(() => {
    const loadPersonnel = async () => {
      try {
        setIsLoading(true);
        const personnelData = await getPersonnelById(personnelId);
        if (personnelData) {
          setPersonnel(personnelData);
          setFullname(personnelData.fullname || '');
          setPhoneNumber(personnelData.phoneNumber || '');
          setViberNumber(personnelData.viberNumber || '');
        }
      } catch (error) {
        console.error('Error loading personnel:', error);
        Alert.alert('Error', 'Failed to load personnel data');
      } finally {
        setIsLoading(false);
      }
    };

    if (personnelId) {
      loadPersonnel();
    }
  }, [personnelId]);

  const handleSave = async () => {
    if (!personnel) return;

    setIsSaving(true);
    try {
      // Prepare update data
      const updates = {
        fullname: fullname.trim(),
        phoneNumber: phoneNumber.trim(),
        viberNumber: viberNumber.trim(),
      };

      // Update in Supabase
      await savePersonnel({
        ...personnel,
        ...updates,
      });

      Alert.alert('Success', 'Personnel information updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving personnel:', error);
      Alert.alert('Error', 'Failed to save personnel information');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentAmber} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingHorizontal: 20, paddingTop: 30 }]}
      contentContainerStyle={{ paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ marginBottom: 30 }}>
        <TouchableOpacity
          style={{ padding: 10 }}
          onPress={onClose}
        >
          <Ionicons name="chevron-back-outline" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          textAlign: 'center',
          color: colors.blackText,
          marginVertical: 10
        }}>
          Account Settings
        </Text>
        <Text style={{
          fontSize: 14,
          textAlign: 'center',
          color: colors.textSecondary,
          marginBottom: 5
        }}>
          Edit your profile information
        </Text>
      </View>

      {/* Form Fields */}
      <View style={{ marginBottom: 30 }}>
        {/* Full Name */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.blackText,
            marginBottom: 8
          }}>
            Full Name
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue }
            ]}
            value={fullname}
            onChangeText={setFullname}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
        </View>

        {/* Phone Number */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.blackText,
            marginBottom: 8
          }}>
            Phone Number
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue }
            ]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>

        {/* Viber Number */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.blackText,
            marginBottom: 8
          }}>
            Viber Number
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderWidth: 1, borderColor: colors.borderBlue }
            ]}
            value={viberNumber}
            onChangeText={setViberNumber}
            placeholder="Enter your Viber number"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.buttonPrimary,
          { marginHorizontal: 20, marginBottom: 20 }
        ]}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>
            Save Changes
          </Text>
        )}
      </TouchableOpacity>

      {/* Cancel Button */}
      <TouchableOpacity
        style={{ marginHorizontal: 20 }}
        onPress={onClose}
      >
        <Text style={{
          fontSize: 16,
          color: colors.accentAmber,
          textAlign: 'center',
          fontWeight: '600'
        }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};