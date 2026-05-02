// src/utils/sendSms.ts
import axios from 'axios';
import { config as appConfig } from '../config';

const AUTHKEY_IO = appConfig.AUTHKEY_IO;
const AUTHKEY_URL = appConfig.AUTHKEY_URL;

function isSuccessResponseBody(body: any): boolean {
  if (!body) return false;
  // common provider patterns
  if (typeof body === 'string') {
    // some providers return plain text like "OK" or "success"
    const s = body.toLowerCase();
    return s.includes('ok') || s.includes('success') || s.includes('queued');
  }
  if (typeof body === 'object') {
    if (body.status && typeof body.status === 'string') {
      const s = body.status.toLowerCase();
      if (s === 'success' || s === 'sent' || s === 'ok') return true;
    }
    if (typeof body.error !== 'undefined') {
      // some providers return error: 0 when success
      if (Number(body.error) === 0) return true;
    }
    if (typeof body.type === 'string' && body.type.toLowerCase() === 'success') return true;
    if (typeof body.code !== 'undefined' && Number(body.code) >= 200 && Number(body.code) < 300) return true;
    // provider-specific keys
    if (body.data && (body.data.success === true || body.data.sent === true)) return true;
  }
  return false;
}

export async function sendOtp(
  mobile: string,
  countryCode: string,
  data: Record<string, any>,
  sid?: string
): Promise<boolean> {
  try {
    const params: Record<string, any> = {
      authkey: AUTHKEY_IO,
      mobile,
      country_code: countryCode,
      ...data,
    };

    if (sid) params.sid = sid;

    const resp = await axios.get(AUTHKEY_URL, { params, timeout: 15000 });

    // Log provider response for debugging (do not log secrets)
    try {
      console.log('[sendSms] provider response status:', resp.status);
      console.log('[sendSms] provider response body (truncated):', JSON.stringify(resp.data).slice(0, 1000));
    } catch (e) {
      console.log('[sendSms] provider response (non-json)', resp.data);
    }

    // Accept HTTP 200/201 as success OR examine body heuristics
    if (resp.status === 200 || resp.status === 201) return true;
    if (isSuccessResponseBody(resp.data)) return true;

    return false;
  } catch (err: any) {
    // log useful info but avoid leaking secrets
    console.error('[sendSms] sendOtp error:', err?.message || err);
    if (err?.response) {
      console.error('[sendSms] provider status:', err.response.status);
      try {
        console.error('[sendSms] provider body (truncated):', JSON.stringify(err.response.data).slice(0, 1000));
      } catch {}
    }
    return false;
  }
}

export async function getOTPViaCall(
  mobile: string,
  countryCode: string,
  voice?: string
): Promise<boolean> {
  try {
    const params: Record<string, any> = {
      authkey: AUTHKEY_IO,
      mobile,
      country_code: countryCode,
    };
    if (voice) params.voice = voice;

    const resp = await axios.get(AUTHKEY_URL, { params, timeout: 15000 });
    console.log('[sendSms] getOTPViaCall status:', resp.status);
    console.log('[sendSms] getOTPViaCall body:', JSON.stringify(resp.data).slice(0, 1000));
    if (resp.status === 200 || resp.status === 201) return true;
    if (isSuccessResponseBody(resp.data)) return true;
    return false;
  } catch (err: any) {
    console.error('[sendSms] getOTPViaCall error:', err?.message || err);
    return false;
  }
}

export default {
  sendOtp,
  getOTPViaCall,
};
