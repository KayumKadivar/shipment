import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';
import { useAppSelector } from '../app/hooks';

export interface PostalResult {
  city: string;
  state: string;
  postalCode?: string;
}

export function usePostalLookup() {
  const [loadingPostal, setLoadingPostal] = useState(false);
  const countries = useAppSelector(state => state.app.countries || []);

  const searchPostals = useCallback(async (postalCode: string, countryCode: string): Promise<PostalResult[]> => {
    if (!postalCode) return [];

    setLoadingPostal(true);
    try {
      const country = countries.find(
        (c: any) =>
          c.countryCode?.toUpperCase() === countryCode?.toUpperCase() ||
          c.countryName?.toLowerCase() === countryCode?.toLowerCase() ||
          ((countryCode?.toUpperCase() === "USA" || countryCode?.toLowerCase().includes("united states")) &&
            (c.countryCode === "USA" || c.countryName?.includes("United States")))
      );
      const countryId = country ? country.countryId : 1;

      const response = await axios.get(`${API_BASE_URL}/Postals/GetPostalsByPostalCodeAndCountryId`, {
        params: {
          postalCode,
          countryId,
        }
      });

      if (response.data && response.data.isSuccess) {
        if (!response.data.data || response.data.data.length === 0) {
          return [];
        }
        
        if (Array.isArray(response.data.data)) {
          return response.data.data.map((data: any) => ({
            city: data.cityName,
            state: data.stateCode?.trim() || "",
            postalCode: data.postalCode || postalCode,
          }));
        }
      }
      return [];
    } catch (error) {
      console.error("Failed to lookup postal code", error);
      return [];
    } finally {
      setLoadingPostal(false);
    }
  }, [countries]);

  const lookupPostal = useCallback(async (postalCode: string, countryCode: string): Promise<PostalResult | null> => {
    const results = await searchPostals(postalCode, countryCode);
    return results.length > 0 ? results[0] : null;
  }, [searchPostals]);

  return { lookupPostal, searchPostals, loadingPostal };
}
