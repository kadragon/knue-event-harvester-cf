import type { CalendarEventInput, ProcessedRecord } from "../types";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface CalendarEnv {
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
  GOOGLE_CALENDAR_ID: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

type JwtPayload = Record<string, unknown>;

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwt(payload: JwtPayload, serviceAccount: ServiceAccount): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const encoder = new TextEncoder();
  const privateKeyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken),
  );

  const signatureEncoded = base64UrlEncode(signature);
  return `${unsignedToken}.${signatureEncoded}`;
}

function parseServiceAccount(env: CalendarEnv): ServiceAccount {
  try {
    const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Invalid service account JSON");
    }
    return parsed;
  } catch (error) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", error);
    throw error;
  }
}

export async function obtainAccessToken(env: CalendarEnv): Promise<string> {
  const serviceAccount = parseServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri ?? DEFAULT_TOKEN_URI,
    scope: SCOPE,
    iat: now,
    exp: now + 3600,
  };

  const assertion = await signJwt(payload, serviceAccount);
  const response = await fetch(serviceAccount.token_uri ?? DEFAULT_TOKEN_URI, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to obtain access token", response.status, errorText);
    throw new Error(`Google OAuth error: ${response.status}`);
  }

  const data = (await response.json()) as AccessTokenResponse;
  return data.access_token;
}

export async function listEvents(
  env: CalendarEnv,
  token: string,
  params: { timeMin: string; timeMax: string },
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`,
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("timeMin", params.timeMin);
  url.searchParams.set("timeMax", params.timeMax);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to list events", response.status, errorText);
    throw new Error(`Google Calendar list error ${response.status}`);
  }

  const data = (await response.json()) as { items?: GoogleCalendarEvent[] };
  return data.items ?? [];
}

export async function createEvent(
  env: CalendarEnv,
  token: string,
  input: CalendarEventInput,
  meta: ProcessedRecord,
  descriptionExtras?: Record<string, unknown>,
): Promise<GoogleCalendarEvent> {
  const startDate = input.startDate;
  const endDate = input.endDate;

  let start: { date?: string; dateTime?: string };
  let end: { date?: string; dateTime?: string };

  if (input.startTime && input.endTime) {
    // Timed event
    const startDateTime = `${startDate}T${input.startTime}:00+09:00`; // Assume KST
    const endDateTime = startDate === endDate ? `${endDate}T${input.endTime}:00+09:00` : `${endDate}T${input.endTime}:00+09:00`;
    start = { dateTime: startDateTime };
    end = { dateTime: endDateTime };
  } else {
    // All-day event
    const endDateExclusive = addDays(endDate, 1);
    start = { date: startDate };
    end = { date: endDateExclusive };
  }

  const body = {
    summary: input.title,
    description: input.description,
    start,
    end,
    extendedProperties: {
      private: {
        nttNo: meta.nttNo,
        hash: meta.hash,
        ...Object.fromEntries(
          Object.entries(descriptionExtras ?? {}).map(([key, value]) => [
            key,
            typeof value === "string" ? value : JSON.stringify(value),
          ]),
        ),
      },
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create calendar event", response.status, errorText);
    throw new Error(`Google Calendar create error ${response.status}`);
  }

  return (await response.json()) as GoogleCalendarEvent;
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
