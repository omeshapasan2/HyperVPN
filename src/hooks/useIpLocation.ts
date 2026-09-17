import { useState, useEffect, useCallback } from "react";

export interface IpLocationInfo {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  isp: string | null;
  loading: boolean;
  error: string | null;
}

const initialInfo: IpLocationInfo = {
  ip: null,
  city: null,
  region: null,
  country: null,
  countryCode: null,
  isp: null,
  loading: true,
  error: null,
};

export function useIpLocation() {
  const [info, setInfo] = useState<IpLocationInfo>(initialInfo);

  const fetchIpLocation = useCallback(async () => {
    setInfo((prev) => ({ ...prev, loading: true, error: null }));

    // Strategy 1: Cloudflare Speed Meta (ultra-fast, accurate, no rate limits)
    try {
      const res = await fetch(`https://speed.cloudflare.com/meta?_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.clientIp) {
          setInfo({
            ip: data.clientIp || null,
            city: data.city || null,
            region: data.region || null,
            country: data.country || null,
            countryCode: data.country || null,
            isp: data.asOrganization || data.colo || null,
            loading: false,
            error: null,
          });
          return;
        }
      }
    } catch {
      // Fall through to Strategy 2
    }

    // Strategy 2: ipwho.is (CORS friendly, rich metadata)
    try {
      const res = await fetch(`https://ipwho.is/?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success !== false && data.ip) {
          setInfo({
            ip: data.ip,
            city: data.city || null,
            region: data.region || null,
            country: data.country || null,
            countryCode: data.country_code || null,
            isp: data.connection?.isp || data.connection?.org || null,
            loading: false,
            error: null,
          });
          return;
        }
      }
    } catch {
      // Fall through to Strategy 3
    }

    // Strategy 3: ipify fallback for IP only
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      if (res.ok) {
        const data = await res.json();
        if (data.ip) {
          setInfo({
            ip: data.ip,
            city: null,
            region: null,
            country: null,
            countryCode: null,
            isp: null,
            loading: false,
            error: null,
          });
          return;
        }
      }
    } catch (e: any) {
      setInfo({
        ip: null,
        city: null,
        region: null,
        country: null,
        countryCode: null,
        isp: null,
        loading: false,
        error: "Unable to detect IP",
      });
    }
  }, []);

  useEffect(() => {
    fetchIpLocation();
  }, [fetchIpLocation]);

  return {
    ...info,
    refresh: fetchIpLocation,
  };
}
