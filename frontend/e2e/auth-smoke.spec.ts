import { expect, test } from "playwright/test";

test("unauthenticated visitors can reach sign-in and sign-up from the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Plan less/i })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByRole("button", { name: "Create a new workspace" }).click();
  await expect(page.getByRole("heading", { name: /Start with a clean loop/i })).toBeVisible();
});

test("a protected route does not expose workspace content without a session", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: /Plan less/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toHaveCount(0);
});

test.describe("Google sign-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.route((url) => url.pathname === "/src/lib/firebase.ts", async (route) => {
      const response = await route.fetch();
      const script = await response.text();
      const viteEnvAssignment = /^import\.meta\.env = [^\n]+?;/m;
      expect(script).toMatch(viteEnvAssignment);
      // The other smoke tests run without Firebase; configure only this page.
      const firebaseEnv = JSON.stringify({
        VITE_FIREBASE_API_KEY: "test-api-key",
        VITE_FIREBASE_AUTH_DOMAIN: "dayloop-test.firebaseapp.com",
        VITE_FIREBASE_PROJECT_ID: "dayloop-test",
        VITE_FIREBASE_APP_ID: "test-app-id",
      });
      await route.fulfill({
        response,
        body: script.replace(viteEnvAssignment, `import.meta.env = ${firebaseEnv};\n`),
      });
    });
  });

  for (const platform of ["android", "ios"] as const) {
    test(`exchanges the ${platform} Google ID token using the Firebase Web SDK`, async ({ page }) => {
      await page.addInitScript(({ platform }) => {
        const native = platform === "android" ? { androidBridge: {} } : { webkit: { messageHandlers: { bridge: {} } } };
        const plugin = platform === "android" ? "DayLoopGoogleSignIn" : "FirebaseAuthentication";
        const method = platform === "android" ? "signIn" : "signInWithGoogle";
        Object.assign(window, native, {
          Capacitor: {
            PluginHeaders: [{ name: plugin, methods: [{ name: method, rtype: "promise" }] }],
            async nativePromise(name: string, entry: string, options?: { skipNativeAuth?: boolean }) {
              if (name === "DayLoopGoogleSignIn" && entry === "signIn") return { idToken: "android-token" };
              if (name === "FirebaseAuthentication" && entry === "signInWithGoogle" && options?.skipNativeAuth) {
                return { credential: { idToken: "ios-token" }, user: null, additionalUserInfo: null };
              }
              throw new Error("Unexpected native plugin call");
            },
          },
        });
      }, { platform });
      await page.route("https://identitytoolkit.googleapis.com/**", (route) => route.fulfill({
        status: 400,
        headers: { "access-control-allow-origin": "*" },
        json: { error: { message: "INVALID_IDP_RESPONSE" } },
      }));

      await page.goto("/");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const [request] = await Promise.all([
        page.waitForRequest("https://identitytoolkit.googleapis.com/**/accounts:signInWithIdp?*"),
        page.getByRole("button", { name: "Continue with Google" }).click(),
      ]);
      const credential = new URLSearchParams(request.postDataJSON().postBody);
      expect(credential.get("providerId")).toBe("google.com");
      expect(credential.get("id_token")).toBe(`${platform}-token`);
      await expect(page.getByRole("alert")).toHaveText(
        "Firebase could not verify the Google sign-in. Try again or sign in with email.",
      );
    });
  }

  test("opens a Firebase Google popup in the browser", async ({ page, context }) => {
    await page.addInitScript(() => {
      const iframe = {
        async restyle() {},
        async ping() {},
        register() {},
        send() {},
      };
      Object.assign(window, {
        gapi: {
          iframes: {
            Iframe: class {},
            getContext: () => ({
              open: (_options: unknown, ready: (frame: typeof iframe) => unknown) => ready(iframe),
            }),
          },
        },
      });
    });
    await context.route("https://dayloop-test.firebaseapp.com/__/auth/handler?*", (route) => route.fulfill({ body: "Google sign-in popup" }));
    await page.route("https://identitytoolkit.googleapis.com/**", (route) => route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: { authorizedDomains: ["127.0.0.1"] },
    }));

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Continue with Google" }).click(),
    ]);
    await popup.waitForURL("https://dayloop-test.firebaseapp.com/__/auth/handler?*", { waitUntil: "commit" });
    expect(new URL(popup.url()).searchParams.get("providerId")).toBe("google.com");
    await popup.close();
  });

  test("Android account picker cancellation allows another attempt", async ({ page }) => {
    await page.addInitScript(() => {
      let attempts = 0;
      Object.assign(window, {
        androidBridge: {},
        Capacitor: {
          PluginHeaders: [{ name: "DayLoopGoogleSignIn", methods: [{ name: "signIn", rtype: "promise" }] }],
          async nativePromise() {
            if (++attempts === 1) throw Object.assign(new Error("Cancelled"), { code: "google/cancelled" });
            throw Object.assign(new Error("Configuration rejected"), { code: "google/configuration" });
          },
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const googleButton = page.getByRole("button", { name: "Continue with Google" });
    await googleButton.click();
    await expect(googleButton).toBeEnabled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await googleButton.click();
    await expect(page.getByRole("alert")).toContainText("Use email or install a build with a registered signing certificate.");
  });
});
