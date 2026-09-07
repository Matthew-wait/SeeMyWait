import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map<string, string>();

export const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) memoryStore.set(key, value);
    return value;
  } catch {
    return memoryStore.get(key) ?? null;
  }
};

export const safeSetItem = async (key: string, value: string): Promise<void> => {
  memoryStore.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore native storage availability errors and keep in-memory fallback.
  }
};
