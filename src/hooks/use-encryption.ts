import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import {
  deriveKeyFromUserId,
  storeEncryptionKey,
  getEncryptionKey,
  clearEncryptionKey,
  encryptData,
  decryptData,
  type EncryptedData,
} from "@/lib/encryption";

/**
 * Hook for managing user encryption keys and operations
 */
export function useEncryption() {
  const { user, isAuthenticated } = useAuth();
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setEncryptionKey(null);
      setIsReady(false);
      return;
    }

    // Try to get existing key from session storage
    let key = getEncryptionKey(user._id);

    // If no key exists, derive one from user ID
    if (!key) {
      deriveKeyFromUserId(user._id).then((derivedKey) => {
        storeEncryptionKey(user._id, derivedKey);
        setEncryptionKey(derivedKey);
        setIsReady(true);
      });
    } else {
      setEncryptionKey(key);
      setIsReady(true);
    }
  }, [isAuthenticated, user]);

  const encrypt = (data: string): EncryptedData | null => {
    if (!encryptionKey) return null;
    return encryptData(data, encryptionKey);
  };

  const decrypt = (encryptedData: EncryptedData): string | null => {
    if (!encryptionKey) return null;
    return decryptData(encryptedData, encryptionKey);
  };

  const clearKey = () => {
    if (user) {
      clearEncryptionKey(user._id);
    }
    setEncryptionKey(null);
    setIsReady(false);
  };

  return {
    encryptionKey,
    isReady,
    encrypt,
    decrypt,
    clearKey,
  };
}