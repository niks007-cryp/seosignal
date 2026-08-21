// server/vercelHandler.ts
import "dotenv/config";

// server/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/routers.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// shared/qualification.ts
var CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", name: "Euro", symbol: "\u20AC", locale: "de-DE" },
  { code: "GBP", name: "British Pound", symbol: "\xA3", locale: "en-GB" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20B9", locale: "en-IN" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", locale: "en-CA" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG" },
  { code: "AED", name: "UAE Dirham", symbol: "\u062F.\u0625", locale: "en-AE" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH" },
  { code: "JPY", name: "Japanese Yen", symbol: "\xA5", locale: "ja-JP" }
];
function formatBudgetAmount(amount, currency) {
  const definition = CURRENCIES.find((item) => item.code === currency) ?? CURRENCIES[0];
  return new Intl.NumberFormat(definition.locale, {
    style: "currency",
    currency: definition.code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0
  }).format(Math.max(0, amount));
}

// server/geminiQualification.ts
import { z as z2 } from "zod";

// server/qualification-config.ts
var QUALIFICATION_CONFIG = {
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  supportedServices: ["SEO strategy", "Technical SEO", "Content SEO", "Enterprise SEO", "SEO audit"],
  supportedObjectives: ["Qualified leads", "Organic revenue", "Market visibility", "Technical health"],
  targetCustomerTypes: [
    "B2B SaaS and technology companies",
    "Professional service businesses with a considered buying journey",
    "Established B2B companies investing in sustainable organic acquisition"
  ],
  icpEvidence: {
    targetTerms: ["b2b", "saas", "software", "technology", "platform", "enterprise", "professional services", "consulting"],
    nonProspectTerms: ["internal validation", "test submission", "placeholder", "example.com"]
  },
  preferredMarkets: ["United States", "United Kingdom", "Canada", "Australia", "India", "Europe", "Global"],
  weights: {
    service_fit: 20,
    icp_fit: 15,
    budget_fit: 15,
    geographic_fit: 10,
    business_objective_fit: 10,
    use_case_fit: 10,
    timeline_fit: 5,
    buying_intent: 5,
    goal_clarity: 5,
    information_completeness: 5
  },
  thresholds: { high: 75, medium: 50 },
  budgetMinimums: {
    USD: 1e3,
    EUR: 1e3,
    GBP: 900,
    INR: 8e4,
    CAD: 1300,
    AUD: 1500,
    SGD: 1350,
    AED: 3700,
    CHF: 900,
    JPY: 15e4
  },
  hardDisqualifiers: {
    unsupportedService: "The requested requirement is outside the defined SEO service capability.",
    materiallyLowBudget: "The stated ongoing budget is materially below the prototype commercial assumption for the selected currency.",
    unrealisticTimeline: "The requested timeline expects meaningful SEO results in less than 30 days.",
    fundamentalIcpMismatch: "The submitted company and website evidence indicate a fundamental mismatch with the prototype B2B SEO customer profile."
  }
};
var FACTOR_LABELS = {
  service_fit: "Service Fit",
  icp_fit: "ICP / Company",
  budget_fit: "Commercial Scope",
  geographic_fit: "Market",
  business_objective_fit: "Business Goal",
  use_case_fit: "SEO Use Case",
  timeline_fit: "Timeline",
  buying_intent: "Intent",
  goal_clarity: "Goal Clarity",
  information_completeness: "Information Completeness"
};

// server/geminiQualification.ts
var ratingSchema = z2.enum(["STRONG", "MODERATE", "WEAK", "UNKNOWN"]);
var factorSchema = z2.object({ rating: ratingSchema, reason: z2.string().min(1).max(420) });
var geminiQualificationSchema = z2.object({
  qualification: z2.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z2.number().min(0).max(100),
  confidence: z2.enum(["HIGH", "MEDIUM", "LOW"]),
  reasoning: z2.string().min(1).max(900),
  factors: z2.object({
    service_fit: factorSchema,
    icp_fit: factorSchema,
    budget_fit: factorSchema,
    geographic_fit: factorSchema,
    business_objective_fit: factorSchema,
    use_case_fit: factorSchema,
    timeline_fit: factorSchema,
    buying_intent: factorSchema,
    goal_clarity: factorSchema,
    information_completeness: factorSchema
  }),
  missing_information: z2.array(z2.string().min(1).max(300)).max(6),
  next_best_action: z2.object({ title: z2.string().min(1).max(120), body: z2.string().min(1).max(420), steps: z2.array(z2.string().min(1).max(180)).min(1).max(4) })
});
var responseJsonSchema = {
  type: "object",
  properties: {
    qualification: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    score: { type: "number" },
    confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    reasoning: { type: "string" },
    factors: {
      type: "object",
      properties: Object.fromEntries(
        Object.keys(QUALIFICATION_CONFIG.weights).map((key) => [key, {
          type: "object",
          properties: { rating: { type: "string", enum: ["STRONG", "MODERATE", "WEAK", "UNKNOWN"] }, reason: { type: "string" } },
          required: ["rating", "reason"],
          additionalProperties: false
        }])
      ),
      required: Object.keys(QUALIFICATION_CONFIG.weights),
      additionalProperties: false
    },
    missing_information: { type: "array", items: { type: "string" } },
    next_best_action: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" }, steps: { type: "array", items: { type: "string" } } },
      required: ["title", "body", "steps"],
      additionalProperties: false
    }
  },
  required: ["qualification", "score", "confidence", "reasoning", "factors", "missing_information", "next_best_action"],
  additionalProperties: false
};
var GeminiQualificationError = class extends Error {
};
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
async function analyzeWithGemini(lead, inspection) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiQualificationError("Gemini credentials are unavailable.");
  const prompt = `You are an evidence-led B2B SEO lead analyst. Assess only the supplied lead and homepage inspection. Never invent facts, exchange rates, or client outcomes. Use UNKNOWN for unsupported conclusions. Your factor names and ratings must exactly match the output schema. The server independently calculates the final score from the factor ratings, explicit weights, thresholds and hard disqualifiers.

Qualification framework: service fit 20%, ICP/company fit 15%, budget fit 15%, geographic/market fit 10%, business-objective fit 10%, SEO use-case fit 10%, timeline fit 5%, buying intent 5%, goal clarity 5%, information completeness 5%. HIGH is 75-100, MEDIUM 50-74, LOW 0-49. A request for meaningful SEO results in less than 30 days must be WEAK for timeline. Do not calculate or convert between currencies.

Lead input:
${JSON.stringify(lead)}

Homepage inspection status: ${inspection.status}
Homepage title: ${inspection.title ?? "Unavailable"}
Homepage meta description: ${inspection.metaDescription ?? "Unavailable"}
Homepage visible text excerpt: ${inspection.visibleText ?? "Unavailable"}`;
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${QUALIFICATION_CONFIG.geminiModel}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.15, responseMimeType: "application/json", responseJsonSchema }
        }),
        signal: AbortSignal.timeout(22e3)
      });
    } catch {
      if (attempt === 0) {
        await delay(350);
        continue;
      }
      throw new GeminiQualificationError("Gemini request failed.");
    }
    if (response.ok) break;
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt === 0) {
      await delay(350);
      continue;
    }
    throw new GeminiQualificationError(`Gemini returned ${response.status}.`);
  }
  if (!response?.ok) throw new GeminiQualificationError("Gemini request failed.");
  const payload = await response.json();
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!content) throw new GeminiQualificationError("Gemini returned no structured content.");
  try {
    return geminiQualificationSchema.parse(JSON.parse(content));
  } catch {
    throw new GeminiQualificationError("Gemini returned malformed structured content.");
  }
}
function ratingToAssessment(rating) {
  return { STRONG: "Strong", MODERATE: "Moderate", WEAK: "Weak", UNKNOWN: "Unknown" }[rating];
}
function factorEntries(factors) {
  return Object.entries(factors);
}

// server/qualification.ts
var ratingValue = { STRONG: 100, MODERATE: 65, WEAK: 25, UNKNOWN: 45 };
function disqualifiersFor(lead) {
  const issues = [];
  if (!QUALIFICATION_CONFIG.supportedServices.includes(lead.serviceRequired)) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.unsupportedService);
  if (lead.budgetAmount < QUALIFICATION_CONFIG.budgetMinimums[lead.budgetCurrency] * 0.35) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.materiallyLowBudget);
  if (/0.?30|under 30|less than 30|within 30/i.test(lead.timeline ?? "")) issues.push(QUALIFICATION_CONFIG.hardDisqualifiers.unrealisticTimeline);
  return issues;
}
function applyConfiguredIcpAssessment(lead, inspection, factors) {
  const evidence = `${lead.company} ${lead.website} ${inspection.title ?? ""} ${inspection.metaDescription ?? ""} ${inspection.visibleText ?? ""}`.toLowerCase();
  const nonProspectMatch = QUALIFICATION_CONFIG.icpEvidence.nonProspectTerms.find((term) => evidence.includes(term));
  if (nonProspectMatch) {
    return {
      ...factors,
      icp_fit: {
        rating: "WEAK",
        reason: `Configured ICP screening identified the non-prospect or placeholder marker \u201C${nonProspectMatch}\u201D.`
      }
    };
  }
  const targetMatch = QUALIFICATION_CONFIG.icpEvidence.targetTerms.find((term) => evidence.includes(term));
  if (targetMatch && factors.icp_fit.rating === "UNKNOWN") {
    return {
      ...factors,
      icp_fit: {
        rating: "MODERATE",
        reason: `Configured ICP screening found target-profile evidence: \u201C${targetMatch}\u201D.`
      }
    };
  }
  return factors;
}
function calculateQualificationScore(factors, disqualifiers) {
  const weighted = factorEntries(factors).reduce((total, [key, factor]) => total + ratingValue[factor.rating] * QUALIFICATION_CONFIG.weights[key] / 100, 0);
  const fundamentalIcpMismatch = disqualifiers.includes(QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch);
  const adjusted = disqualifiers.length || fundamentalIcpMismatch ? Math.min(weighted, disqualifiers.some((item) => item === QUALIFICATION_CONFIG.hardDisqualifiers.unsupportedService || item === QUALIFICATION_CONFIG.hardDisqualifiers.unrealisticTimeline) || fundamentalIcpMismatch ? 35 : 49) : weighted;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}
function qualificationFromScore(score) {
  return score >= QUALIFICATION_CONFIG.thresholds.high ? "HIGH" : score >= QUALIFICATION_CONFIG.thresholds.medium ? "MEDIUM" : "LOW";
}
function reportFromAnalysis(lead, inspection, analysis) {
  const factors = applyConfiguredIcpAssessment(lead, inspection, analysis.factors);
  const disqualifiers = [
    ...disqualifiersFor(lead),
    ...factors.icp_fit.rating === "WEAK" ? [QUALIFICATION_CONFIG.hardDisqualifiers.fundamentalIcpMismatch] : []
  ];
  const score = calculateQualificationScore(factors, disqualifiers);
  const qualification = qualificationFromScore(score);
  const evaluatedSignals = factorEntries(factors).filter(([, value]) => value.rating !== "UNKNOWN").length;
  const unknownSignals = factorEntries(factors).filter(([, value]) => value.rating === "UNKNOWN").length;
  const missingInfo = [
    ...analysis.missing_information.map((item) => ({ title: "Discovery input", body: item })),
    !lead.targetMarket && { title: "Target market", body: "The target geography or priority customer market has not been provided." },
    !lead.timeline && { title: "Decision timeline", body: "The expected start date and decision horizon have not been established." }
  ].filter(Boolean);
  const signals = factorEntries(factors).map(([key, factor]) => ({ signal: FACTOR_LABELS[key], assessment: ratingToAssessment(factor.rating), evidence: factor.reason }));
  const monthlyBudget = `${formatBudgetAmount(lead.budgetAmount, lead.budgetCurrency)} / month`;
  const rationale = disqualifiers.length ? `${disqualifiers.join(" ")} ${analysis.reasoning}` : analysis.reasoning;
  return {
    qualification,
    score,
    title: qualification === "HIGH" ? "High-fit opportunity" : qualification === "MEDIUM" ? "Potentially viable opportunity" : "Low-fit opportunity",
    rationale,
    confidence: { label: unknownSignals <= 2 ? "High" : unknownSignals <= 4 ? "Moderate" : "Limited", rationale: inspection.status === "AVAILABLE" ? "Based on submitted commercial context and a lightweight homepage inspection." : "Based on submitted lead information; the supplied website was unavailable for inspection.", evaluatedSignals },
    executiveSummary: [
      { title: "Service alignment", body: factors.service_fit.reason },
      { title: "Commercial context", body: `${factors.budget_fit.reason} Declared scope: ${monthlyBudget}.` },
      { title: "Business objective", body: factors.business_objective_fit.reason },
      { title: "Website context", body: inspection.status === "AVAILABLE" ? inspection.siteDescription ?? "Homepage inspection completed with limited descriptive content." : "The homepage could not be inspected; website-specific evidence remains unavailable." }
    ],
    signals,
    missingInfo: missingInfo.slice(0, 4),
    recommendation: analysis.next_best_action,
    methodology: `The assessment applies ten explicit weighted factors: service fit, ICP/company fit, budget fit, geographic fit, business objective fit, SEO use-case fit, timeline fit, buying intent, goal clarity and information completeness. The prototype ICP focuses on ${QUALIFICATION_CONFIG.targetCustomerTypes.join(", ")}.`,
    assumptions: "This assessment prototype uses stated lead information and a lightweight homepage inspection where available. It is not a conversion-probability model; production calibration would require historical CRM and conversion data."
  };
}
async function qualifyLead(lead, inspection) {
  const analysis = await analyzeWithGemini(lead, inspection);
  return { report: reportFromAnalysis(lead, inspection, analysis), model: QUALIFICATION_CONFIG.geminiModel };
}

// server/websiteInspection.ts
function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const private172 = host.match(/^172\.(\d{1,3})\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}
function decodeHtml(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function extractTag(html, pattern) {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1].replace(/\s+/g, " ").trim()).slice(0, 500) : void 0;
}
async function inspectHomepage(website) {
  try {
    const url = new URL(website);
    if (url.protocol !== "https:" && url.protocol !== "http:") return { status: "UNAVAILABLE" };
    if (isPrivateHostname(url.hostname)) return { status: "UNAVAILABLE" };
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(7e3),
      headers: { "User-Agent": "SEOSignal/1.0 website-inspection" }
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) return { status: "UNAVAILABLE" };
    const html = (await response.text()).slice(0, 1e5);
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ?? extractTag(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
    const visibleText = decodeHtml(
      html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    ).slice(0, 1600);
    return {
      status: "AVAILABLE",
      title,
      metaDescription,
      visibleText,
      siteDescription: metaDescription ?? visibleText?.slice(0, 360)
    };
  } catch {
    return { status: "UNAVAILABLE" };
  }
}

// server/supabasePersistence.ts
var SupabasePersistenceError = class extends Error {
};
function storedConfidence(label) {
  return { High: "HIGH", Moderate: "MEDIUM", Limited: "LOW" }[label];
}
async function request(path, init) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const baseUrl = configuredUrl?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) throw new SupabasePersistenceError("Supabase credentials are unavailable.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers
    },
    signal: AbortSignal.timeout(12e3)
  });
  if (!response.ok) throw new SupabasePersistenceError(`Supabase persistence failed with ${response.status}.`);
  return response;
}
async function persistQualification(input) {
  const leads = await request("/rest/v1/leads", {
    method: "POST",
    body: JSON.stringify({
      company_name: input.lead.company,
      website: input.lead.website,
      service: input.lead.serviceRequired,
      budget_amount: input.lead.budgetAmount,
      budget_currency: input.lead.budgetCurrency,
      goal: input.lead.businessGoal,
      target_market: input.lead.targetMarket || null,
      timeline: input.lead.timeline || null,
      current_situation: input.lead.seoChallenge || null,
      website_inspection_status: input.inspection.status
    })
  });
  const savedLeads = await leads.json();
  const leadId = savedLeads[0]?.id;
  if (!leadId) throw new SupabasePersistenceError("Supabase did not return a lead id.");
  try {
    await request("/rest/v1/qualifications", {
      method: "POST",
      body: JSON.stringify({
        lead_id: leadId,
        qualification: input.report.qualification,
        score: input.report.score,
        confidence: storedConfidence(input.report.confidence.label),
        reasoning: input.report.rationale,
        factors: input.report.signals,
        missing_information: input.report.missingInfo,
        next_best_action: input.report.recommendation,
        model: input.model
      })
    });
  } catch (error) {
    try {
      await request(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
    } catch {
    }
    throw error;
  }
  return { leadId };
}

// server/routers.ts
var leadInput = z3.object({
  company: z3.string().min(2).max(120),
  website: z3.string().url().max(500).refine((value) => /^https?:\/\//i.test(value), "Website must use http or https."),
  serviceRequired: z3.enum(["SEO strategy", "Technical SEO", "Content SEO", "Enterprise SEO", "SEO audit"]),
  budgetAmount: z3.number().positive().max(1e9),
  budgetCurrency: z3.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "AED", "CHF", "JPY"]),
  businessGoal: z3.enum(["Qualified leads", "Organic revenue", "Market visibility", "Technical health"]),
  targetMarket: z3.string().max(160).optional(),
  timeline: z3.string().max(160).optional(),
  seoChallenge: z3.string().max(1e3).optional()
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  qualification: router({
    analyze: publicProcedure.input(leadInput).mutation(async ({ input }) => {
      const inspection = await inspectHomepage(input.website);
      try {
        const outcome = await qualifyLead(input, inspection);
        await persistQualification({ lead: input, inspection, report: outcome.report, model: outcome.model });
        return outcome.report;
      } catch (error) {
        if (error instanceof GeminiQualificationError || error instanceof SupabasePersistenceError) {
          console.warn("[SEOSignal] Qualification dependency failed:", error.name);
          throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the qualification right now. Please try again." });
        }
        console.error("[SEOSignal] Unexpected qualification error:", error instanceof Error ? error.name : "unknown");
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the qualification right now. Please try again." });
      }
    })
  })
});

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app2;
}

// server/vercelHandler.ts
var app = createApp();
var vercelHandler_default = app;
export {
  vercelHandler_default as default
};
