import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import { useAppSelector } from '../app/hooks';

interface PostalResult {
  city: string;
  state: string;
}

export function usePostalLookup() {
  const [loadingPostal, setLoadingPostal] = useState(false);
  const countries = useAppSelector(state => state.app.countries || []);

  const lookupPostal = useCallback(async (postalCode: string, countryCode: string): Promise<PostalResult | null> => {
    if (!postalCode || !countryCode || countries.length === 0) return null;

    setLoadingPostal(true);
    try {
      const country = countries.find((c: any) => c.countryCode === countryCode);
      if (!country) {
        return null;
      }

      const response = await axios.get(`${API_BASE_URL}/Postals/GetPostalsByPostalCodeAndCountryId`, {
        params: {
          postalCode,
          countryId: country.countryId,
        }
      });

      if (response.data && response.data.isSuccess && response.data.data && response.data.data.length > 0) {
        const data = response.data.data[0];
        return {
          city: data.cityName,
          state: data.stateCode?.trim() || "",
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to lookup postal code", error);
      return null;
    } finally {
      setLoadingPostal(false);
    }
  }, [countries]);

  return { lookupPostal, loadingPostal };
}
